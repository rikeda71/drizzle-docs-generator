import {
  type AnyColumn,
  type Table,
  getTableColumns,
  getTableName,
  is,
  Relation,
  One,
} from "drizzle-orm";
import type { AnyRelation, TableRelationalConfig } from "drizzle-orm/relations";
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

/**
 * Configuration for different database dialects
 */
export interface DialectConfig {
  escapeName: (name: string) => string;
  isIncrement: (column: AnyColumn) => boolean;
}

/**
 * Table configuration extracted from Drizzle tables
 * Using 'any' types for dialect-agnostic handling
 */
export interface TableConfig {
  indexes: unknown[];
  primaryKeys: unknown[];
  uniqueConstraints: unknown[];
  foreignKeys: unknown[];
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
   *
   * @param table - The Drizzle table to get configuration from
   * @returns Table configuration or undefined if dialect is not supported
   */
  protected getTableConfig(table: Table): TableConfig | undefined {
    // Detect dialect and use appropriate config getter
    if (is(table, PgTable)) {
      const config = getPgTableConfig(table);
      return {
        indexes: config.indexes || [],
        primaryKeys: config.primaryKeys || [],
        uniqueConstraints: config.uniqueConstraints || [],
        foreignKeys: config.foreignKeys || [],
      };
    }
    if (is(table, MySqlTable)) {
      const config = getMySqlTableConfig(table);
      return {
        indexes: config.indexes || [],
        primaryKeys: config.primaryKeys || [],
        uniqueConstraints: config.uniqueConstraints || [],
        foreignKeys: config.foreignKeys || [],
      };
    }
    if (is(table, SQLiteTable)) {
      const config = getSqliteTableConfig(table);
      return {
        indexes: config.indexes || [],
        primaryKeys: config.primaryKeys || [],
        uniqueConstraints: config.uniqueConstraints || [],
        foreignKeys: config.foreignKeys || [],
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
  protected collectForeignKeysFromConfig(tableName: string, foreignKeys: unknown[]): void {
    for (const fk of foreignKeys) {
      const ref = this.parseForeignKey(tableName, fk);
      if (ref) {
        this.generatedRefs.push(ref);
      }
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
   * @returns GeneratedRef object or undefined if parsing fails
   */
  protected parseForeignKey(tableName: string, fk: unknown): GeneratedRef | undefined {
    try {
      const fkObj = fk as {
        reference: () => {
          columns: Array<{ name: string }>;
          foreignColumns: Array<{ name: string }>;
          foreignTable: Table;
        };
        onDelete?: string;
        onUpdate?: string;
      };
      const reference = fkObj.reference();
      const fromColumns = reference.columns.map((c) => c.name);
      const toColumns = reference.foreignColumns.map((c) => c.name);
      const toTable = getTableName(reference.foreignTable);

      return {
        fromTable: tableName,
        fromColumns,
        toTable,
        toColumns,
        type: ">",
        onDelete: fkObj.onDelete,
        onUpdate: fkObj.onUpdate,
      };
    } catch {
      return undefined;
    }
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
   * Check if there's a reverse one() relation (B->A when we have A->B)
   *
   * Used to detect one-to-one relationships by checking if both tables
   * have one() relations pointing to each other.
   *
   * @param sourceTable - The source table variable name
   * @param targetTable - The target table variable name
   * @param sourceFields - The source table's field names
   * @param targetReferences - The target table's reference column names
   * @returns True if a reverse one() relation exists
   */
  protected hasReverseOneRelation(
    sourceTable: string,
    targetTable: string,
    sourceFields: string[],
    targetReferences: string[],
  ): boolean {
    if (!this.parsedRelations) return false;

    // Look for a one() relation from targetTable to sourceTable
    for (const relation of this.parsedRelations.relations) {
      if (
        relation.type === "one" &&
        relation.sourceTable === targetTable &&
        relation.targetTable === sourceTable &&
        relation.fields.length > 0 &&
        relation.references.length > 0
      ) {
        // Check if the fields/references are the reverse of each other
        // A->B: fields=[A.col], references=[B.col]
        // B->A: fields=[B.col], references=[A.col]
        const reverseFields = relation.fields;
        const reverseReferences = relation.references;

        // The reverse relation's fields should match our references
        // and the reverse relation's references should match our fields
        if (
          this.arraysEqual(reverseFields, targetReferences) &&
          this.arraysEqual(reverseReferences, sourceFields)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Helper to check if two arrays are equal
   *
   * @param a - First array
   * @param b - Second array
   * @returns True if arrays have same length and same elements in order
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }

  /**
   * Generate references from v0 relations() API
   *
   * Uses TypeScript Compiler API to parse relations() definitions from source file
   * and extract fields/references to generate DBML Ref lines.
   *
   * Detects one-to-one relationships when bidirectional one() relations exist.
   */
  protected generateRelationalRefsFromV0(): void {
    if (!this.parsedRelations || this.parsedRelations.relations.length === 0) {
      return;
    }

    const tableNameMapping = this.getTableNameMapping();
    const processedRefs = new Set<string>();

    for (const parsedRelation of this.parsedRelations.relations) {
      // Only process one() relations with fields and references
      // many() relations are typically the inverse and don't have field info
      if (parsedRelation.type !== "one") {
        continue;
      }

      if (parsedRelation.fields.length === 0 || parsedRelation.references.length === 0) {
        continue;
      }

      // Map variable names to actual table names
      const fromTableName = tableNameMapping.get(parsedRelation.sourceTable);
      const toTableName = tableNameMapping.get(parsedRelation.targetTable);

      if (!fromTableName || !toTableName) {
        continue;
      }

      // Get column name mappings (TypeScript property names -> database column names)
      const fromColumnMapping = this.getColumnNameMapping(parsedRelation.sourceTable);
      const toColumnMapping = this.getColumnNameMapping(parsedRelation.targetTable);

      // Map TypeScript field names to database column names
      const fromColumns = parsedRelation.fields.map(
        (field) => fromColumnMapping.get(field) || field,
      );
      const toColumns = parsedRelation.references.map((ref) => toColumnMapping.get(ref) || ref);

      // Create a unique key to avoid duplicate refs (bidirectional)
      const refKey = `${fromTableName}.${fromColumns.join(",")}-${toTableName}.${toColumns.join(",")}`;
      const reverseRefKey = `${toTableName}.${toColumns.join(",")}-${fromTableName}.${fromColumns.join(",")}`;

      if (processedRefs.has(refKey) || processedRefs.has(reverseRefKey)) {
        continue;
      }
      processedRefs.add(refKey);

      // Check if this is a one-to-one relationship (bidirectional one())
      const isOneToOne = this.hasReverseOneRelation(
        parsedRelation.sourceTable,
        parsedRelation.targetTable,
        parsedRelation.fields,
        parsedRelation.references,
      );

      // Create GeneratedRef
      // one-to-one: "-", many-to-one: ">"
      const ref: GeneratedRef = {
        fromTable: fromTableName,
        fromColumns,
        toTable: toTableName,
        toColumns,
        type: isOneToOne ? "-" : ">",
      };

      this.generatedRefs.push(ref);
    }
  }

  /**
   * Generate references from v1 defineRelations() entries
   *
   * Uses official Drizzle v1 types (TableRelationalConfig, Relation, One).
   * Processes One relations to extract foreign key information and generates
   * DBML Ref lines. Detects one-to-one relationships with bidirectional checks.
   *
   * @param entries - Array of v1 relation entries from defineRelations()
   */
  protected generateRelationalRefsFromV1(entries: TableRelationalConfig[]): void {
    const processedRefs = new Set<string>();

    for (const entry of entries) {
      const sourceTableName = getTableName(entry.table as Table);

      for (const relation of Object.values(entry.relations)) {
        // Only process One relations as they define the FK direction
        // Many relations are the inverse and don't add new information
        if (!is(relation, One)) {
          continue;
        }

        // Skip reversed relations (they are auto-generated inverse relations)
        if ((relation as AnyRelation).isReversed) {
          continue;
        }

        // Get source and target column names (using official Relation properties)
        const rel = relation as AnyRelation;
        const sourceColumns = rel.sourceColumns.map((col) => col.name);
        const targetColumns = rel.targetColumns.map((col) => col.name);

        if (sourceColumns.length === 0 || targetColumns.length === 0) {
          continue;
        }

        const targetTableName = getTableName(rel.targetTable as Table);

        // Create a unique key to avoid duplicate refs
        const refKey = `${sourceTableName}.${sourceColumns.join(",")}->${targetTableName}.${targetColumns.join(",")}`;
        const reverseRefKey = `${targetTableName}.${targetColumns.join(",")}->${sourceTableName}.${sourceColumns.join(",")}`;

        if (processedRefs.has(refKey) || processedRefs.has(reverseRefKey)) {
          continue;
        }
        processedRefs.add(refKey);

        // Check if there's a reverse one() relation (indicating one-to-one)
        const isOneToOne = this.hasV1ReverseOneRelation(
          entries,
          targetTableName,
          sourceTableName,
          targetColumns,
          sourceColumns,
        );

        const ref: GeneratedRef = {
          fromTable: sourceTableName,
          fromColumns: sourceColumns,
          toTable: targetTableName,
          toColumns: targetColumns,
          type: isOneToOne ? "-" : ">",
        };

        this.generatedRefs.push(ref);
      }
    }
  }

  /**
   * Check if there's a reverse One relation in v1 entries
   *
   * Detects one-to-one relationships by checking if the target table
   * has a matching One relation pointing back to the source table.
   *
   * @param entries - All v1 relation entries
   * @param fromTableName - The table to search for reverse relation
   * @param toTableName - The expected target table of the reverse relation
   * @param fromColumns - The expected source columns of the reverse relation
   * @param toColumns - The expected target columns of the reverse relation
   * @returns True if a matching reverse One relation exists
   */
  protected hasV1ReverseOneRelation(
    entries: TableRelationalConfig[],
    fromTableName: string,
    toTableName: string,
    fromColumns: string[],
    toColumns: string[],
  ): boolean {
    const fromEntry = entries.find((e) => getTableName(e.table as Table) === fromTableName);
    if (!fromEntry) {
      return false;
    }

    for (const relation of Object.values(fromEntry.relations)) {
      if (!is(relation, One)) {
        continue;
      }

      const rel = relation as AnyRelation;
      const relTargetName = getTableName(rel.targetTable as Table);
      if (relTargetName !== toTableName) {
        continue;
      }

      const relSourceCols = rel.sourceColumns.map((col) => col.name);
      const relTargetCols = rel.targetColumns.map((col) => col.name);

      // Check if columns match in reverse
      if (
        relSourceCols.length === fromColumns.length &&
        relTargetCols.length === toColumns.length &&
        relSourceCols.every((col, i) => col === fromColumns[i]) &&
        relTargetCols.every((col, i) => col === toColumns[i])
      ) {
        return true;
      }
    }

    return false;
  }

  // Helper methods for extracting column information from constraints

  /**
   * Get column names from an index definition
   *
   * @param idx - The index definition to extract columns from
   * @returns Array of column names in the index
   */
  protected getIndexColumns(idx: unknown): string[] {
    try {
      const config = (idx as { config: { columns: Array<{ name?: string }> } }).config;
      return config.columns
        .map((c) => {
          if (typeof c === "object" && c !== null && "name" in c) {
            return c.name as string;
          }
          return "";
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Check if an index is unique
   *
   * @param idx - The index definition to check
   * @returns True if the index has the unique flag
   */
  protected isUniqueIndex(idx: unknown): boolean {
    try {
      const config = (idx as { config: { unique?: boolean } }).config;
      return config.unique === true;
    } catch {
      return false;
    }
  }

  /**
   * Get column names from a primary key constraint
   *
   * @param pk - The primary key definition to extract columns from
   * @returns Array of column names in the primary key
   */
  protected getPrimaryKeyColumns(pk: unknown): string[] {
    try {
      const columns = (pk as { columns: Array<{ name: string }> }).columns;
      return columns.map((c) => c.name);
    } catch {
      return [];
    }
  }

  /**
   * Get column names from a unique constraint
   *
   * @param uc - The unique constraint definition to extract columns from
   * @returns Array of column names in the unique constraint
   */
  protected getUniqueConstraintColumns(uc: unknown): string[] {
    try {
      const columns = (uc as { columns: Array<{ name: string }> }).columns;
      return columns.map((c) => c.name);
    } catch {
      return [];
    }
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
    const v0Relations = this.getV0Relations();
    const v1Entries = this.getV1RelationEntries();

    // Determine database type from the first table
    const databaseType = this.getDatabaseType(tables[0]);

    // Convert tables to intermediate format
    const tableDefinitions: TableDefinition[] = tables.map((table) =>
      this.tableToDefinition(table),
    );

    // Collect relations
    // Reset generatedRefs to collect fresh relations
    this.generatedRefs = [];

    if (this.relational) {
      if (v1Entries.length > 0) {
        this.generateRelationalRefsFromV1(v1Entries);
      } else if (v0Relations.length > 0 || this.parsedRelations) {
        this.generateRelationalRefsFromV0();
      }
    } else {
      // Collect foreign keys from table configs
      for (const table of tables) {
        const tableName = getTableName(table);
        const tableConfig = this.getTableConfig(table);
        if (tableConfig && tableConfig.foreignKeys.length > 0) {
          this.collectForeignKeysFromConfig(tableName, tableConfig.foreignKeys);
        }
      }
    }

    // Convert GeneratedRefs to RelationDefinitions
    const relations: RelationDefinition[] = this.generatedRefs.map((ref) =>
      this.refToRelationDefinition(ref),
    );

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
  protected getIndexName(idx: unknown): string | undefined {
    try {
      const config = (idx as { config: { name?: string } }).config;
      return config.name;
    } catch {
      return undefined;
    }
  }

  /**
   * Get the type of an index (e.g., btree, hash)
   *
   * @param idx - The index definition
   * @returns The index type or undefined
   */
  protected getIndexType(idx: unknown): string | undefined {
    try {
      const config = (idx as { config: { using?: string } }).config;
      return config.using;
    } catch {
      return undefined;
    }
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
  protected getPrimaryKeyName(pk: unknown): string | undefined {
    try {
      const pkObj = pk as { name?: string };
      return pkObj.name;
    } catch {
      return undefined;
    }
  }

  /**
   * Get the name of a unique constraint
   *
   * @param uc - The unique constraint definition
   * @returns The constraint name or undefined
   */
  protected getUniqueConstraintName(uc: unknown): string | undefined {
    try {
      const ucObj = uc as { name?: string };
      return ucObj.name;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse a foreign key into a ConstraintDefinition
   *
   * @param fk - The foreign key definition
   * @returns ConstraintDefinition or undefined
   */
  protected parseForeignKeyForConstraint(fk: unknown): ConstraintDefinition | undefined {
    try {
      const fkObj = fk as {
        reference: () => {
          columns: Array<{ name: string }>;
          foreignColumns: Array<{ name: string }>;
          foreignTable: Table;
        };
        name?: string;
      };
      const reference = fkObj.reference();
      const columns = reference.columns.map((c) => c.name);
      const referencedColumns = reference.foreignColumns.map((c) => c.name);
      const referencedTable = getTableName(reference.foreignTable);

      return {
        name: fkObj.name || `fk_${columns.join("_")}_${referencedTable}`,
        type: "foreign_key",
        columns,
        referencedTable,
        referencedColumns,
      };
    } catch {
      return undefined;
    }
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
