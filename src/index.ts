/**
 * drizzle-docs-generator
 *
 * A CLI tool that generates DBML files from Drizzle ORM schema definitions.
 *
 * Supports extracting JSDoc comments from source files and including them
 * as DBML Note clauses using the TypeScript Compiler API.
 */

// Comment extraction from source files
export { extractComments } from "./parser/index.js";
export type { SchemaComments, TableComment, ColumnComment } from "./parser/index.js";

// DBML generators
export {
  pgGenerate,
  PgGenerator,
  mysqlGenerate,
  MySqlGenerator,
  sqliteGenerate,
  SqliteGenerator,
  BaseGenerator,
  DbmlBuilder,
  writeDbmlFile,
} from "./generator/index.js";

// Types
export type { GenerateOptions, GeneratedRef, ColumnAttributes, RelationType } from "./types.js";
