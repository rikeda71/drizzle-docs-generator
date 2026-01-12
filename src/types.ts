import type { AnyColumn, Table } from "drizzle-orm";
import type { SchemaComments } from "./parser/comments";

// Re-export Drizzle types for convenience
export type { AnyColumn, Table };

/**
 * Options for DBML generation
 */
export interface GenerateOptions<TSchema extends Record<string, unknown>> {
  /** The Drizzle schema object containing tables and optionally relations */
  schema: TSchema;
  /** Output file path. If provided, DBML will be written to this file */
  out?: string;
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

// =============================================================================
// Intermediate Schema Types
// =============================================================================
// These types represent a database-agnostic intermediate representation
// that can be used to generate various output formats (DBML, Markdown, etc.)

/**
 * Supported database types
 *
 * @remarks
 * TODO: Unify with `Dialect` type in `src/cli/index.ts` when implementing CLI --format option (#59)
 */
export type DatabaseType = "postgresql" | "mysql" | "sqlite";

/**
 * Column definition in the intermediate schema
 */
export interface ColumnDefinition {
  /** Column name */
  name: string;
  /** SQL data type (e.g., "varchar(255)", "integer", "timestamp") */
  type: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Default value expression (e.g., "now()", "'active'") */
  defaultValue?: string;
  /** Whether this column is a primary key */
  primaryKey: boolean;
  /** Whether this column has a unique constraint */
  unique: boolean;
  /** Whether this column auto-increments */
  autoIncrement?: boolean;
  /** JSDoc comment or description for this column */
  comment?: string;
}

/**
 * Index definition in the intermediate schema
 */
export interface IndexDefinition {
  /** Index name */
  name: string;
  /** Columns included in the index */
  columns: string[];
  /** Whether this is a unique index */
  unique: boolean;
  /** Index type (e.g., "btree", "hash", "gin") - database specific */
  type?: string;
}

/**
 * Constraint types
 */
export type ConstraintType = "primary_key" | "foreign_key" | "unique" | "check" | "not_null";

/**
 * Constraint definition in the intermediate schema
 */
export interface ConstraintDefinition {
  /** Constraint name */
  name: string;
  /** Type of constraint */
  type: ConstraintType;
  /** Columns involved in the constraint */
  columns: string[];
  /** SQL definition or expression (for CHECK constraints) */
  definition?: string;
  /** Referenced table (for foreign keys) */
  referencedTable?: string;
  /** Referenced columns (for foreign keys) */
  referencedColumns?: string[];
}

/**
 * Table definition in the intermediate schema
 */
export interface TableDefinition {
  /** Table name */
  name: string;
  /** Schema name (e.g., "public" for PostgreSQL) */
  schema?: string;
  /** JSDoc comment or description for this table */
  comment?: string;
  /** Column definitions */
  columns: ColumnDefinition[];
  /** Index definitions */
  indexes: IndexDefinition[];
  /** Constraint definitions */
  constraints: ConstraintDefinition[];
}

/**
 * Relation types for intermediate schema
 */
export type IntermediateRelationType =
  | "one-to-one"
  | "one-to-many"
  | "many-to-one"
  | "many-to-many";

/**
 * Relation/Reference definition in the intermediate schema
 */
export interface RelationDefinition {
  /** Optional relation name */
  name?: string;
  /** Source table name */
  fromTable: string;
  /** Source column names */
  fromColumns: string[];
  /** Target table name */
  toTable: string;
  /** Target column names */
  toColumns: string[];
  /** Relation cardinality */
  type: IntermediateRelationType;
  /** ON DELETE action */
  onDelete?: string;
  /** ON UPDATE action */
  onUpdate?: string;
}

/**
 * Enum definition in the intermediate schema (PostgreSQL specific)
 */
export interface EnumDefinition {
  /** Enum type name */
  name: string;
  /** Schema name (e.g., "public" for PostgreSQL) */
  schema?: string;
  /** Enum values */
  values: string[];
}

/**
 * The complete intermediate schema representation
 *
 * This is a database-agnostic representation of a schema that can be
 * used to generate various output formats (DBML, Markdown, JSON, etc.)
 */
export interface IntermediateSchema {
  /** Database type that this schema was extracted from */
  databaseType: DatabaseType;
  /** Table definitions */
  tables: TableDefinition[];
  /** Relation/Reference definitions */
  relations: RelationDefinition[];
  /** Enum definitions (PostgreSQL specific) */
  enums: EnumDefinition[];
}
