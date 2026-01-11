/**
 * drizzle-docs-generator
 *
 * A CLI tool that generates DBML files from Drizzle ORM schema definitions.
 *
 * TODO: コメント対応は構文木（TypeScript Compiler API）を使ったアプローチで実装予定
 * - parseSchemaWithComments() でソースファイルからJSDocコメントを抽出
 * - コメント情報をDBML出力時にNote句として自動反映
 */

// Schema parser (for AST-based comment extraction - future implementation)
export { parseSchema } from "./parser/index.js";

// DBML generators
export {
  pgGenerate,
  PgGenerator,
  mysqlGenerate,
  MySqlGenerator,
  sqliteGenerate,
  SqliteGenerator,
  generateDbml,
  BaseGenerator,
  DbmlBuilder,
  writeDbmlFile,
} from "./generator/index.js";

// Types
export type {
  GenerateOptions,
  GeneratedRef,
  ColumnAttributes,
  RelationType,
  // Legacy types
  ParsedSchema,
  ParsedTable,
  Column,
  Relation,
} from "./types.js";
