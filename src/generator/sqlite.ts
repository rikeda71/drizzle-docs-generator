import type { AnyColumn } from "drizzle-orm";
import { BaseGenerator, writeDbmlFile, type DialectConfig } from "./common.js";
import type { GenerateOptions } from "../types.js";

/**
 * SQLite-specific DBML generator
 *
 * TODO: コメント対応は構文木（TypeScript Compiler API）を使ったアプローチで実装予定
 * - JSDocコメントからテーブル/カラムのNoteを抽出
 * - ソースファイルのASTを解析してコメントをDBMLに反映
 */
export class SqliteGenerator<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> extends BaseGenerator<TSchema> {
  protected dialectConfig: DialectConfig = {
    escapeName: (name: string) => `"${name}"`,
    isIncrement: (column: AnyColumn) => {
      // SQLite uses INTEGER PRIMARY KEY for autoincrement
      const sqlType = column.getSQLType().toLowerCase();
      return sqlType === "integer" && column.primary;
    },
  };
}

/**
 * Generate DBML from a SQLite Drizzle schema
 *
 * @example
 * ```ts
 * import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
 * import { sqliteGenerate } from "drizzle-docs-generator";
 *
 * const users = sqliteTable("users", {
 *   id: integer("id").primaryKey(),
 *   name: text("name").notNull(),
 *   email: text("email").unique(),
 * });
 *
 * const dbml = sqliteGenerate({ schema: { users } });
 * console.log(dbml);
 * ```
 *
 * TODO: コメント対応は構文木（TypeScript Compiler API）を使ったアプローチで実装予定
 * - parseSchemaWithComments() 関数でソースファイルからコメントを抽出
 * - コメント情報をDBML出力時にNote句として追加
 */
export function sqliteGenerate<TSchema extends Record<string, unknown>>(
  options: GenerateOptions<TSchema>,
): string {
  const generator = new SqliteGenerator(options);
  const dbml = generator.generate();

  if (options.out) {
    writeDbmlFile(options.out, dbml);
  }

  return dbml;
}
