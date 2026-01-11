// Re-export comment extraction functionality
export { extractComments } from "./comments";
export type { SchemaComments, TableComment, ColumnComment } from "./comments";

// Re-export relations extraction functionality
export { extractRelations } from "./relations";
export type { ParsedRelation, SchemaRelations } from "./relations";
