/**
 * Build the qualified name of a table
 *
 * Tables in the default schema (no explicit `pgSchema(...)` / `mysqlSchema(...)`)
 * keep their bare name, while tables in a named schema are prefixed with it
 * (`billing.users`), so that same-named tables in different schemas stay distinct.
 *
 * @param tableName - The table name
 * @param schema - The database schema name, or undefined for the default schema
 * @returns The qualified table name
 */
export function qualifyTableName(tableName: string, schema: string | undefined): string {
  return schema ? `${schema}.${tableName}` : tableName;
}
