import type {
  IntermediateSchema,
  TableDefinition,
  ColumnDefinition,
  RelationDefinition,
} from "../types";
import type { OutputFormatter, FormatterOptions } from "./types";

/**
 * Options for MermaidErDiagramFormatter
 */
export interface MermaidFormatterOptions extends FormatterOptions {
  /**
   * Whether to include column types in the diagram
   * @default true
   */
  includeColumnTypes?: boolean;
}

/**
 * Default formatter options
 */
const DEFAULT_OPTIONS: Required<MermaidFormatterOptions> = {
  includeComments: true,
  includeIndexes: true,
  includeConstraints: true,
  includeColumnTypes: true,
};

/**
 * MermaidErDiagramFormatter generates Mermaid ER diagram syntax from IntermediateSchema
 *
 * This formatter creates Mermaid-compatible ER diagrams that can be rendered
 * in GitHub, GitLab, or any Mermaid-supporting platform.
 *
 * @example
 * ```typescript
 * const formatter = new MermaidErDiagramFormatter();
 * const mermaid = formatter.format(schema);
 * // Output:
 * // erDiagram
 * //     users ||--o{ posts : "author_id"
 * //     users {
 * //         int id PK
 * //         varchar username
 * //     }
 * ```
 *
 * @see https://mermaid.js.org/syntax/entityRelationshipDiagram.html
 */
export class MermaidErDiagramFormatter implements OutputFormatter {
  private options: Required<MermaidFormatterOptions>;

  /**
   * Create a new MermaidErDiagramFormatter
   *
   * @param options - Formatter options
   */
  constructor(options: MermaidFormatterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Format the intermediate schema into a Mermaid ER diagram
   *
   * @param schema - The intermediate schema to format
   * @returns Mermaid ER diagram string
   */
  format(schema: IntermediateSchema): string {
    const lines: string[] = ["erDiagram"];

    // Collect foreign key columns for FK markers
    const fkColumns = this.collectForeignKeyColumns(schema.relations);

    // Generate relations first (at the top of the diagram)
    for (const relation of schema.relations) {
      const relationLine = this.formatRelation(relation);
      if (relationLine) {
        lines.push(`    ${relationLine}`);
      }
    }

    // Add blank line between relations and tables if there are both
    if (schema.relations.length > 0 && schema.tables.length > 0) {
      lines.push("");
    }

    // Generate tables
    for (const table of schema.tables) {
      const tableLines = this.formatTable(table, fkColumns);
      lines.push(...tableLines);
    }

    return lines.join("\n");
  }

  /**
   * Format a focused ER diagram showing only a specific table and its related tables
   *
   * @param schema - The intermediate schema
   * @param tableName - The name of the table to focus on
   * @returns Mermaid ER diagram string showing only the focused table and its relations
   */
  formatFocused(schema: IntermediateSchema, tableName: string): string {
    // Find the target table
    const targetTable = schema.tables.find((t) => t.name === tableName);
    if (!targetTable) {
      return "erDiagram";
    }

    // Find related tables through relations
    const relatedTableNames = new Set<string>([tableName]);
    const relevantRelations: RelationDefinition[] = [];

    for (const relation of schema.relations) {
      if (relation.fromTable === tableName || relation.toTable === tableName) {
        relatedTableNames.add(relation.fromTable);
        relatedTableNames.add(relation.toTable);
        relevantRelations.push(relation);
      }
    }

    // Filter tables to only include related ones
    const relevantTables = schema.tables.filter((t) => relatedTableNames.has(t.name));

    // Collect foreign key columns for FK markers
    const fkColumns = this.collectForeignKeyColumns(relevantRelations);

    const lines: string[] = ["erDiagram"];

    // Generate relations
    for (const relation of relevantRelations) {
      const relationLine = this.formatRelation(relation);
      if (relationLine) {
        lines.push(`    ${relationLine}`);
      }
    }

    // Add blank line between relations and tables if there are both
    if (relevantRelations.length > 0 && relevantTables.length > 0) {
      lines.push("");
    }

    // Generate tables
    for (const table of relevantTables) {
      const tableLines = this.formatTable(table, fkColumns);
      lines.push(...tableLines);
    }

    return lines.join("\n");
  }

  /**
   * Collect foreign key columns from relations for FK marker assignment
   */
  private collectForeignKeyColumns(relations: RelationDefinition[]): Map<string, Set<string>> {
    const fkColumns = new Map<string, Set<string>>();

    for (const relation of relations) {
      // The "from" side of the relation has the FK column
      if (!fkColumns.has(relation.fromTable)) {
        fkColumns.set(relation.fromTable, new Set());
      }
      for (const col of relation.fromColumns) {
        fkColumns.get(relation.fromTable)!.add(col);
      }
    }

    return fkColumns;
  }

  /**
   * Format a table definition to Mermaid syntax
   */
  private formatTable(table: TableDefinition, fkColumns: Map<string, Set<string>>): string[] {
    const lines: string[] = [];
    const tableName = this.escapeName(table.name);
    const tableFkColumns = fkColumns.get(table.name) || new Set();

    lines.push(`    ${tableName} {`);

    for (const column of table.columns) {
      const columnLine = this.formatColumn(column, tableFkColumns);
      lines.push(`        ${columnLine}`);
    }

    lines.push("    }");

    return lines;
  }

  /**
   * Format a column definition to Mermaid syntax
   */
  private formatColumn(column: ColumnDefinition, fkColumns: Set<string>): string {
    const parts: string[] = [];

    // Column type (simplified for Mermaid)
    if (this.options.includeColumnTypes) {
      parts.push(this.simplifyType(column.type));
    }

    // Column name
    parts.push(this.escapeName(column.name));

    // PK/FK markers
    const markers: string[] = [];
    if (column.primaryKey) {
      markers.push("PK");
    }
    if (fkColumns.has(column.name)) {
      markers.push("FK");
    }
    if (column.unique && !column.primaryKey) {
      markers.push("UK");
    }

    if (markers.length > 0) {
      parts.push(markers.join(","));
    }

    // Add comment as Mermaid comment (quoted string after markers)
    if (this.options.includeComments && column.comment) {
      parts.push(`"${this.escapeString(column.comment)}"`);
    }

    return parts.join(" ");
  }

  /**
   * Simplify SQL type for Mermaid display
   *
   * Mermaid ER diagrams work best with simple type names
   */
  private simplifyType(type: string): string {
    // Remove parentheses content for cleaner display (e.g., varchar(255) -> varchar)
    const simplified = type.replace(/\([^)]*\)/g, "").toLowerCase();

    // Map common types to shorter versions
    const typeMap: Record<string, string> = {
      integer: "int",
      bigint: "bigint",
      smallint: "smallint",
      serial: "serial",
      bigserial: "bigserial",
      text: "text",
      varchar: "varchar",
      char: "char",
      boolean: "boolean",
      timestamp: "timestamp",
      timestamptz: "timestamptz",
      "timestamp with time zone": "timestamptz",
      "time with time zone": "timetz",
      date: "date",
      time: "time",
      timetz: "timetz",
      json: "json",
      jsonb: "jsonb",
      uuid: "uuid",
      real: "real",
      float: "float",
      double: "double",
      decimal: "decimal",
      numeric: "numeric",
      blob: "blob",
      bytea: "bytea",
    };

    return typeMap[simplified] || simplified;
  }

  /**
   * Format a relation definition to Mermaid syntax
   *
   * Mermaid ER diagram relation syntax:
   * - ||--|| : one-to-one
   * - ||--o{ : one-to-many
   * - }o--|| : many-to-one
   * - }o--o{ : many-to-many
   */
  private formatRelation(relation: RelationDefinition): string {
    const fromTable = this.escapeName(relation.fromTable);
    const toTable = this.escapeName(relation.toTable);
    const symbol = this.getRelationSymbol(relation.type);
    const label = relation.fromColumns.join(", ");

    return `${fromTable} ${symbol} ${toTable} : "${label}"`;
  }

  /**
   * Convert IntermediateRelationType to Mermaid relation symbol
   *
   * @see https://mermaid.js.org/syntax/entityRelationshipDiagram.html#relationship-syntax
   */
  private getRelationSymbol(type: RelationDefinition["type"]): string {
    switch (type) {
      case "one-to-one":
        return "||--||";
      case "one-to-many":
        return "||--o{";
      case "many-to-one":
        return "}o--||";
      case "many-to-many":
        return "}o--o{";
    }
  }

  /**
   * Escape a name for Mermaid if it contains special characters
   *
   * Mermaid entity names should be alphanumeric with underscores
   */
  private escapeName(name: string): string {
    // Mermaid accepts alphanumeric and underscores
    // For names with special characters, we need to quote them
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return name;
    }
    // Replace special characters with underscores for Mermaid compatibility
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * Escape a string for use in Mermaid quoted strings
   */
  private escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
  }
}
