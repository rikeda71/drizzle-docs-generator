import type {
  IntermediateSchema,
  TableDefinition,
  ColumnDefinition,
  RelationDefinition,
} from "../types";
import type { OutputFormatter, FormatterOptions } from "./types";
import { qualifyTableName } from "../table-name";

/**
 * Options for MermaidErDiagramFormatter
 */
export interface MermaidFormatterOptions extends FormatterOptions {
  /**
   * Whether to include column types in the diagram
   * @default true
   */
  includeColumnTypes: boolean;

  /**
   * Whether to include columns in the diagram
   * @default true
   */
  includeColumns: boolean;
}

/**
 * Default formatter options
 */
const DEFAULT_OPTIONS: Required<MermaidFormatterOptions> = {
  includeComments: true,
  includeIndexes: true,
  includeConstraints: true,
  includeColumnTypes: true,
  includeColumns: true,
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
   * @param options - Formatter options (all fields are optional and default to true)
   */
  constructor(options: Partial<MermaidFormatterOptions> = {}) {
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
    const entityNames = this.buildEntityNames(schema.tables);

    // Collect foreign key columns for FK markers
    const fkColumns = this.collectForeignKeyColumns(schema.relations);

    // Generate relations first (at the top of the diagram)
    for (const relation of schema.relations) {
      const relationLine = this.formatRelation(relation, schema.tables, entityNames);
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
      const tableLines = this.formatTable(table, fkColumns, entityNames);
      lines.push(...tableLines);
    }

    return lines.join("\n");
  }

  /**
   * Format a focused ER diagram showing only a specific table and its related tables
   *
   * @param schema - The intermediate schema
   * @param tableName - The name of the table to focus on
   *   (qualified with its schema for tables in a named schema, e.g. `billing.users`)
   * @returns Mermaid ER diagram string showing only the focused table and its relations
   */
  formatFocused(schema: IntermediateSchema, tableName: string): string {
    // Find the target table
    const targetTable = schema.tables.find((t) => this.getTableKey(t) === tableName);
    if (!targetTable) {
      return "erDiagram";
    }

    // Find related tables through relations
    const relatedTableNames = new Set<string>([tableName]);
    const relevantRelations: RelationDefinition[] = [];

    for (const relation of schema.relations) {
      const fromTable = this.getRelationFromTable(relation);
      const toTable = this.getRelationToTable(relation);
      if (fromTable === tableName || toTable === tableName) {
        relatedTableNames.add(fromTable);
        relatedTableNames.add(toTable);
        relevantRelations.push(relation);
      }
    }

    // Filter tables to only include related ones
    const relevantTables = schema.tables.filter((t) => relatedTableNames.has(this.getTableKey(t)));

    // Collect foreign key columns for FK markers
    const fkColumns = this.collectForeignKeyColumns(relevantRelations);

    const lines: string[] = ["erDiagram"];
    // Built from all tables, so that entity names match those of the full diagram
    const entityNames = this.buildEntityNames(schema.tables);

    // Generate relations
    for (const relation of relevantRelations) {
      const relationLine = this.formatRelation(relation, relevantTables, entityNames);
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
      const tableLines = this.formatTable(table, fkColumns, entityNames);
      lines.push(...tableLines);
    }

    return lines.join("\n");
  }

  /**
   * Get the qualified name of a table (`billing.users`, or `users` in the default schema)
   */
  private getTableKey(table: TableDefinition): string {
    return qualifyTableName(table.name, table.schema);
  }

  /**
   * Get the qualified name of the source table of a relation
   */
  private getRelationFromTable(relation: RelationDefinition): string {
    return qualifyTableName(relation.fromTable, relation.fromSchema);
  }

  /**
   * Get the qualified name of the target table of a relation
   */
  private getRelationToTable(relation: RelationDefinition): string {
    return qualifyTableName(relation.toTable, relation.toSchema);
  }

  /**
   * Build Mermaid entity names for tables, keyed by qualified table name
   *
   * Entity names are the escaped table names (`billing.users` -> `billing_users`).
   * When escaping makes two tables share an entity name (e.g., `billing_users` and
   * `billing.users`), a table whose name needs no escaping keeps it, and the others get
   * a numeric suffix (`billing_users_1`), so that each table stays a distinct entity.
   */
  private buildEntityNames(tables: TableDefinition[]): Map<string, string> {
    const entityNames = new Map<string, string>();
    const usedNames = new Set<string>();
    const tableKeys = tables.map((t) => this.getTableKey(t));

    // Names that need no escaping are kept as-is
    for (const tableKey of tableKeys) {
      if (this.escapeName(tableKey) === tableKey) {
        entityNames.set(tableKey, tableKey);
        usedNames.add(tableKey);
      }
    }

    for (const tableKey of tableKeys) {
      if (entityNames.has(tableKey)) {
        continue;
      }
      const base = this.escapeName(tableKey);
      let name = base;
      for (let i = 1; usedNames.has(name); i++) {
        name = `${base}_${i}`;
      }
      entityNames.set(tableKey, name);
      usedNames.add(name);
    }

    return entityNames;
  }

  /**
   * Get the Mermaid entity name of a table
   *
   * Falls back to the escaped name for tables that are not in the schema.
   */
  private getEntityName(tableKey: string, entityNames: Map<string, string>): string {
    return entityNames.get(tableKey) ?? this.escapeName(tableKey);
  }

  /**
   * Collect foreign key columns from relations for FK marker assignment
   *
   * Keyed by the qualified table name.
   */
  private collectForeignKeyColumns(relations: RelationDefinition[]): Map<string, Set<string>> {
    const fkColumns = new Map<string, Set<string>>();

    for (const relation of relations) {
      // The "from" side of the relation has the FK column
      const fromTable = this.getRelationFromTable(relation);
      if (!fkColumns.has(fromTable)) {
        fkColumns.set(fromTable, new Set());
      }
      for (const col of relation.fromColumns) {
        fkColumns.get(fromTable)!.add(col);
      }
    }

    return fkColumns;
  }

  /**
   * Check if a foreign key is nullable
   *
   * A foreign key is nullable if all of its columns are nullable
   */
  private isForeignKeyNullable(relation: RelationDefinition, tables: TableDefinition[]): boolean {
    // Find the table that contains the foreign key columns
    const fromTableName = this.getRelationFromTable(relation);
    const fromTable = tables.find((t) => this.getTableKey(t) === fromTableName);
    if (!fromTable) {
      return false;
    }

    // Check if all foreign key columns are nullable
    return relation.fromColumns.every((colName) => {
      const column = fromTable.columns.find((c) => c.name === colName);
      return column?.nullable ?? false;
    });
  }

  /**
   * Format a table definition to Mermaid syntax
   */
  private formatTable(
    table: TableDefinition,
    fkColumns: Map<string, Set<string>>,
    entityNames: Map<string, string>,
  ): string[] {
    const lines: string[] = [];
    const tableKey = this.getTableKey(table);
    const tableName = this.getEntityName(tableKey, entityNames);

    // If columns are not included, return table name only (without braces)
    if (!this.options.includeColumns) {
      lines.push(`    ${tableName}`);
      return lines;
    }

    const tableFkColumns = fkColumns.get(tableKey) || new Set();

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
      "double precision": "double",
      decimal: "decimal",
      numeric: "numeric",
      blob: "blob",
      bytea: "bytea",
      // MySQL types
      tinyint: "tinyint",
      mediumint: "mediumint",
      // MySQL unsigned types (u-prefix for distinction)
      "tinyint unsigned": "utinyint",
      "smallint unsigned": "usmallint",
      "mediumint unsigned": "umediumint",
      "int unsigned": "uint",
      "bigint unsigned": "ubigint",
      "float unsigned": "ufloat",
      "double unsigned": "udouble",
    };

    return typeMap[simplified] || simplified;
  }

  /**
   * Format a relation definition to Mermaid syntax
   *
   * Mermaid ER diagram relation syntax:
   * - ||--|| : one-to-one
   * - ||--o| : one-to-one, but target is optional
   * - ||--o{ : one-to-many
   * - }o--|| : many-to-one
   * - }o--o| : many-to-one, but source is optional
   * - }o--o{ : many-to-many
   */
  private formatRelation(
    relation: RelationDefinition,
    tables: TableDefinition[],
    entityNames: Map<string, string>,
  ): string {
    const fromTable = this.getEntityName(this.getRelationFromTable(relation), entityNames);
    const toTable = this.getEntityName(this.getRelationToTable(relation), entityNames);

    // Check if the foreign key columns are nullable
    const isForeignKeyNullable = this.isForeignKeyNullable(relation, tables);
    const symbol = this.getRelationSymbol(relation.type, isForeignKeyNullable);
    const label = relation.fromColumns.join(", ");

    return `${fromTable} ${symbol} ${toTable} : "${label}"`;
  }

  /**
   * Convert IntermediateRelationType to Mermaid relation symbol
   *
   * @param type - The relation type
   * @param isForeignKeyNullable - Whether the foreign key column(s) are nullable
   *
   * @see https://mermaid.js.org/syntax/entityRelationshipDiagram.html#relationship-syntax
   */
  private getRelationSymbol(
    type: RelationDefinition["type"],
    isForeignKeyNullable: boolean = false,
  ): string {
    switch (type) {
      case "one-to-one":
        return isForeignKeyNullable ? "||--o|" : "||--||";
      case "one-to-many":
        return "||--o{";
      case "many-to-one":
        return isForeignKeyNullable ? "}o--o|" : "}o--||";
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
