import {
  type AnyColumn,
  type Relations,
  type Table,
  getTableColumns,
  getTableName,
  is,
} from "drizzle-orm";
import {
  PgTable,
  getTableConfig as getPgTableConfig,
} from "drizzle-orm/pg-core";
import { MySqlTable, getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { SQLiteTable, getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GeneratedRef, GenerateOptions } from "../types.js";

/**
 * Simple DBML string builder
 */
export class DbmlBuilder {
  private lines: string[] = [];
  private indentLevel = 0;

  indent(): this {
    this.indentLevel++;
    return this;
  }

  dedent(): this {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
    return this;
  }

  line(content: string = ""): this {
    const indent = "  ".repeat(this.indentLevel);
    this.lines.push(content ? `${indent}${content}` : "");
    return this;
  }

  build(): string {
    return this.lines.join("\n");
  }
}

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

/**
 * Base generator class for DBML generation
 */
export abstract class BaseGenerator<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  protected schema: TSchema;
  protected relational: boolean;
  protected generatedRefs: GeneratedRef[] = [];
  protected abstract dialectConfig: DialectConfig;

  constructor(options: GenerateOptions<TSchema>) {
    this.schema = options.schema;
    this.relational = options.relational ?? false;
  }

  /**
   * Generate complete DBML output
   */
  generate(): string {
    const dbml = new DbmlBuilder();
    const tables = this.getTables();
    const relations = this.getRelations();

    // Generate tables
    for (const table of tables) {
      this.generateTable(dbml, table);
      dbml.line();
    }

    // Generate references
    if (this.relational && relations.length > 0) {
      this.generateRelationalRefs(dbml, relations);
    }

    // Add collected refs
    for (const ref of this.generatedRefs) {
      this.generateRef(dbml, ref);
    }

    return dbml.build().trim();
  }

  /**
   * Get all tables from schema
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
   */
  protected isTable(value: unknown): boolean {
    return (
      is(value, PgTable) || is(value, MySqlTable) || is(value, SQLiteTable)
    );
  }

  /**
   * Get all relations from schema
   */
  protected getRelations(): Relations[] {
    const relations: Relations[] = [];
    for (const value of Object.values(this.schema)) {
      if (this.isRelations(value)) {
        relations.push(value as Relations);
      }
    }
    return relations;
  }

  /**
   * Check if a value is a Drizzle relations object
   */
  protected isRelations(value: unknown): boolean {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    // Relations objects have 'table' and 'config' properties
    return (
      "table" in value &&
      "config" in value &&
      typeof (value as Record<string, unknown>).config === "object"
    );
  }

  /**
   * Generate a table definition
   */
  protected generateTable(dbml: DbmlBuilder, table: Table): void {
    const tableName = getTableName(table);
    const columns = getTableColumns(table);
    const escapedName = this.dialectConfig.escapeName(tableName);

    dbml.line(`Table ${escapedName} {`);
    dbml.indent();

    // Generate columns
    for (const column of Object.values(columns)) {
      this.generateColumn(dbml, column);
    }

    // Get table configuration (indexes, constraints, etc.)
    const tableConfig = this.getTableConfig(table);

    // Generate indexes block if any
    if (tableConfig) {
      this.generateIndexesBlock(dbml, tableConfig);
    }

    dbml.dedent();
    dbml.line("}");

    // Collect foreign keys if not using relational mode
    if (!this.relational && tableConfig && tableConfig.foreignKeys.length > 0) {
      this.collectForeignKeysFromConfig(tableName, tableConfig.foreignKeys);
    }
  }

  /**
   * Get table configuration (to be overridden by dialect-specific generators)
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
   * Generate a column definition
   */
  protected generateColumn(dbml: DbmlBuilder, column: AnyColumn): void {
    const name = this.dialectConfig.escapeName(column.name);
    const type = this.getColumnType(column);
    const attrs = this.getColumnAttributes(column);
    const attrStr = this.formatAttributes(attrs);

    if (attrStr) {
      dbml.line(`${name} ${type} [${attrStr}]`);
    } else {
      dbml.line(`${name} ${type}`);
    }
  }

  /**
   * Get the SQL type for a column
   */
  protected getColumnType(column: AnyColumn): string {
    return column.getSQLType();
  }

  /**
   * Get column attributes for DBML
   */
  protected getColumnAttributes(column: AnyColumn): string[] {
    const attrs: string[] = [];

    if (column.primary) {
      attrs.push("primary key");
    }
    if (column.notNull) {
      attrs.push("not null");
    }
    if (column.isUnique) {
      attrs.push("unique");
    }
    if (this.dialectConfig.isIncrement(column)) {
      attrs.push("increment");
    }

    const defaultValue = this.getDefaultValue(column);
    if (defaultValue !== undefined) {
      attrs.push(`default: ${defaultValue}`);
    }

    return attrs;
  }

  /**
   * Format attributes into a string
   */
  protected formatAttributes(attrs: string[]): string {
    return attrs.join(", ");
  }

  /**
   * Get the default value for a column
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
          } else if (
            typeof chunk === "object" &&
            chunk !== null &&
            "value" in chunk
          ) {
            sqlParts.push(String((chunk as { value: unknown }).value));
          }
        }
        return `\`${sqlParts.join("")}\``;
      }
      if ("sql" in defaultValue) {
        return `\`${(defaultValue as { sql: string }).sql}\``;
      }
      // JSON object
      return `'${JSON.stringify(defaultValue)}'`;
    }

    // Handle primitives
    if (typeof defaultValue === "string") {
      return `'${defaultValue.replace(/'/g, "\\'")}'`;
    }
    if (typeof defaultValue === "number" || typeof defaultValue === "boolean") {
      return String(defaultValue);
    }

    return undefined;
  }

  /**
   * Generate indexes block from table configuration
   */
  protected generateIndexesBlock(
    dbml: DbmlBuilder,
    tableConfig: TableConfig,
  ): void {
    const { indexes, primaryKeys, uniqueConstraints } = tableConfig;

    if (
      indexes.length === 0 &&
      primaryKeys.length === 0 &&
      uniqueConstraints.length === 0
    ) {
      return;
    }

    dbml.line();
    dbml.line("indexes {");
    dbml.indent();

    // Primary keys
    for (const pk of primaryKeys) {
      const columns = this.getPrimaryKeyColumns(pk);
      if (columns.length > 0) {
        const colStr = columns.map((c) => this.dialectConfig.escapeName(c)).join(", ");
        dbml.line(`(${colStr}) [pk]`);
      }
    }

    // Unique constraints
    for (const uc of uniqueConstraints) {
      const columns = this.getUniqueConstraintColumns(uc);
      if (columns.length > 0) {
        const colStr = columns.map((c) => this.dialectConfig.escapeName(c)).join(", ");
        dbml.line(`(${colStr}) [unique]`);
      }
    }

    // Regular indexes
    for (const idx of indexes) {
      const columns = this.getIndexColumns(idx);
      if (columns.length > 0) {
        const colStr = columns.map((c) => this.dialectConfig.escapeName(c)).join(", ");
        const attrs: string[] = [];
        if (this.isUniqueIndex(idx)) {
          attrs.push("unique");
        }
        const attrStr = attrs.length > 0 ? ` [${attrs.join(", ")}]` : "";
        dbml.line(`(${colStr})${attrStr}`);
      }
    }

    dbml.dedent();
    dbml.line("}");
  }

  /**
   * Collect foreign keys from table configuration
   */
  protected collectForeignKeysFromConfig(
    tableName: string,
    foreignKeys: unknown[],
  ): void {
    for (const fk of foreignKeys) {
      const ref = this.parseForeignKey(tableName, fk);
      if (ref) {
        this.generatedRefs.push(ref);
      }
    }
  }

  /**
   * Parse a foreign key into a GeneratedRef
   */
  protected parseForeignKey(
    tableName: string,
    fk: unknown,
  ): GeneratedRef | undefined {
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
   * Generate references from relations
   *
   * Note: Currently limited - relations() definitions require runtime evaluation
   * with helper functions (one, many). For now, use foreignKey() definitions
   * for generating DBML references.
   *
   * TODO: 構文木（TypeScript Compiler API）を使ったアプローチで
   * relations() 定義からもリファレンスを生成できるようにする
   */
  protected generateRelationalRefs(
    _dbml: DbmlBuilder,
    _relations: Relations[],
  ): void {
    // Relations require runtime evaluation with helper functions
    // which we cannot provide at DBML generation time.
    // Use foreignKey() definitions instead for references.
  }

  /**
   * Get unique key for a relation to avoid duplicates
   */
  protected getRelationKey(tableName: string, relation: unknown): string {
    const rel = relation as { referencedTable?: Table };
    const referencedTable = rel.referencedTable
      ? getTableName(rel.referencedTable)
      : "unknown";
    const tables = [tableName, referencedTable].sort();
    return `${tables[0]}-${tables[1]}`;
  }

  /**
   * Parse a relation into a GeneratedRef
   */
  protected parseRelation(
    tableName: string,
    relation: unknown,
  ): GeneratedRef | undefined {
    try {
      const rel = relation as {
        referencedTable?: Table;
        sourceColumns?: AnyColumn[];
        referencedColumns?: AnyColumn[];
        relationType?: string;
      };

      if (!rel.referencedTable) {
        return undefined;
      }

      const referencedTable = getTableName(rel.referencedTable);

      // Try to get field info from the relation
      const fields = rel.sourceColumns || [];
      const references = rel.referencedColumns || [];

      if (fields.length === 0 || references.length === 0) {
        // Cannot generate ref without column info
        return undefined;
      }

      const fromColumns = fields.map((c: AnyColumn) => c.name);
      const toColumns = references.map((c: AnyColumn) => c.name);

      // Determine relation type
      let type: "<" | ">" | "-" = ">";
      if (rel.relationType === "one") {
        type = "-";
      }

      return {
        fromTable: tableName,
        fromColumns,
        toTable: referencedTable,
        toColumns,
        type,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Generate a reference line
   */
  protected generateRef(dbml: DbmlBuilder, ref: GeneratedRef): void {
    const from = `${this.dialectConfig.escapeName(ref.fromTable)}.${ref.fromColumns.map((c) => this.dialectConfig.escapeName(c)).join(", ")}`;
    const to = `${this.dialectConfig.escapeName(ref.toTable)}.${ref.toColumns.map((c) => this.dialectConfig.escapeName(c)).join(", ")}`;

    let refLine = `Ref: ${from} ${ref.type} ${to}`;

    const attrs: string[] = [];
    if (ref.onDelete && ref.onDelete !== "no action") {
      attrs.push(`delete: ${ref.onDelete}`);
    }
    if (ref.onUpdate && ref.onUpdate !== "no action") {
      attrs.push(`update: ${ref.onUpdate}`);
    }

    if (attrs.length > 0) {
      refLine += ` [${attrs.join(", ")}]`;
    }

    dbml.line(refLine);
  }

  // Helper methods for extracting column information from constraints

  protected getIndexColumns(idx: unknown): string[] {
    try {
      const config = (idx as { config: { columns: Array<{ name?: string }> } }).config;
      return config.columns.map((c) => {
        if (typeof c === "object" && c !== null && "name" in c) {
          return c.name as string;
        }
        return "";
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  protected isUniqueIndex(idx: unknown): boolean {
    try {
      const config = (idx as { config: { unique?: boolean } }).config;
      return config.unique === true;
    } catch {
      return false;
    }
  }

  protected getPrimaryKeyColumns(pk: unknown): string[] {
    try {
      const columns = (pk as { columns: Array<{ name: string }> }).columns;
      return columns.map((c) => c.name);
    } catch {
      return [];
    }
  }

  protected getUniqueConstraintColumns(uc: unknown): string[] {
    try {
      const columns = (uc as { columns: Array<{ name: string }> }).columns;
      return columns.map((c) => c.name);
    } catch {
      return [];
    }
  }
}

/**
 * Write DBML content to a file
 */
export function writeDbmlFile(filePath: string, content: string): void {
  const resolvedPath = resolve(filePath);
  const dir = dirname(resolvedPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolvedPath, content, "utf-8");
}
