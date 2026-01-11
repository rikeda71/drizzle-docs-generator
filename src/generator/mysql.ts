import type { AnyColumn } from "drizzle-orm";
import { BaseGenerator, writeDbmlFile, type DialectConfig } from "./common.js";
import type { GenerateOptions } from "../types.js";

/**
 * MySQL-specific DBML generator
 *
 * TODO: コメント対応は構文木（TypeScript Compiler API）を使ったアプローチで実装予定
 * - JSDocコメントからテーブル/カラムのNoteを抽出
 * - ソースファイルのASTを解析してコメントをDBMLに反映
 */
export class MySqlGenerator<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> extends BaseGenerator<TSchema> {
  protected dialectConfig: DialectConfig = {
    escapeName: (name: string) => `\`${name}\``,
    isIncrement: (column: AnyColumn) => {
      // MySQL uses autoincrement property
      return (column as unknown as { autoIncrement?: boolean }).autoIncrement === true;
    },
  };
}

/**
 * Generate DBML from a MySQL Drizzle schema
 *
 * @example
 * ```ts
 * import { mysqlTable, serial, text, varchar } from "drizzle-orm/mysql-core";
 * import { mysqlGenerate } from "drizzle-docs-generator";
 *
 * const users = mysqlTable("users", {
 *   id: serial("id").primaryKey(),
 *   name: text("name").notNull(),
 *   email: varchar("email", { length: 255 }).unique(),
 * });
 *
 * const dbml = mysqlGenerate({ schema: { users } });
 * console.log(dbml);
 * ```
 *
 * TODO: コメント対応は構文木（TypeScript Compiler API）を使ったアプローチで実装予定
 * - parseSchemaWithComments() 関数でソースファイルからコメントを抽出
 * - コメント情報をDBML出力時にNote句として追加
 */
export function mysqlGenerate<TSchema extends Record<string, unknown>>(
  options: GenerateOptions<TSchema>,
): string {
  const generator = new MySqlGenerator(options);
  const dbml = generator.generate();

  if (options.out) {
    writeDbmlFile(options.out, dbml);
  }

  return dbml;
}
