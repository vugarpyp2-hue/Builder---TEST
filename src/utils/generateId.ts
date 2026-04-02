/**
 * @file generateId.ts
 * @description Utility to generate unique IDs.
 * @exports generateId
 */

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
