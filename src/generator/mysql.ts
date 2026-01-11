import type { AnyColumn } from "drizzle-orm";
import { BaseGenerator, writeDbmlFile, type DialectConfig } from "./common.js";
import type { GenerateOptions } from "../types.js";

/**
 * MySQL-specific DBML generator
 *
 * Supports JSDoc comment extraction via `sourceFile` or `comments` options.
 * Comments are included as DBML Note clauses for tables and columns.
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
 * To include JSDoc comments as DBML Note clauses, use the `sourceFile` option:
 * ```typescript
 * const dbml = mysqlGenerate({ schema: { users }, sourceFile: "./schema.ts" });
 * ```
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
