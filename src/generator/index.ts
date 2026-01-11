/**
 * DBML Generator Module
 *
 * Provides functions to generate DBML from Drizzle ORM schema definitions.
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 *
 * TODO: コメント対応は構文木（TypeScript Compiler API）を使ったアプローチで実装予定
 * - parseSchemaWithComments() 関数でソースファイルからJSDocコメントを抽出
 * - コメント情報をDBML出力時にNote句として追加
 * - テーブルコメントとカラムコメントの両方に対応
 */

export { pgGenerate, PgGenerator } from "./pg.js";
export { mysqlGenerate, MySqlGenerator } from "./mysql.js";
export { sqliteGenerate, SqliteGenerator } from "./sqlite.js";
export { BaseGenerator, DbmlBuilder, writeDbmlFile } from "./common.js";

// Re-export legacy function for backward compatibility
import type { ParsedSchema, Column } from "../types.js";

/**
 * Generate DBML from a parsed schema (legacy API)
 *
 * @deprecated Use pgGenerate, mysqlGenerate, or sqliteGenerate instead
 */
export function generateDbml(schema: ParsedSchema): string {
  const lines: string[] = [];

  for (const table of schema.tables) {
    lines.push(generateTable(table));
    lines.push("");
  }

  return lines.join("\n");
}

interface LegacyTable {
  name: string;
  columns: Column[];
  comment?: string;
}

function generateTable(table: LegacyTable): string {
  const lines: string[] = [];

  lines.push(`Table ${table.name} {`);

  for (const column of table.columns) {
    lines.push(`  ${generateColumn(column)}`);
  }

  if (table.comment) {
    lines.push("");
    lines.push(`  Note: '${escapeString(table.comment)}'`);
  }

  lines.push("}");

  return lines.join("\n");
}

function generateColumn(column: Column): string {
  const parts: string[] = [column.name, column.type];
  const attributes: string[] = [];

  if (column.primaryKey) {
    attributes.push("primary key");
  }
  if (column.unique) {
    attributes.push("unique");
  }
  if (column.notNull) {
    attributes.push("not null");
  }
  if (column.default !== undefined) {
    attributes.push(`default: ${column.default}`);
  }
  if (column.comment) {
    attributes.push(`note: '${escapeString(column.comment)}'`);
  }

  if (attributes.length > 0) {
    parts.push(`[${attributes.join(", ")}]`);
  }

  return parts.join(" ");
}

function escapeString(str: string): string {
  return str.replace(/'/g, "\\'");
}
