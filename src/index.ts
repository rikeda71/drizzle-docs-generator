/**
 * drizzle-docs-generator
 *
 * A CLI tool that generates DBML files from Drizzle ORM schema definitions.
 *
 * Supports extracting JSDoc comments from source files and including them
 * as DBML Note clauses using the TypeScript Compiler API.
 */

// Comment extraction from source files
export { extractComments } from "./parser/index";
export type { SchemaComments, TableComment, ColumnComment } from "./parser/index";

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
} from "./generator/index";

// Types
export type { GenerateOptions, GeneratedRef, ColumnAttributes, RelationType } from "./types";

// Intermediate Schema Types (for output formatters)
export type {
  DatabaseType,
  ColumnDefinition,
  IndexDefinition,
  ConstraintType,
  ConstraintDefinition,
  TableDefinition,
  IntermediateRelationType,
  RelationDefinition,
  EnumDefinition,
  IntermediateSchema,
} from "./types";
