import type { AnyColumn, Relations, Table } from "drizzle-orm";

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

// Legacy types for backward compatibility with parsed schema approach
export interface Column {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  notNull?: boolean;
  default?: string;
  comment?: string;
}

export interface Relation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
}

export interface ParsedTable {
  name: string;
  columns: Column[];
  comment?: string;
}

export interface ParsedSchema {
  tables: ParsedTable[];
  relations: Relation[];
}
