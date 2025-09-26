import { TransactionError } from "./errors.js";
import { OperationTypes } from "./constants.js";
import { randomUUID as uuid } from "crypto";

/**
 * Transaction operation entry
 */
export class TransactionOperation {
	/**
	 * @param {string} type - Operation type
	 * @param {string} key - Record key
	 * @param {*} [oldValue] - Previous value (for rollback)
	 * @param {*} [newValue] - New value
	 * @param {Object} [metadata={}] - Additional metadata
	 */
	constructor (type, key, oldValue, newValue, metadata = {}) {
		this.id = uuid();
		this.type = type;
		this.key = key;
		this.oldValue = oldValue;
		this.newValue = newValue;
		this.metadata = metadata;
		this.timestamp = new Date();

		Object.freeze(this);
	}

	/**
	 * Create rollback operation
	 * @returns {TransactionOperation} Rollback operation
	 */
	createRollback () {
		switch (this.type) {
			case OperationTypes.SET:
				return this.oldValue === undefined ?
					new TransactionOperation(OperationTypes.DELETE, this.key, this.newValue, undefined) :
					new TransactionOperation(OperationTypes.SET, this.key, this.newValue, this.oldValue);

			case OperationTypes.DELETE:
				return new TransactionOperation(OperationTypes.SET, this.key, undefined, this.oldValue);

			default:
				throw new TransactionError(`Cannot create rollback for operation type: ${this.type}`, null, "rollback");
		}
	}
}
