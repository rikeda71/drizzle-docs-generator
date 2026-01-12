import { type Table, getTableName, is, One } from "drizzle-orm";
import type { AnyRelation, TableRelationalConfig } from "drizzle-orm/relations";
import type { RelationAdapter, UnifiedRelation } from "./types";

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
        const isOneToOne = this.hasReverseOneRelation(
          targetTableName,
          sourceTableName,
          targetColumns,
          sourceColumns,
        );

        relations.push({
          sourceTable: sourceTableName,
          sourceColumns,
          targetTable: targetTableName,
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
   * @param fromTableName - The table to search for reverse relation
   * @param toTableName - The expected target table of the reverse relation
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
    const fromEntry = this.entries.find((e) => getTableName(e.table as Table) === fromTableName);
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
}
