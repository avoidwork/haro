// Re-export all transaction-related classes for backward compatibility
export { TransactionOperation } from "./transaction-operation.js";
export { LockManager } from "./lock-manager.js";
export { Transaction } from "./transaction-individual.js";
export { TransactionManager } from "./transaction-manager.js";

// Also re-export constants that were previously defined in this file
export {
	TransactionStates,
	OperationTypes,
	IsolationLevels,
	LockTypes
} from "./constants.js";
