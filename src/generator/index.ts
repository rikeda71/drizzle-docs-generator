import type { ParsedSchema, Table, Column } from "../types.js";

export function generateDbml(schema: ParsedSchema): string {
  const lines: string[] = [];

  for (const table of schema.tables) {
    lines.push(generateTable(table));
    lines.push("");
  }

  return lines.join("\n");
}

function generateTable(table: Table): string {
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
