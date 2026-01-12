import type {
  IntermediateSchema,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  ConstraintDefinition,
  RelationDefinition,
  EnumDefinition,
} from "../types";
import type { OutputFormatter, FormatterOptions } from "./types";

/**
 * Options for MarkdownFormatter
 */
export interface MarkdownFormatterOptions extends FormatterOptions {
  /**
   * Whether to use relative links for table references
   * @default true
   */
  useRelativeLinks?: boolean;
}

/**
 * Default formatter options
 */
const DEFAULT_OPTIONS: Required<MarkdownFormatterOptions> = {
  includeComments: true,
  includeIndexes: true,
  includeConstraints: true,
  useRelativeLinks: true,
};

/**
 * MarkdownFormatter converts IntermediateSchema to tbls-style Markdown format
 *
 * This formatter generates human-readable Markdown documentation from
 * the database-agnostic IntermediateSchema representation.
 *
 * Output includes:
 * - Table index (README.md style)
 * - Individual table documentation with columns, constraints, indexes, and relations
 */
export class MarkdownFormatter implements OutputFormatter {
  private options: Required<MarkdownFormatterOptions>;

  /**
   * Create a new MarkdownFormatter
   *
   * @param options - Formatter options
   */
  constructor(options: MarkdownFormatterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Format the intermediate schema into a single Markdown document
   *
   * This generates a complete document containing the index and all table docs.
   *
   * @param schema - The intermediate schema to format
   * @returns Markdown string
   */
  format(schema: IntermediateSchema): string {
    const lines: string[] = [];

    // Generate index section
    lines.push(this.generateIndex(schema));

    // Generate enum documentation if any
    if (schema.enums.length > 0) {
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push(this.generateEnumsSection(schema.enums));
    }

    // Generate table documentation
    for (const table of schema.tables) {
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push(this.generateTableDoc(table, schema));
    }

    return lines.join("\n").trim();
  }

  /**
   * Generate the index section (README.md style)
   *
   * @param schema - The intermediate schema
   * @returns Markdown string for the index
   */
  generateIndex(schema: IntermediateSchema): string {
    const lines: string[] = [];

    lines.push("# Tables");
    lines.push("");

    if (schema.tables.length === 0) {
      lines.push("No tables defined.");
      return lines.join("\n");
    }

    // Table header
    lines.push("| Name | Columns | Comment |");
    lines.push("|------|---------|---------|");

    // Table rows
    for (const table of schema.tables) {
      const name = this.options.useRelativeLinks
        ? `[${table.name}](#${this.slugify(table.name)})`
        : table.name;
      const columnCount = table.columns.length;
      const comment =
        this.options.includeComments && table.comment ? this.escapeMarkdown(table.comment) : "";

      lines.push(`| ${name} | ${columnCount} | ${comment} |`);
    }

    return lines.join("\n");
  }

  /**
   * Generate documentation for a single table
   *
   * @param table - The table definition
   * @param schema - The full schema (for relation lookups)
   * @returns Markdown string for the table documentation
   */
  generateTableDoc(table: TableDefinition, schema: IntermediateSchema): string {
    const lines: string[] = [];

    // Table heading with anchor
    lines.push(`## ${table.name}`);
    lines.push("");

    // Table comment
    if (this.options.includeComments && table.comment) {
      lines.push(this.escapeMarkdown(table.comment));
      lines.push("");
    }

    // Columns section
    lines.push(this.generateColumnsTable(table.columns, table.name, schema));

    // Constraints section
    if (this.options.includeConstraints && table.constraints.length > 0) {
      lines.push("");
      lines.push(this.generateConstraintsTable(table.constraints));
    }

    // Indexes section
    if (this.options.includeIndexes && table.indexes.length > 0) {
      lines.push("");
      lines.push(this.generateIndexesTable(table.indexes));
    }

    // Relations section
    const tableRelations = this.getTableRelations(table.name, schema.relations);
    if (tableRelations.length > 0) {
      lines.push("");
      lines.push(this.generateRelationsTable(tableRelations, table.name));
    }

    return lines.join("\n");
  }

  /**
   * Generate the columns table for a table
   */
  private generateColumnsTable(
    columns: ColumnDefinition[],
    tableName: string,
    schema: IntermediateSchema,
  ): string {
    const lines: string[] = [];

    lines.push("### Columns");
    lines.push("");

    if (columns.length === 0) {
      lines.push("No columns defined.");
      return lines.join("\n");
    }

    // Build column info with relations
    const columnInfo = columns.map((col) => {
      const children = this.getChildRelations(tableName, col.name, schema.relations);
      const parents = this.getParentRelations(tableName, col.name, schema.relations);
      return { column: col, children, parents };
    });

    // Table header
    lines.push("| Name | Type | Default | Nullable | Children | Parents | Comment |");
    lines.push("|------|------|---------|----------|----------|---------|---------|");

    // Table rows
    for (const { column, children, parents } of columnInfo) {
      const name = column.primaryKey ? `**${column.name}**` : column.name;
      const type = this.escapeMarkdown(column.type);
      const defaultVal = column.defaultValue !== undefined ? `\`${column.defaultValue}\`` : "-";
      const nullable = column.nullable ? "YES" : "NO";
      const childrenStr = children.length > 0 ? this.formatRelationLinks(children) : "-";
      const parentsStr = parents.length > 0 ? this.formatRelationLinks(parents) : "-";
      const comment =
        this.options.includeComments && column.comment ? this.escapeMarkdown(column.comment) : "-";

      lines.push(
        `| ${name} | ${type} | ${defaultVal} | ${nullable} | ${childrenStr} | ${parentsStr} | ${comment} |`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Generate the constraints table
   */
  private generateConstraintsTable(constraints: ConstraintDefinition[]): string {
    const lines: string[] = [];

    lines.push("### Constraints");
    lines.push("");

    lines.push("| Name | Type | Definition |");
    lines.push("|------|------|------------|");

    for (const constraint of constraints) {
      const name = constraint.name || "-";
      const type = this.formatConstraintType(constraint.type);
      const definition = this.formatConstraintDefinition(constraint);

      lines.push(`| ${name} | ${type} | ${definition} |`);
    }

    return lines.join("\n");
  }

  /**
   * Generate the indexes table
   */
  private generateIndexesTable(indexes: IndexDefinition[]): string {
    const lines: string[] = [];

    lines.push("### Indexes");
    lines.push("");

    lines.push("| Name | Columns | Unique | Type |");
    lines.push("|------|---------|--------|------|");

    for (const index of indexes) {
      const name = index.name || "-";
      const columns = index.columns.join(", ");
      const unique = index.unique ? "YES" : "NO";
      const type = index.type || "-";

      lines.push(`| ${name} | ${columns} | ${unique} | ${type} |`);
    }

    return lines.join("\n");
  }

  /**
   * Generate the relations table for a specific table
   */
  private generateRelationsTable(relations: RelationDefinition[], tableName: string): string {
    const lines: string[] = [];

    lines.push("### Relations");
    lines.push("");

    lines.push("| Parent | Child | Type |");
    lines.push("|--------|-------|------|");

    for (const relation of relations) {
      const isParent = relation.toTable === tableName;
      const parent = `${relation.toTable}.${relation.toColumns.join(", ")}`;
      const child = `${relation.fromTable}.${relation.fromColumns.join(", ")}`;
      const type = this.formatRelationType(relation.type);

      // Add links if enabled
      const parentLink = this.options.useRelativeLinks
        ? `[${parent}](#${this.slugify(relation.toTable)})`
        : parent;
      const childLink = this.options.useRelativeLinks
        ? `[${child}](#${this.slugify(relation.fromTable)})`
        : child;

      // Highlight the current table
      const parentDisplay = isParent ? `**${parentLink}**` : parentLink;
      const childDisplay = !isParent ? `**${childLink}**` : childLink;

      lines.push(`| ${parentDisplay} | ${childDisplay} | ${type} |`);
    }

    return lines.join("\n");
  }

  /**
   * Generate documentation for enums
   */
  private generateEnumsSection(enums: EnumDefinition[]): string {
    const lines: string[] = [];

    lines.push("# Enums");
    lines.push("");

    for (const enumDef of enums) {
      lines.push(`## ${enumDef.name}`);
      lines.push("");
      lines.push("| Value |");
      lines.push("|-------|");
      for (const value of enumDef.values) {
        lines.push(`| ${value} |`);
      }
      lines.push("");
    }

    return lines.join("\n").trim();
  }

  /**
   * Get all relations involving a specific table
   */
  private getTableRelations(
    tableName: string,
    relations: RelationDefinition[],
  ): RelationDefinition[] {
    return relations.filter((r) => r.fromTable === tableName || r.toTable === tableName);
  }

  /**
   * Get child relations for a specific column (where this column is referenced)
   */
  private getChildRelations(
    tableName: string,
    columnName: string,
    relations: RelationDefinition[],
  ): Array<{ table: string; column: string }> {
    return relations
      .filter((r) => r.toTable === tableName && r.toColumns.includes(columnName))
      .map((r) => ({
        table: r.fromTable,
        column: r.fromColumns.join(", "),
      }));
  }

  /**
   * Get parent relations for a specific column (columns this column references)
   */
  private getParentRelations(
    tableName: string,
    columnName: string,
    relations: RelationDefinition[],
  ): Array<{ table: string; column: string }> {
    return relations
      .filter((r) => r.fromTable === tableName && r.fromColumns.includes(columnName))
      .map((r) => ({
        table: r.toTable,
        column: r.toColumns.join(", "),
      }));
  }

  /**
   * Format relation links for display in columns table
   */
  private formatRelationLinks(relations: Array<{ table: string; column: string }>): string {
    return relations
      .map((r) => {
        const text = `${r.table}.${r.column}`;
        return this.options.useRelativeLinks ? `[${text}](#${this.slugify(r.table)})` : text;
      })
      .join(", ");
  }

  /**
   * Format constraint type for display
   */
  private formatConstraintType(type: ConstraintDefinition["type"]): string {
    const typeMap: Record<ConstraintDefinition["type"], string> = {
      primary_key: "PRIMARY KEY",
      foreign_key: "FOREIGN KEY",
      unique: "UNIQUE",
      check: "CHECK",
      not_null: "NOT NULL",
    };
    return typeMap[type] || type;
  }

  /**
   * Format constraint definition for display
   */
  private formatConstraintDefinition(constraint: ConstraintDefinition): string {
    if (constraint.definition) {
      return `\`${constraint.definition}\``;
    }

    const columns = constraint.columns.join(", ");

    if (constraint.type === "foreign_key" && constraint.referencedTable) {
      const refColumns = constraint.referencedColumns?.join(", ") || "";
      return `(${columns}) → ${constraint.referencedTable}(${refColumns})`;
    }

    return `(${columns})`;
  }

  /**
   * Format relation type for display
   */
  private formatRelationType(type: RelationDefinition["type"]): string {
    const typeMap: Record<RelationDefinition["type"], string> = {
      "one-to-one": "One to One",
      "one-to-many": "One to Many",
      "many-to-one": "Many to One",
      "many-to-many": "Many to Many",
    };
    return typeMap[type] || type;
  }

  /**
   * Create a URL-safe slug from a string
   */
  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Escape special Markdown characters in a string
   */
  private escapeMarkdown(str: string): string {
    return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
  }
}
