import type { ParsedSchema } from "../types.js";

// Re-export comment extraction functionality
export { extractComments } from "./comments.js";
export type { SchemaComments, TableComment, ColumnComment } from "./comments.js";

// Re-export relations extraction functionality
export { extractRelations } from "./relations.js";
export type { ParsedRelation, SchemaRelations } from "./relations.js";

export function parseSchema(_filePath: string): ParsedSchema {
  // Note: Schema structure parsing is handled by Drizzle ORM at runtime.
  // Use extractComments() to get JSDoc comments from source files.
  return {
    tables: [],
    relations: [],
  };
}
