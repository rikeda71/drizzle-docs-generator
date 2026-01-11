import type { AnyColumn } from "drizzle-orm";
import { BaseGenerator, writeDbmlFile, type DialectConfig } from "./common.js";
import type { GenerateOptions } from "../types.js";

/**
 * SQLite-specific DBML generator
 *
 * Supports JSDoc comment extraction via `sourceFile` or `comments` options.
 * Comments are included as DBML Note clauses for tables and columns.
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
 * To include JSDoc comments as DBML Note clauses, use the `source` option:
 * ```typescript
 * const dbml = sqliteGenerate({ schema: { users }, source: "./schema.ts" });
 * ```
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
