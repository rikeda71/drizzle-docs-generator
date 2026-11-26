import { Column, type Table, getTableName, is, One } from "drizzle-orm";
import type {
  AnyRelation,
  RelationsBuilderColumnBase,
  TableRelationalConfig,
} from "drizzle-orm/relations";
import type { RelationAdapter, UnifiedRelation } from "./types";
import { getTableSchema } from "../generator/table-schema";
import { qualifyTableName } from "../table-name";

/**
 * Get the qualified name of a table (`billing.users`, or `users` in the default schema)
 *
 * Used as the identity of a table, so that same-named tables in different schemas
 * are not mistaken for one another.
 */
function getQualifiedName(table: Table): string {
  return qualifyTableName(getTableName(table), getTableSchema(table));
}

/**
 * Extract the database column name from a v1 RelationsBuilderColumnBase
 *
 * `sourceColumns`/`targetColumns` wrap the underlying FieldValue (Column | SQL | ...);
 * relation columns are always plain table columns, so narrow with `is()` to reach `.name`.
 */
function getRelationColumnName(col: RelationsBuilderColumnBase): string {
  const fieldValue = col._.column;
  if (!is(fieldValue, Column)) {
    throw new Error("Expected relation column to be a table column");
  }
  return fieldValue.name;
}

/**
 * Adapter for extracting relations from v1 defineRelations() API
 *
 * Handles the modern v1 defineRelations() format using official Drizzle types
 * (TableRelationalConfig, AnyRelation, One).
 */
export class V1RelationAdapter implements RelationAdapter {
  private entries: TableRelationalConfig[];

  /**
   * Create a new V1RelationAdapter
   *
   * @param entries - Array of v1 relation entries from defineRelations()
   */
  constructor(entries: TableRelationalConfig[]) {
    this.entries = entries;
  }

  /**
   * Extract relations from v1 defineRelations() entries
   *
   * Processes One relations to extract foreign key information and generates
   * relation definitions. Detects one-to-one relationships with bidirectional checks.
   *
   * @returns Array of unified relations
   */
  extract(): UnifiedRelation[] {
    const relations: UnifiedRelation[] = [];
    const processedRefs = new Set<string>();

    for (const entry of this.entries) {
      const sourceTable = entry.table as Table;
      const sourceTableName = getQualifiedName(sourceTable);

      for (const relation of Object.values(entry.relations)) {
        // Only process One relations as they define the FK direction
        // Many relations are the inverse and don't add new information
        if (!is(relation, One)) {
          continue;
        }

        // Skip reversed relations (they are auto-generated inverse relations)
        if ((relation as AnyRelation).isFilterReversed) {
          continue;
        }

        // Get source and target column names (using official Relation properties)
        const rel = relation as AnyRelation;
        const sourceColumns = rel.sourceColumns.map(getRelationColumnName);
        const targetColumns = rel.targetColumns.map(getRelationColumnName);

        if (sourceColumns.length === 0 || targetColumns.length === 0) {
          continue;
        }

        const targetTable = rel.targetTable as Table;
        const targetTableName = getQualifiedName(targetTable);

        // Create a unique key to avoid duplicate refs
        const refKey = `${sourceTableName}.${sourceColumns.join(",")}->${targetTableName}.${targetColumns.join(",")}`;
        const reverseRefKey = `${targetTableName}.${targetColumns.join(",")}->${sourceTableName}.${sourceColumns.join(",")}`;

        if (processedRefs.has(refKey) || processedRefs.has(reverseRefKey)) {
          continue;
        }
        processedRefs.add(refKey);

        // Check if there's a reverse one() relation (indicating one-to-one)
        const isOneToOne = this.hasReverseOneRelation(
          targetTableName,
          sourceTableName,
          targetColumns,
          sourceColumns,
        );

        relations.push({
          sourceTable: getTableName(sourceTable),
          sourceSchema: getTableSchema(sourceTable),
          sourceColumns,
          targetTable: getTableName(targetTable),
          targetSchema: getTableSchema(targetTable),
          targetColumns,
          relationType: isOneToOne ? "one-to-one" : "many-to-one",
        });
      }
    }

    return relations;
  }

  /**
   * Check if there's a reverse One relation in v1 entries
   *
   * Detects one-to-one relationships by checking if the target table
   * has a matching One relation pointing back to the source table.
   *
   * @param fromTableName - The qualified name of the table to search for reverse relation
   * @param toTableName - The expected qualified target table of the reverse relation
   * @param fromColumns - The expected source columns of the reverse relation
   * @param toColumns - The expected target columns of the reverse relation
   * @returns True if a matching reverse One relation exists
   */
  private hasReverseOneRelation(
    fromTableName: string,
    toTableName: string,
    fromColumns: string[],
    toColumns: string[],
  ): boolean {
    const fromEntry = this.entries.find(
      (e) => getQualifiedName(e.table as Table) === fromTableName,
    );
    if (!fromEntry) {
      return false;
    }

    for (const relation of Object.values(fromEntry.relations)) {
      if (!is(relation, One)) {
        continue;
      }

      const rel = relation as AnyRelation;
      const relTargetName = getQualifiedName(rel.targetTable as Table);
      if (relTargetName !== toTableName) {
        continue;
      }

      const relSourceCols = rel.sourceColumns.map(getRelationColumnName);
      const relTargetCols = rel.targetColumns.map(getRelationColumnName);

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
}
