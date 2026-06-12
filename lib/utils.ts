/** Generates a cryptographically random UUID (v4) */
export const generateId = (): string => crypto.randomUUID();
