/**
 * drizzle-docs-generator
 *
 * A CLI tool that generates DBML files from Drizzle ORM schema definitions.
 *
 * Supports extracting JSDoc comments from source files and including them
 * as DBML Note clauses using the TypeScript Compiler API.
 */

// Comment extraction from source files
export { extractComments } from "./parser/comments";
export type { SchemaComments, TableComment, ColumnComment } from "./parser/comments";

// DBML generators
export { pgGenerate, PgGenerator } from "./generator/pg";
export { mysqlGenerate, MySqlGenerator } from "./generator/mysql";
export { sqliteGenerate, SqliteGenerator } from "./generator/sqlite";
export { BaseGenerator, writeDbmlFile } from "./generator/common";
export { DbmlBuilder } from "./formatter/dbml-builder";

// Types
export type { GenerateOptions, GeneratedRef } from "./types";

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

// Output Formatters
export { DbmlFormatter } from "./formatter/dbml";
export { MarkdownFormatter } from "./formatter/markdown";
export { MermaidErDiagramFormatter } from "./formatter/mermaid";
export type { OutputFormatter, FormatterOptions } from "./formatter/types";
export type { MarkdownFormatterOptions } from "./formatter/markdown";
export type { MermaidFormatterOptions } from "./formatter/mermaid";
