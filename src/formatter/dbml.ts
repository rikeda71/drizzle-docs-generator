import type {
  IntermediateSchema,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  RelationDefinition,
  EnumDefinition,
} from "../types";
import type { OutputFormatter, FormatterOptions } from "./types";
import { DbmlBuilder } from "../generator/common";

/**
 * Default formatter options
 */
const DEFAULT_OPTIONS: Required<FormatterOptions> = {
  includeComments: true,
  includeIndexes: true,
  includeConstraints: true,
};

/**
 * DbmlFormatter converts IntermediateSchema to DBML format
 *
 * This formatter wraps the existing DbmlBuilder to provide DBML output
 * from the database-agnostic IntermediateSchema representation.
 */
export class DbmlFormatter implements OutputFormatter {
  private options: Required<FormatterOptions>;

  /**
   * Create a new DbmlFormatter
   *
   * @param options - Formatter options
   */
  constructor(options: FormatterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Format the intermediate schema into DBML
   *
   * @param schema - The intermediate schema to format
   * @returns DBML string
   */
  format(schema: IntermediateSchema): string {
    const dbml = new DbmlBuilder();

    // Generate enums (PostgreSQL specific)
    for (const enumDef of schema.enums) {
      this.formatEnum(dbml, enumDef);
      dbml.line();
    }

    // Generate tables
    for (const table of schema.tables) {
      this.formatTable(dbml, table);
      dbml.line();
    }

    // Generate relations
    for (const relation of schema.relations) {
      this.formatRelation(dbml, relation);
    }

    return dbml.build().trim();
  }

  /**
   * Format an enum definition to DBML
   */
  private formatEnum(dbml: DbmlBuilder, enumDef: EnumDefinition): void {
    const name = this.escapeName(enumDef.name);
    dbml.line(`Enum ${name} {`);
    dbml.indent();
    for (const value of enumDef.values) {
      dbml.line(value);
    }
    dbml.dedent();
    dbml.line("}");
  }

  /**
   * Format a table definition to DBML
   */
  private formatTable(dbml: DbmlBuilder, table: TableDefinition): void {
    const tableName = this.escapeName(table.name);
    dbml.line(`Table ${tableName} {`);
    dbml.indent();

    // Generate columns
    for (const column of table.columns) {
      this.formatColumn(dbml, column);
    }

    // Generate indexes block if enabled and there are indexes
    if (this.options.includeIndexes && table.indexes.length > 0) {
      this.formatIndexes(dbml, table.indexes);
    }

    // Add table-level Note if comment exists and comments are enabled
    if (this.options.includeComments && table.comment) {
      dbml.line();
      dbml.line(`Note: '${this.escapeString(table.comment)}'`);
    }

    dbml.dedent();
    dbml.line("}");
  }

  /**
   * Format a column definition to DBML
   */
  private formatColumn(dbml: DbmlBuilder, column: ColumnDefinition): void {
    const name = this.escapeName(column.name);
    const type = column.type;
    const attrs = this.getColumnAttributes(column);
    const attrStr = attrs.join(", ");

    if (attrStr) {
      dbml.line(`${name} ${type} [${attrStr}]`);
    } else {
      dbml.line(`${name} ${type}`);
    }
  }

  /**
   * Get column attributes for DBML
   */
  private getColumnAttributes(column: ColumnDefinition): string[] {
    const attrs: string[] = [];

    if (column.primaryKey) {
      attrs.push("primary key");
    }
    if (!column.nullable) {
      attrs.push("not null");
    }
    if (column.unique) {
      attrs.push("unique");
    }
    if (column.autoIncrement) {
      attrs.push("increment");
    }
    if (column.defaultValue !== undefined) {
      attrs.push(`default: ${this.formatDefaultValue(column.defaultValue)}`);
    }
    if (this.options.includeComments && column.comment) {
      attrs.push(`note: '${this.escapeString(column.comment)}'`);
    }

    return attrs;
  }

  /**
   * Format a default value for DBML
   */
  private formatDefaultValue(value: string): string {
    // If it looks like a SQL expression (contains parentheses or is a known function)
    if (value.includes("(") || value.includes("::") || this.isKnownSqlFunction(value)) {
      return `\`${value}\``;
    }
    // If it's null
    if (value === "null" || value === "NULL") {
      return "null";
    }
    // If it's a boolean
    if (value === "true" || value === "false") {
      return value;
    }
    // If it's a number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return value;
    }
    // Otherwise treat as string
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  /**
   * Check if a value is a known SQL function/expression
   */
  private isKnownSqlFunction(value: string): boolean {
    const sqlKeywords = [
      "now",
      "current_timestamp",
      "current_date",
      "current_time",
      "gen_random_uuid",
      "uuid_generate_v4",
      "autoincrement",
      "auto_increment",
    ];
    return sqlKeywords.some((kw) => value.toLowerCase().includes(kw));
  }

  /**
   * Format indexes block to DBML
   */
  private formatIndexes(dbml: DbmlBuilder, indexes: IndexDefinition[]): void {
    dbml.line();
    dbml.line("indexes {");
    dbml.indent();

    for (const index of indexes) {
      const columns = index.columns.map((c) => this.escapeName(c)).join(", ");
      const attrs: string[] = [];

      if (index.unique) {
        attrs.push("unique");
      }
      if (index.name) {
        attrs.push(`name: '${index.name}'`);
      }
      if (index.type) {
        attrs.push(`type: ${index.type}`);
      }

      const attrStr = attrs.length > 0 ? ` [${attrs.join(", ")}]` : "";
      dbml.line(`(${columns})${attrStr}`);
    }

    dbml.dedent();
    dbml.line("}");
  }

  /**
   * Format a relation definition to DBML Ref
   */
  private formatRelation(dbml: DbmlBuilder, relation: RelationDefinition): void {
    const from = `${this.escapeName(relation.fromTable)}.${relation.fromColumns.map((c) => this.escapeName(c)).join(", ")}`;
    const to = `${this.escapeName(relation.toTable)}.${relation.toColumns.map((c) => this.escapeName(c)).join(", ")}`;
    const type = this.getRelationType(relation.type);

    let refLine = `Ref: ${from} ${type} ${to}`;

    const attrs: string[] = [];
    if (relation.onDelete && relation.onDelete.toLowerCase() !== "no action") {
      attrs.push(`delete: ${relation.onDelete.toLowerCase()}`);
    }
    if (relation.onUpdate && relation.onUpdate.toLowerCase() !== "no action") {
      attrs.push(`update: ${relation.onUpdate.toLowerCase()}`);
    }

    if (attrs.length > 0) {
      refLine += ` [${attrs.join(", ")}]`;
    }

    dbml.line(refLine);
  }

  /**
   * Convert IntermediateRelationType to DBML relation symbol
   */
  private getRelationType(type: RelationDefinition["type"]): "<" | ">" | "-" | "<>" {
    switch (type) {
      case "one-to-one":
        return "-";
      case "one-to-many":
        return "<";
      case "many-to-one":
        return ">";
      case "many-to-many":
        return "<>";
    }
  }

  /**
   * Escape a name for DBML if it contains special characters
   */
  private escapeName(name: string): string {
    // DBML requires quoting names with special characters or reserved words
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return name;
    }
    return `"${name}"`;
  }

  /**
   * Escape a string for use in DBML single-quoted strings
   */
  private escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
  }
}
