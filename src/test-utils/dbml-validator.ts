/**
 * DBML validation utilities for integration tests
 *
 * Provides functions to validate DBML output structure
 */

/**
 * Validate that the DBML output contains expected table definitions
 *
 * @param dbml - DBML output string
 * @param tableNames - Expected table names
 * @param quoteChar - Quote character used for identifiers (" for PG/SQLite, ` for MySQL)
 * @returns true if all tables are present
 */
export function hasAllTables(
  dbml: string,
  tableNames: string[],
  quoteChar: '"' | "`" = '"',
): boolean {
  return tableNames.every((name) => dbml.includes(`Table ${quoteChar}${name}${quoteChar} {`));
}

/**
 * Validate that the DBML output contains expected columns in a table
 *
 * @param dbml - DBML output string
 * @param tableName - Table name to check
 * @param columnNames - Expected column names
 * @param quoteChar - Quote character used for identifiers
 * @returns true if all columns are present
 */
export function hasAllColumns(
  dbml: string,
  tableName: string,
  columnNames: string[],
  quoteChar: '"' | "`" = '"',
): boolean {
  // Extract table block
  const tableStart = dbml.indexOf(`Table ${quoteChar}${tableName}${quoteChar} {`);
  if (tableStart === -1) return false;

  // Find matching closing brace
  let braceCount = 0;
  let tableEnd = tableStart;
  for (let i = tableStart; i < dbml.length; i++) {
    if (dbml[i] === "{") braceCount++;
    if (dbml[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        tableEnd = i;
        break;
      }
    }
  }

  const tableBlock = dbml.slice(tableStart, tableEnd);
  return columnNames.every((col) => tableBlock.includes(`${quoteChar}${col}${quoteChar}`));
}

/**
 * Check if DBML contains a reference (foreign key relationship)
 *
 * @param dbml - DBML output string
 * @param fromTable - Source table name
 * @param fromColumn - Source column name
 * @param toTable - Target table name
 * @param toColumn - Target column name
 * @param quoteChar - Quote character used for identifiers
 * @returns true if the reference exists
 */
export function hasReference(
  dbml: string,
  fromTable: string,
  fromColumn: string,
  toTable: string,
  toColumn: string,
  quoteChar: '"' | "`" = '"',
): boolean {
  const refPattern = `${quoteChar}${fromTable}${quoteChar}.${quoteChar}${fromColumn}${quoteChar}`;
  const targetPattern = `${quoteChar}${toTable}${quoteChar}.${quoteChar}${toColumn}${quoteChar}`;

  // Check for Ref: pattern with any relationship type (>, <, -)
  const refLine = `Ref: ${refPattern}`;
  return dbml.includes(refLine) && dbml.includes(targetPattern);
}

/**
 * Check if DBML contains indexes section for a table
 *
 * @param dbml - DBML output string
 * @param tableName - Table name to check
 * @param quoteChar - Quote character used for identifiers
 * @returns true if indexes section exists
 */
export function hasIndexes(dbml: string, tableName: string, quoteChar: '"' | "`" = '"'): boolean {
  // Find the table block
  const tableStart = dbml.indexOf(`Table ${quoteChar}${tableName}${quoteChar} {`);
  if (tableStart === -1) return false;

  // Find matching closing brace
  let braceCount = 0;
  let tableEnd = tableStart;
  for (let i = tableStart; i < dbml.length; i++) {
    if (dbml[i] === "{") braceCount++;
    if (dbml[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        tableEnd = i;
        break;
      }
    }
  }

  const tableBlock = dbml.slice(tableStart, tableEnd);
  return tableBlock.includes("indexes {");
}

/**
 * Check if DBML contains a Note clause for a table
 *
 * @param dbml - DBML output string
 * @param tableName - Table name to check
 * @param noteText - Expected note text (partial match)
 * @param quoteChar - Quote character used for identifiers
 * @returns true if the note exists
 */
export function hasTableNote(
  dbml: string,
  tableName: string,
  noteText: string,
  quoteChar: '"' | "`" = '"',
): boolean {
  // Find the table block
  const tableStart = dbml.indexOf(`Table ${quoteChar}${tableName}${quoteChar} {`);
  if (tableStart === -1) return false;

  // Find matching closing brace
  let braceCount = 0;
  let tableEnd = tableStart;
  for (let i = tableStart; i < dbml.length; i++) {
    if (dbml[i] === "{") braceCount++;
    if (dbml[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        tableEnd = i;
        break;
      }
    }
  }

  const tableBlock = dbml.slice(tableStart, tableEnd);
  return tableBlock.includes("Note:") && tableBlock.includes(noteText);
}

/**
 * Count the number of tables in DBML output
 *
 * @param dbml - DBML output string
 * @returns Number of tables
 */
export function countTables(dbml: string): number {
  const matches = dbml.match(/Table [`"][\w_]+[`"] \{/g);
  return matches ? matches.length : 0;
}

/**
 * Count the number of Ref statements in DBML output
 *
 * @param dbml - DBML output string
 * @returns Number of references
 */
export function countRefs(dbml: string): number {
  const matches = dbml.match(/^Ref:/gm);
  return matches ? matches.length : 0;
}

// ============================================
// Markdown validation utilities
// ============================================

/**
 * Check if Markdown output contains a table heading
 *
 * @param markdown - Markdown output string
 * @param tableName - Table name to check
 * @returns true if the table heading exists
 */
export function hasMarkdownTable(markdown: string, tableName: string): boolean {
  return markdown.includes(`## ${tableName}`);
}

/**
 * Check if Markdown output contains all expected table headings
 *
 * @param markdown - Markdown output string
 * @param tableNames - Expected table names
 * @returns true if all table headings are present
 */
export function hasAllMarkdownTables(markdown: string, tableNames: string[]): boolean {
  return tableNames.every((name) => hasMarkdownTable(markdown, name));
}

/**
 * Check if Markdown output contains an ER diagram
 *
 * @param markdown - Markdown output string
 * @returns true if ER diagram exists
 */
export function hasErDiagram(markdown: string): boolean {
  return markdown.includes("```mermaid") && markdown.includes("erDiagram");
}

/**
 * Check if Markdown output contains the Tables index
 *
 * @param markdown - Markdown output string
 * @returns true if index exists
 */
export function hasTablesIndex(markdown: string): boolean {
  return markdown.includes("# Tables");
}

/**
 * Check if Markdown output contains a Columns section for a table
 *
 * @param markdown - Markdown output string
 * @returns true if Columns section exists
 */
export function hasColumnsSection(markdown: string): boolean {
  return markdown.includes("### Columns");
}
