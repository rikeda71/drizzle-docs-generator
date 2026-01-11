// Re-export comment extraction functionality
export { extractComments } from "./comments.js";
export type { SchemaComments, TableComment, ColumnComment } from "./comments.js";

// Re-export relations extraction functionality
export { extractRelations } from "./relations.js";
export type { ParsedRelation, SchemaRelations } from "./relations.js";
