import { type Table, getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { MySqlTable } from "drizzle-orm/mysql-core";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { SchemaRelations } from "../parser/relations";
import type { RelationAdapter, UnifiedRelation } from "./types";

/**
 * Adapter for extracting relations from v0 relations() API
 *
 * Handles the legacy relations() format by parsing relation definitions
 * from the TypeScript source using the schema parser.
 */
export class V0RelationAdapter implements RelationAdapter {
  private schema: Record<string, unknown>;
  private parsedRelations: SchemaRelations | undefined;
  private tableNameMapping: Map<string, string>;
  private columnNameMappings: Map<string, Map<string, string>>;

  /**
   * Create a new V0RelationAdapter
   *
   * @param schema - The Drizzle schema object containing tables
   * @param parsedRelations - Parsed relation information from TypeScript source
   */
  constructor(schema: Record<string, unknown>, parsedRelations: SchemaRelations | undefined) {
    this.schema = schema;
    this.parsedRelations = parsedRelations;
    this.tableNameMapping = this.buildTableNameMapping();
    this.columnNameMappings = new Map();
  }

  /**
   * Extract relations from v0 relations() definitions
   *
   * Processes parsed relation information to extract foreign key relationships,
   * determining relation types (one-to-one vs many-to-one) based on bidirectional
   * analysis.
   *
   * @returns Array of unified relations
   */
  extract(): UnifiedRelation[] {
    if (!this.parsedRelations || this.parsedRelations.relations.length === 0) {
      return [];
    }

    const relations: UnifiedRelation[] = [];
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
      const fromTableName = this.tableNameMapping.get(parsedRelation.sourceTable);
      const toTableName = this.tableNameMapping.get(parsedRelation.targetTable);

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

      // Create UnifiedRelation
      relations.push({
        sourceTable: fromTableName,
        sourceColumns: fromColumns,
        targetTable: toTableName,
        targetColumns: toColumns,
        relationType: isOneToOne ? "one-to-one" : "many-to-one",
      });
    }

    return relations;
  }

  /**
   * Build a mapping from variable names to table names
   *
   * @returns Map of variable names to database table names
   */
  private buildTableNameMapping(): Map<string, string> {
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
   * Check if a value is a Drizzle table
   *
   * @param value - The value to check
   * @returns True if value is a table
   */
  private isTable(value: unknown): boolean {
    return is(value, PgTable) || is(value, MySqlTable) || is(value, SQLiteTable);
  }

  /**
   * Get column name mapping for a table
   *
   * @param tableVarName - The variable name of the table
   * @returns Map of property names to database column names
   */
  private getColumnNameMapping(tableVarName: string): Map<string, string> {
    // Check cache first
    if (this.columnNameMappings.has(tableVarName)) {
      return this.columnNameMappings.get(tableVarName)!;
    }

    const mapping = new Map<string, string>();
    const table = this.schema[tableVarName];
    if (table && this.isTable(table)) {
      const columns = getTableColumns(table as Table);
      for (const [propName, column] of Object.entries(columns)) {
        mapping.set(propName, column.name);
      }
    }

    // Cache the mapping
    this.columnNameMappings.set(tableVarName, mapping);
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
  private hasReverseOneRelation(
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
}
