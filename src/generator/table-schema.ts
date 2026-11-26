import { type Table, is } from "drizzle-orm";
import { PgTable, getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { MySqlTable, getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";

/**
 * Get the database schema of a Drizzle table
 *
 * Returns the schema given to `pgSchema(...)` / `mysqlSchema(...)`, or undefined for
 * tables in the default schema (`pgTable`, `mysqlTable`) and SQLite tables (no schemas).
 *
 * @param table - The Drizzle table
 * @returns The schema name, or undefined for the default schema
 */
export function getTableSchema(table: Table): string | undefined {
  if (is(table, PgTable)) {
    return getPgTableConfig(table).schema;
  }
  if (is(table, MySqlTable)) {
    return getMySqlTableConfig(table).schema;
  }
  return undefined;
}
