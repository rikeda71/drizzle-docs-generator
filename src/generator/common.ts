import {
  type AnyColumn,
  type Table,
  getTableColumns,
  getTableName,
  is,
  Relation,
} from "drizzle-orm";
import type { TableRelationalConfig } from "drizzle-orm/relations";
import { PgTable, getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { MySqlTable, getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { SQLiteTable, getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DbmlFormatter } from "../formatter/dbml";

/**
 * Legacy v0 Relations type (for backward compatibility with relations())
 * This is a simplified type - the actual structure is more complex
 */
type LegacyRelations = {
  table: Table;
  config: Record<string, unknown>;
};

import type {
  GeneratedRef,
  GenerateOptions,
  IntermediateSchema,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  ConstraintDefinition,
  RelationDefinition,
  EnumDefinition,
  DatabaseType,
  IntermediateRelationType,
} from "../types";
import { extractComments, type SchemaComments } from "../parser/comments";
import { extractRelations, type SchemaRelations } from "../parser/relations";
import { V0RelationAdapter, V1RelationAdapter, type UnifiedRelation } from "../adapter";

/**
 * Configuration for different database dialects
 */
export interface DialectConfig {
  escapeName: (name: string) => string;
  isIncrement: (column: AnyColumn) => boolean;
}

/**
 * Configuration for an index definition
 */
export interface IndexConfig {
  config: {
    columns: Array<{ name: string }>;
    name?: string;
    unique?: boolean;
    using?: string;
  };
}

/**
 * Configuration for a primary key constraint
 */
export interface PrimaryKeyConfig {
  columns: Array<{ name: string }>;
  name?: string;
}

/**
 * Configuration for a unique constraint
 */
export interface UniqueConstraintConfig {
  columns: Array<{ name: string }>;
  name?: string;
}

/**
 * Configuration for a foreign key constraint
 */
export interface ForeignKeyConfig {
  reference: () => {
    columns: Array<{ name: string }>;
    foreignColumns: Array<{ name: string }>;
    foreignTable: Table;
  };
  name?: string;
  onDelete?: string;
  onUpdate?: string;
}

/**
 * Table configuration extracted from Drizzle tables
 */
export interface TableConfig {
  indexes: IndexConfig[];
  primaryKeys: PrimaryKeyConfig[];
  uniqueConstraints: UniqueConstraintConfig[];
  foreignKeys: ForeignKeyConfig[];
}

// Use official v1 types from drizzle-orm/relations:
// - TableRelationalConfig: { table, name, relations: Record<string, AnyRelation> }
// - AnyRelation: Relation with sourceColumns, targetColumns, relationType, etc.

/**
 * Base generator class for DBML generation
 */
export abstract class BaseGenerator<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  protected schema: TSchema;
  protected relational: boolean;
  protected generatedRefs: GeneratedRef[] = [];
  protected comments: SchemaComments | undefined;
  protected parsedRelations: SchemaRelations | undefined;
  protected source: string | undefined;
  protected abstract dialectConfig: DialectConfig;

  /**
   * Create a new generator instance
   * @param options - Configuration options including schema, relational mode, source code, and comments
   */
  constructor(options: GenerateOptions<TSchema>) {
    this.schema = options.schema;
    this.relational = options.relational ?? false;
    this.source = options.source;

    // Initialize comments from options
    if (options.comments) {
      this.comments = options.comments;
    } else if (this.source) {
      this.comments = extractComments(this.source);
    }

    // Extract relations from source if relational mode is enabled
    if (this.relational && this.source) {
      this.parsedRelations = extractRelations(this.source);
    }
  }

  /**
   * Generate complete DBML output from the schema
   *
   * Creates DBML representation including:
   * - Table definitions with columns, indexes, and constraints
   * - Foreign key references (from table config or relations)
   * - Comments for tables and columns
   *
   * @returns The complete DBML string
   */
  generate(): string {
    const schema = this.toIntermediateSchema();
    const formatter = new DbmlFormatter();
    return formatter.format(schema);
  }

  /**
   * Get all tables from schema
   *
   * Extracts all Drizzle table objects from the schema by checking each value
   * with isTable() method.
   *
   * @returns Array of table objects
   */
  protected getTables(): Table[] {
    const tables: Table[] = [];
    for (const value of Object.values(this.schema)) {
      if (this.isTable(value)) {
        tables.push(value as Table);
      }
    }
    return tables;
  }

  /**
   * Check if a value is a Drizzle table
   *
   * Validates whether a value is a table instance from any supported dialect
   * (PostgreSQL, MySQL, or SQLite).
   *
   * @param value - The value to check
   * @returns True if value is a Drizzle table
   */
  protected isTable(value: unknown): boolean {
    return is(value, PgTable) || is(value, MySqlTable) || is(value, SQLiteTable);
  }

  /**
   * Get all v0 relations from schema (legacy relations() API)
   *
   * Extracts legacy relations defined using the old relations() API.
   * These are identified by having 'table' and 'config' properties.
   *
   * @returns Array of legacy relation objects
   */
  protected getV0Relations(): LegacyRelations[] {
    const relations: LegacyRelations[] = [];
    for (const value of Object.values(this.schema)) {
      if (this.isV0Relations(value)) {
        relations.push(value as LegacyRelations);
      }
    }
    return relations;
  }

  /**
   * Check if a value is a Drizzle v0 relations object (from relations())
   *
   * Validates the legacy relations() format by checking for 'table' and 'config' properties.
   *
   * @param value - The value to check
   * @returns True if value is a legacy relations object
   */
  protected isV0Relations(value: unknown): boolean {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    // v0 Relations objects have 'table' and 'config' properties
    return (
      "table" in value &&
      "config" in value &&
      typeof (value as Record<string, unknown>).config === "object"
    );
  }

  /**
   * Check if a value is a v1 relation entry (from defineRelations())
   *
   * Uses official Drizzle v1 types: TableRelationalConfig with Relation instances.
   * Validates the structure has 'table', 'name', and 'relations' properties with valid types.
   *
   * @param value - The value to check
   * @returns True if value is a v1 relation entry
   */
  protected isV1RelationEntry(value: unknown): value is TableRelationalConfig {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    if (
      !("table" in obj) ||
      !("name" in obj) ||
      typeof obj.name !== "string" ||
      !("relations" in obj) ||
      typeof obj.relations !== "object" ||
      obj.relations === null
    ) {
      return false;
    }
    // Check that 'relations' contains Relation instances (using drizzle-orm is())
    const relations = obj.relations as Record<string, unknown>;
    const relationValues = Object.values(relations);
    // Empty relations object is valid, but if there are entries, they must be Relations
    if (relationValues.length > 0) {
      return relationValues.some((rel) => is(rel, Relation));
    }
    // If no relations defined, also check table is valid
    return this.isTable(obj.table);
  }

  /**
   * Get all v1 relation entries from schema (defineRelations() API)
   *
   * Handles both individual entries and the full defineRelations() result object.
   * Extracts relation configurations that use the modern v1 API with official types.
   *
   * @returns Array of v1 relation entries
   */
  protected getV1RelationEntries(): TableRelationalConfig[] {
    const entries: TableRelationalConfig[] = [];
    for (const value of Object.values(this.schema)) {
      // Check if it's an individual relation entry
      if (this.isV1RelationEntry(value)) {
        entries.push(value);
      }
      // Check if it's the full defineRelations() result object
      // (an object where each value is a relation entry)
      else if (this.isV1DefineRelationsResult(value)) {
        for (const entry of Object.values(value as Record<string, unknown>)) {
          if (this.isV1RelationEntry(entry)) {
            entries.push(entry);
          }
        }
      }
    }
    return entries;
  }

  /**
   * Check if a value is a full v1 defineRelations() result object
   *
   * This is an object where all values are TableRelationalConfig objects.
   * Used to detect the full result of calling defineRelations() in v1.
   *
   * @param value - The value to check
   * @returns True if value is a full defineRelations() result
   */
  protected isV1DefineRelationsResult(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    const values = Object.values(obj);
    // Must have at least one entry and all must be relation entries
    return values.length > 0 && values.every((v) => this.isV1RelationEntry(v));
  }

  /**
   * Get table configuration from a Drizzle table
   *
   * Extracts indexes, primary keys, unique constraints, and foreign keys
   * from the table using the appropriate dialect-specific config getter.
   * Type casts are applied at this boundary to convert Drizzle's internal types
   * to our typed interfaces.
   *
   * @param table - The Drizzle table to get configuration from
   * @returns Table configuration or undefined if dialect is not supported
   */
  protected getTableConfig(table: Table): TableConfig | undefined {
    // Detect dialect and use appropriate config getter
    // Type casts at the boundary from Drizzle internal types to our interfaces
    if (is(table, PgTable)) {
      const config = getPgTableConfig(table);
      return {
        indexes: (config.indexes || []) as unknown as IndexConfig[],
        primaryKeys: (config.primaryKeys || []) as unknown as PrimaryKeyConfig[],
        uniqueConstraints: (config.uniqueConstraints || []) as unknown as UniqueConstraintConfig[],
        foreignKeys: (config.foreignKeys || []) as unknown as ForeignKeyConfig[],
      };
    }
    if (is(table, MySqlTable)) {
      const config = getMySqlTableConfig(table);
      return {
        indexes: (config.indexes || []) as unknown as IndexConfig[],
        primaryKeys: (config.primaryKeys || []) as unknown as PrimaryKeyConfig[],
        uniqueConstraints: (config.uniqueConstraints || []) as unknown as UniqueConstraintConfig[],
        foreignKeys: (config.foreignKeys || []) as unknown as ForeignKeyConfig[],
      };
    }
    if (is(table, SQLiteTable)) {
      const config = getSqliteTableConfig(table);
      return {
        indexes: (config.indexes || []) as unknown as IndexConfig[],
        primaryKeys: (config.primaryKeys || []) as unknown as PrimaryKeyConfig[],
        uniqueConstraints: (config.uniqueConstraints || []) as unknown as UniqueConstraintConfig[],
        foreignKeys: (config.foreignKeys || []) as unknown as ForeignKeyConfig[],
      };
    }
    return undefined;
  }

  /**
   * Get the default value for a column
   *
   * Extracts and formats the default value from a column, handling SQL expressions,
   * objects, and primitive values. Returns undefined if no default value exists.
   *
   * @param column - The column to get the default value from
   * @returns Formatted default value string or undefined
   */
  protected getDefaultValue(column: AnyColumn): string | undefined {
    if (!column.hasDefault) {
      return undefined;
    }

    const defaultValue = column.default;

    if (defaultValue === null) {
      return "null";
    }

    if (defaultValue === undefined) {
      return undefined;
    }

    // Handle SQL expressions
    if (typeof defaultValue === "object" && defaultValue !== null) {
      if ("queryChunks" in defaultValue) {
        // It's a SQL template
        const chunks = (defaultValue as { queryChunks: unknown[] }).queryChunks;
        const sqlParts: string[] = [];
        for (const chunk of chunks) {
          if (typeof chunk === "string") {
            sqlParts.push(chunk);
          } else if (typeof chunk === "object" && chunk !== null && "value" in chunk) {
            sqlParts.push(String((chunk as { value: unknown }).value));
          }
        }
        return sqlParts.join("");
      }
      if ("sql" in defaultValue) {
        return (defaultValue as { sql: string }).sql;
      }
      // JSON object
      return JSON.stringify(defaultValue);
    }

    // Handle primitives
    if (typeof defaultValue === "string") {
      // Use '' escape (SQL standard)
      const escaped = defaultValue.replace(/'/g, "''");
      return `'${escaped}'`;
    }
    if (typeof defaultValue === "number" || typeof defaultValue === "boolean") {
      return String(defaultValue);
    }

    return undefined;
  }

  /**
   * Collect foreign keys from table configuration
   *
   * Parses all foreign key definitions from the table config and adds them
   * to the generatedRefs collection for later output.
   *
   * @param tableName - The name of the source table
   * @param foreignKeys - Array of foreign key definitions from table config
   */
  protected collectForeignKeysFromConfig(tableName: string, foreignKeys: ForeignKeyConfig[]): void {
    for (const fk of foreignKeys) {
      const ref = this.parseForeignKey(tableName, fk);
      this.generatedRefs.push(ref);
    }
  }

  /**
   * Parse a foreign key into a GeneratedRef
   *
   * Extracts foreign key information (source/target tables and columns, actions)
   * and converts it to a GeneratedRef object for DBML output.
   *
   * @param tableName - The name of the source table
   * @param fk - The foreign key definition to parse
   * @returns GeneratedRef object
   */
  protected parseForeignKey(tableName: string, fk: ForeignKeyConfig): GeneratedRef {
    const reference = fk.reference();
    const fromColumns = reference.columns.map((c) => c.name);
    const toColumns = reference.foreignColumns.map((c) => c.name);
    const toTable = getTableName(reference.foreignTable);

    return {
      fromTable: tableName,
      fromColumns,
      toTable,
      toColumns,
      type: ">",
      onDelete: fk.onDelete,
      onUpdate: fk.onUpdate,
    };
  }

  /**
   * Get a mapping from variable names to table names in the schema
   *
   * Creates a map from TypeScript variable names (e.g., "usersTable") to
   * actual database table names (e.g., "users").
   *
   * @returns Map of variable names to table names
   */
  protected getTableNameMapping(): Map<string, string> {
    const mapping = new Map<string, string>();
    for (const [varName, value] of Object.entries(this.schema)) {
      if (this.isTable(value)) {
        const tableName = getTableName(value as Table);
        mapping.set(varName, tableName);
      }
    }
    return mapping;
  }

  /**
   * Get a mapping from TypeScript property names to database column names for a table
   *
   * Creates a map from TypeScript property names (e.g., "authorId") to
   * actual database column names (e.g., "author_id").
   *
   * @param tableVarName - The variable name of the table in the schema
   * @returns Map of property names to column names
   */
  protected getColumnNameMapping(tableVarName: string): Map<string, string> {
    const mapping = new Map<string, string>();
    const table = this.schema[tableVarName];
    if (table && this.isTable(table)) {
      const columns = getTableColumns(table as Table);
      for (const [propName, column] of Object.entries(columns)) {
        mapping.set(propName, column.name);
      }
    }
    return mapping;
  }

  /**
   * Create the appropriate relation adapter based on schema contents
   *
   * Detects whether v1 or v0 relations are present and returns the
   * corresponding adapter implementation.
   *
   * @returns RelationAdapter instance (V1RelationAdapter or V0RelationAdapter)
   */
  private createRelationAdapter() {
    const v1Entries = this.getV1RelationEntries();
    if (v1Entries.length > 0) {
      return new V1RelationAdapter(v1Entries);
    }
    return new V0RelationAdapter(this.schema, this.parsedRelations);
  }

  /**
   * Convert a UnifiedRelation to a RelationDefinition
   *
   * Maps the unified relation format from adapters to the intermediate
   * schema's RelationDefinition format.
   *
   * @param unified - The unified relation from adapter
   * @returns RelationDefinition for intermediate schema
   */
  private unifiedRelationToDefinition(unified: UnifiedRelation): RelationDefinition {
    return {
      fromTable: unified.sourceTable,
      fromColumns: unified.sourceColumns,
      toTable: unified.targetTable,
      toColumns: unified.targetColumns,
      type: unified.relationType,
      onDelete: unified.onDelete,
      onUpdate: unified.onUpdate,
    };
  }

  // Helper methods for extracting column information from constraints

  /**
   * Get column names from an index definition
   *
   * @param idx - The index definition to extract columns from
   * @returns Array of column names in the index
   */
  protected getIndexColumns(idx: IndexConfig): string[] {
    return idx.config.columns.map((c) => c.name);
  }

  /**
   * Check if an index is unique
   *
   * @param idx - The index definition to check
   * @returns True if the index has the unique flag
   */
  protected isUniqueIndex(idx: IndexConfig): boolean {
    return idx.config.unique === true;
  }

  /**
   * Get column names from a primary key constraint
   *
   * @param pk - The primary key definition to extract columns from
   * @returns Array of column names in the primary key
   */
  protected getPrimaryKeyColumns(pk: PrimaryKeyConfig): string[] {
    return pk.columns.map((c) => c.name);
  }

  /**
   * Get column names from a unique constraint
   *
   * @param uc - The unique constraint definition to extract columns from
   * @returns Array of column names in the unique constraint
   */
  protected getUniqueConstraintColumns(uc: UniqueConstraintConfig): string[] {
    return uc.columns.map((c) => c.name);
  }

  // =============================================================================
  // Intermediate Schema Generation
  // =============================================================================

  /**
   * Convert the Drizzle schema to an intermediate schema representation
   *
   * Creates a database-agnostic intermediate representation that can be
   * used to generate various output formats (DBML, Markdown, JSON, etc.)
   *
   * @returns The intermediate schema representation
   */
  toIntermediateSchema(): IntermediateSchema {
    const tables = this.getTables();

    // Determine database type from the first table
    const databaseType = this.getDatabaseType(tables[0]);

    // Convert tables to intermediate format
    const tableDefinitions: TableDefinition[] = tables.map((table) =>
      this.tableToDefinition(table),
    );

    // Collect relations
    let relations: RelationDefinition[] = [];

    if (this.relational) {
      // Use adapter to extract relations in unified format
      const adapter = this.createRelationAdapter();
      const unifiedRelations = adapter.extract();
      relations = unifiedRelations.map((unified) => this.unifiedRelationToDefinition(unified));
    } else {
      // Collect foreign keys from table configs (legacy path)
      // Reset generatedRefs to collect fresh relations
      this.generatedRefs = [];
      for (const table of tables) {
        const tableName = getTableName(table);
        const tableConfig = this.getTableConfig(table);
        if (tableConfig && tableConfig.foreignKeys.length > 0) {
          this.collectForeignKeysFromConfig(tableName, tableConfig.foreignKeys);
        }
      }
      // Convert GeneratedRefs to RelationDefinitions
      relations = this.generatedRefs.map((ref) => this.refToRelationDefinition(ref));
    }

    // Collect enums (override in subclasses for dialect-specific behavior)
    const enums: EnumDefinition[] = this.collectEnumDefinitions();

    return {
      databaseType,
      tables: tableDefinitions,
      relations,
      enums,
    };
  }

  /**
   * Determine the database type from a Drizzle table
   *
   * @param table - The table to check (can be undefined for empty schemas)
   * @returns The database type
   */
  protected getDatabaseType(table: Table | undefined): DatabaseType {
    if (!table) {
      // Default to postgresql if no tables
      return "postgresql";
    }
    if (is(table, PgTable)) {
      return "postgresql";
    }
    if (is(table, MySqlTable)) {
      return "mysql";
    }
    if (is(table, SQLiteTable)) {
      return "sqlite";
    }
    // Fallback
    return "postgresql";
  }

  /**
   * Convert a Drizzle table to a TableDefinition
   *
   * @param table - The Drizzle table to convert
   * @returns The table definition
   */
  protected tableToDefinition(table: Table): TableDefinition {
    const tableName = getTableName(table);
    const columns = getTableColumns(table);
    const tableConfig = this.getTableConfig(table);

    // Convert columns
    const columnDefinitions: ColumnDefinition[] = Object.values(columns).map((column) =>
      this.columnToDefinition(column, tableName),
    );

    // Convert indexes
    const indexDefinitions: IndexDefinition[] = this.extractIndexDefinitions(tableConfig);

    // Convert constraints
    const constraintDefinitions: ConstraintDefinition[] =
      this.extractConstraintDefinitions(tableConfig);

    // Get table comment
    const tableComment = this.comments?.tables[tableName]?.comment;

    return {
      name: tableName,
      comment: tableComment,
      columns: columnDefinitions,
      indexes: indexDefinitions,
      constraints: constraintDefinitions,
    };
  }

  /**
   * Convert a Drizzle column to a ColumnDefinition
   *
   * @param column - The Drizzle column to convert
   * @param tableName - The name of the table containing the column
   * @returns The column definition
   */
  protected columnToDefinition(column: AnyColumn, tableName: string): ColumnDefinition {
    const columnComment = this.comments?.tables[tableName]?.columns[column.name]?.comment;
    const defaultValue = this.getDefaultValue(column);

    return {
      name: column.name,
      type: column.getSQLType(),
      nullable: !column.notNull,
      defaultValue,
      primaryKey: column.primary,
      unique: column.isUnique,
      autoIncrement: this.dialectConfig.isIncrement(column) || undefined,
      comment: columnComment,
    };
  }

  /**
   * Extract index definitions from table config
   *
   * @param tableConfig - The table configuration
   * @returns Array of index definitions
   */
  protected extractIndexDefinitions(tableConfig: TableConfig | undefined): IndexDefinition[] {
    if (!tableConfig) {
      return [];
    }

    const indexes: IndexDefinition[] = [];

    for (const idx of tableConfig.indexes) {
      const columns = this.getIndexColumns(idx);
      if (columns.length > 0) {
        const indexName = this.getIndexName(idx);
        indexes.push({
          name: indexName || `idx_${columns.join("_")}`,
          columns,
          unique: this.isUniqueIndex(idx),
          type: this.getIndexType(idx),
        });
      }
    }

    return indexes;
  }

  /**
   * Get the name of an index
   *
   * @param idx - The index definition
   * @returns The index name or undefined
   */
  protected getIndexName(idx: IndexConfig): string | undefined {
    return idx.config.name;
  }

  /**
   * Get the type of an index (e.g., btree, hash)
   *
   * @param idx - The index definition
   * @returns The index type or undefined
   */
  protected getIndexType(idx: IndexConfig): string | undefined {
    return idx.config.using;
  }

  /**
   * Extract constraint definitions from table config
   *
   * @param tableConfig - The table configuration
   * @returns Array of constraint definitions
   */
  protected extractConstraintDefinitions(
    tableConfig: TableConfig | undefined,
  ): ConstraintDefinition[] {
    if (!tableConfig) {
      return [];
    }

    const constraints: ConstraintDefinition[] = [];

    // Primary keys
    for (const pk of tableConfig.primaryKeys) {
      const columns = this.getPrimaryKeyColumns(pk);
      if (columns.length > 0) {
        const pkName = this.getPrimaryKeyName(pk);
        constraints.push({
          name: pkName || `pk_${columns.join("_")}`,
          type: "primary_key",
          columns,
        });
      }
    }

    // Unique constraints
    for (const uc of tableConfig.uniqueConstraints) {
      const columns = this.getUniqueConstraintColumns(uc);
      if (columns.length > 0) {
        const ucName = this.getUniqueConstraintName(uc);
        constraints.push({
          name: ucName || `uq_${columns.join("_")}`,
          type: "unique",
          columns,
        });
      }
    }

    // Foreign keys
    for (const fk of tableConfig.foreignKeys) {
      const fkDef = this.parseForeignKeyForConstraint(fk);
      if (fkDef) {
        constraints.push(fkDef);
      }
    }

    return constraints;
  }

  /**
   * Get the name of a primary key constraint
   *
   * @param pk - The primary key definition
   * @returns The constraint name or undefined
   */
  protected getPrimaryKeyName(pk: PrimaryKeyConfig): string | undefined {
    return pk.name;
  }

  /**
   * Get the name of a unique constraint
   *
   * @param uc - The unique constraint definition
   * @returns The constraint name or undefined
   */
  protected getUniqueConstraintName(uc: UniqueConstraintConfig): string | undefined {
    return uc.name;
  }

  /**
   * Parse a foreign key into a ConstraintDefinition
   *
   * @param fk - The foreign key definition
   * @returns ConstraintDefinition
   */
  protected parseForeignKeyForConstraint(fk: ForeignKeyConfig): ConstraintDefinition {
    const reference = fk.reference();
    const columns = reference.columns.map((c) => c.name);
    const referencedColumns = reference.foreignColumns.map((c) => c.name);
    const referencedTable = getTableName(reference.foreignTable);

    return {
      name: fk.name || `fk_${columns.join("_")}_${referencedTable}`,
      type: "foreign_key",
      columns,
      referencedTable,
      referencedColumns,
    };
  }

  /**
   * Convert a GeneratedRef to a RelationDefinition
   *
   * @param ref - The generated reference
   * @returns The relation definition
   */
  protected refToRelationDefinition(ref: GeneratedRef): RelationDefinition {
    // Map DBML ref type to IntermediateRelationType
    let relationType: IntermediateRelationType;
    switch (ref.type) {
      case "-":
        relationType = "one-to-one";
        break;
      case ">":
        relationType = "many-to-one";
        break;
      case "<":
        relationType = "one-to-many";
        break;
      default:
        relationType = "many-to-one";
    }

    return {
      fromTable: ref.fromTable,
      fromColumns: ref.fromColumns,
      toTable: ref.toTable,
      toColumns: ref.toColumns,
      type: relationType,
      onDelete: ref.onDelete,
      onUpdate: ref.onUpdate,
    };
  }

  /**
   * Collect enum definitions from the schema
   *
   * Override in subclasses for dialect-specific enum handling (e.g., PostgreSQL)
   *
   * @returns Array of enum definitions (empty by default)
   */
  protected collectEnumDefinitions(): EnumDefinition[] {
    // Default implementation returns empty array
    // Override in PgGenerator for PostgreSQL enum support
    return [];
  }
}

/**
 * Write DBML content to a file
 *
 * Creates the directory if it doesn't exist and writes the DBML content
 * to the specified file path.
 *
 * @param filePath - The path to write the DBML file to
 * @param content - The DBML content to write
 */
export function writeDbmlFile(filePath: string, content: string): void {
  const resolvedPath = resolve(filePath);
  const dir = dirname(resolvedPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolvedPath, content, "utf-8");
}
