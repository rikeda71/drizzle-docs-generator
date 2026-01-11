/**
 * DBML Generator Module
 *
 * Provides functions to generate DBML from Drizzle ORM schema definitions.
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 *
 * JSDoc comments can be extracted from source files and included as DBML Note clauses.
 * Use the `source` option to specify the schema source file or directory, or pass pre-extracted
 * comments via the `comments` option.
 */

export { pgGenerate, PgGenerator } from "./pg.js";
export { mysqlGenerate, MySqlGenerator } from "./mysql.js";
export { sqliteGenerate, SqliteGenerator } from "./sqlite.js";
export { BaseGenerator, DbmlBuilder, writeDbmlFile } from "./common.js";
