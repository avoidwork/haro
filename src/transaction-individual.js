import { TransactionError } from "./errors.js";
import { TransactionStates, IsolationLevels } from "./constants.js";
import { TransactionOperation } from "./transaction-operation.js";
import { randomUUID as uuid } from "crypto";

/**
 * Transaction implementation with ACID properties
 */
export class Transaction {
	/**
	 * @param {string} [id] - Transaction ID (auto-generated if not provided)
	 * @param {Object} [options={}] - Transaction options
	 * @param {number} [options.isolationLevel=IsolationLevels.READ_COMMITTED] - Isolation level
	 * @param {number} [options.timeout=60000] - Transaction timeout in milliseconds
	 * @param {boolean} [options.readOnly=false] - Whether transaction is read-only
	 */
	constructor (id = uuid(), options = {}) {
		this.id = id;
		this.state = TransactionStates.PENDING;
		this.isolationLevel = options.isolationLevel || IsolationLevels.READ_COMMITTED;
		this.timeout = options.timeout || 60000;
		this.readOnly = options.readOnly || false;
		this.startTime = null;
		this.endTime = null;

		// Operation log for rollback
		this.operations = [];

		// Read set for isolation (record keys read during transaction)
		this.readSet = new Set();

		// Write set for isolation (record keys written during transaction)
		this.writeSet = new Set();

		// Snapshot for repeatable read isolation
		this.snapshot = new Map();

		// Validation callback for custom constraints
		this.validationCallback = null;

		// Abort reason (set when transaction is aborted)
		this.abortReason = null;

		Object.seal(this);
	}

	/**
	 * Begin the transaction
	 * @returns {Transaction} This transaction for chaining
	 * @throws {TransactionError} If transaction is already active
	 */
	begin () {
		if (this.state !== TransactionStates.PENDING) {
			throw new TransactionError(
				`Cannot begin transaction in state: ${this.state}`,
				this.id,
				"begin"
			);
		}

		this.state = TransactionStates.ACTIVE;
		this.startTime = new Date();

		return this;
	}

	/**
	 * Add an operation to the transaction log
	 * @param {string} type - Operation type
	 * @param {string} key - Record key
	 * @param {*} [oldValue] - Previous value
	 * @param {*} [newValue] - New value
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {TransactionOperation} Created operation
	 * @throws {TransactionError} If transaction is not active or is read-only
	 */
	addOperation (type, key, oldValue, newValue, metadata = {}) {
		this._checkActive();

		if (this.readOnly && type !== "read") {
			throw new TransactionError(
				"Cannot perform write operations in read-only transaction",
				this.id,
				"write"
			);
		}

		// Check timeout
		if (this._isTimedOut()) {
			throw new TransactionError(
				"Transaction has timed out",
				this.id,
				"timeout"
			);
		}

		const operation = new TransactionOperation(type, key, oldValue, newValue, metadata);
		this.operations.push(operation);

		// Track read and write sets
		if (type === "read") {
			this.readSet.add(key);
		} else {
			this.writeSet.add(key);
		}

		return operation;
	}

	/**
	 * Set validation callback for custom constraints
	 * @param {Function} callback - Validation function
	 * @returns {Transaction} This transaction for chaining
	 */
	setValidation (callback) {
		this.validationCallback = callback;

		return this;
	}

	/**
	 * Validate transaction before commit
	 * @param {Object} [context] - Validation context
	 * @returns {boolean} True if validation passes
	 * @throws {TransactionError} If validation fails
	 */
	validate (context = {}) {
		if (this.validationCallback) {
			const result = this.validationCallback(this, context);
			if (result !== true) {
				const message = typeof result === "string" ? result : "Transaction validation failed";
				throw new TransactionError(message, this.id, "validation");
			}
		}

		return true;
	}

	/**
	 * Commit the transaction
	 * @param {Object} [context] - Commit context
	 * @returns {Transaction} This transaction for chaining
	 * @throws {TransactionError} If commit fails
	 */
	commit (context = {}) {
		this._checkActive();

		try {
			// Validate before commit
			this.validate(context);

			this.state = TransactionStates.COMMITTED;
			this.endTime = new Date();

			return this;
		} catch (error) {
			// Auto-abort on commit failure
			this.abort();
			throw error;
		}
	}

	/**
	 * Abort the transaction
	 * @param {string} [reason] - Reason for abort
	 * @returns {Transaction} This transaction for chaining
	 */
	abort (reason = "User abort") {
		if (this.state === TransactionStates.ABORTED || this.state === TransactionStates.COMMITTED) {
			return this;
		}

		this.state = TransactionStates.ABORTED;
		this.endTime = new Date();
		this.abortReason = reason;

		return this;
	}

	/**
	 * Get rollback operations (in reverse order)
	 * @returns {TransactionOperation[]} Array of rollback operations
	 */
	getRollbackOperations () {
		return this.operations
			.slice()
			.reverse()
			.filter(op => op.type !== "read") // Filter out read operations
			.map(op => op.createRollback())
			.filter(op => op !== null);
	}

	/**
	 * Check if transaction is active
	 * @returns {boolean} True if transaction is active
	 */
	isActive () {
		return this.state === TransactionStates.ACTIVE;
	}

	/**
	 * Check if transaction is committed
	 * @returns {boolean} True if transaction is committed
	 */
	isCommitted () {
		return this.state === TransactionStates.COMMITTED;
	}

	/**
	 * Check if transaction is aborted
	 * @returns {boolean} True if transaction is aborted
	 */
	isAborted () {
		return this.state === TransactionStates.ABORTED;
	}

	/**
	 * Get transaction duration
	 * @returns {number|null} Duration in milliseconds, null if not completed
	 */
	getDuration () {
		if (!this.startTime) return null;
		const endTime = this.endTime || new Date();

		return endTime.getTime() - this.startTime.getTime();
	}

	/**
	 * Get transaction statistics
	 * @returns {Object} Transaction statistics
	 */
	getStats () {
		return {
			id: this.id,
			state: this.state,
			isolationLevel: this.isolationLevel,
			readOnly: this.readOnly,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.getDuration(),
			operationCount: this.operations.length,
			readSetSize: this.readSet.size,
			writeSetSize: this.writeSet.size,
			snapshotSize: this.snapshot.size,
			abortReason: this.abortReason,
			timedOut: this._isTimedOut()
		};
	}

	/**
	 * Export transaction for debugging/logging
	 * @returns {Object} Exportable transaction data
	 */
	export () {
		return {
			...this.getStats(),
			operations: this.operations.map(op => ({
				id: op.id,
				type: op.type,
				key: op.key,
				timestamp: op.timestamp,
				metadata: op.metadata
			})),
			readSet: Array.from(this.readSet),
			writeSet: Array.from(this.writeSet)
		};
	}

	/**
	 * Check if transaction is active and throw if not
	 * @throws {TransactionError} If transaction is not active
	 * @private
	 */
	_checkActive () {
		if (this.state !== TransactionStates.ACTIVE) {
			throw new TransactionError(
				`Transaction is not active (current state: ${this.state})`,
				this.id,
				"state"
			);
		}
	}

	/**
	 * Check if transaction has timed out
	 * @returns {boolean} True if timed out
	 * @private
	 */
	_isTimedOut () {
		if (!this.startTime) return false;

		return Date.now() - this.startTime.getTime() > this.timeout;
	}
}
