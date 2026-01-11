import type { AnyColumn, Relations, Table } from "drizzle-orm";
import type { SchemaComments } from "./parser/comments.js";

// Re-export Drizzle types for convenience
export type { AnyColumn, Relations, Table };

/**
 * Options for DBML generation
 */
export interface GenerateOptions<TSchema extends Record<string, unknown>> {
  /** The Drizzle schema object containing tables and optionally relations */
  schema: TSchema;
  /** Output file path. If provided, DBML will be written to this file */
  out?: string;
  /** If true, uses relations() definitions instead of foreign keys for references */
  relational?: boolean;
  /**
   * Path to the source schema file or directory for extracting JSDoc comments and relations.
   * If a directory is provided, all .ts files will be processed recursively.
   * Comments will be extracted and included as DBML Note clauses.
   */
  source?: string;
  /**
   * Pre-extracted comments to use for DBML Note clauses.
   * Alternative to source - use this if you've already extracted comments.
   */
  comments?: SchemaComments;
}

/**
 * Supported relation types in DBML
 */
export type RelationType = "one-to-one" | "one-to-many" | "many-to-one";

/**
 * Internal representation of a reference/relationship
 */
export interface GeneratedRef {
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  type: "<" | ">" | "-";
  onDelete?: string;
  onUpdate?: string;
}

/**
 * Column constraint attributes for DBML output
 */
export interface ColumnAttributes {
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  increment?: boolean;
  default?: string;
  note?: string;
}
