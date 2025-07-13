/**
 * UUID generation function that uses native crypto.randomUUID when available,
 * otherwise falls back to a custom implementation.
 * @returns A UUID v4 string
 */
export const uuid: () => string; 