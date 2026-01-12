/**
 * Unified relation representation for both v0 (relations()) and v1 (defineRelations())
 *
 * This interface provides a common format for relation information extracted
 * from either API version, enabling consistent processing downstream.
 */
export interface UnifiedRelation {
  /** Source table name (database name, not TypeScript variable) */
  sourceTable: string;
  /** Source column names (database names) */
  sourceColumns: string[];
  /** Target table name (database name) */
  targetTable: string;
  /** Target column names (database names) */
  targetColumns: string[];
  /** Type of relation */
  relationType: "one-to-one" | "one-to-many" | "many-to-one";
  /** Optional onDelete action (e.g., CASCADE, SET NULL) */
  onDelete?: string;
  /** Optional onUpdate action (e.g., CASCADE, SET NULL) */
  onUpdate?: string;
}

/**
 * Adapter interface for extracting relations from different Drizzle ORM APIs
 *
 * Implementations handle the specifics of v0 relations() and v1 defineRelations()
 * APIs, converting them to a unified representation.
 */
export interface RelationAdapter {
  /**
   * Extract relations from the schema
   *
   * Processes the schema to identify and extract all relations, converting
   * them to the unified format.
   *
   * @returns Array of unified relations
   */
  extract(): UnifiedRelation[];
}
