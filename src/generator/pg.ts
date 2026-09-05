import { type AnyColumn, getTableColumns, is } from "drizzle-orm";
import { PgEnumColumn, PgEnumObjectColumn } from "drizzle-orm/pg-core";
import { BaseGenerator, writeDbmlFile, type DialectConfig } from "./common";
import type { GenerateOptions, EnumDefinition } from "../types";

/**
 * Runtime shape of a pgEnum instance attached to an enum column
 */
interface PgEnumLike {
  enumName: string;
  enumValues: string[];
}

/**
 * PostgreSQL-specific DBML generator
 *
 * Supports JSDoc comment extraction via `sourceFile` or `comments` options.
 * Comments are included as DBML Note clauses for tables and columns.
 */
export class PgGenerator<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> extends BaseGenerator<TSchema> {
  protected dialectConfig: DialectConfig = {
    isIncrement: (column: AnyColumn) => {
      const sqlType = column.getSQLType().toLowerCase();
      return sqlType.includes("serial");
    },
  };

  /**
   * Collect all enum types from the schema
   */
  private collectEnums(): Map<string, string[]> {
    const enums = new Map<string, string[]>();
    const tables = this.getTables();

    for (const table of tables) {
      const columns = getTableColumns(table);

      for (const column of Object.values(columns)) {
        // Use drizzle's is() (entityKind brand check) instead of instanceof.
        // The schema may be loaded from a different drizzle-orm module instance
        // than the one this generator imports, in which case instanceof is always false.
        if (is(column, PgEnumColumn) || is(column, PgEnumObjectColumn)) {
          const enumObj = (column as unknown as { enum: PgEnumLike | undefined }).enum;
          if (enumObj && !enums.has(enumObj.enumName)) {
            enums.set(enumObj.enumName, [...enumObj.enumValues]);
          }
        }
      }
    }

    return enums;
  }

  /**
   * Collect enum definitions for intermediate schema
   *
   * Overrides the base implementation to extract PostgreSQL enum types
   * from enum columns in the schema, merging JSDoc comments extracted
   * from the source (enum-level and per-value) when available.
   *
   * @returns Array of enum definitions
   */
  protected override collectEnumDefinitions(): EnumDefinition[] {
    const enums = this.collectEnums();
    const enumDefinitions: EnumDefinition[] = [];

    for (const [name, values] of enums) {
      const enumComment = this.comments?.enums?.[name];
      const valueComments: Record<string, string> = {};
      for (const value of values) {
        const valueComment = enumComment?.values[value]?.comment;
        if (valueComment) {
          valueComments[value] = valueComment;
        }
      }

      enumDefinitions.push({
        name,
        values,
        comment: enumComment?.comment,
        valueComments: Object.keys(valueComments).length > 0 ? valueComments : undefined,
      });
    }

    return enumDefinitions;
  }
}

/**
 * Generate DBML from a PostgreSQL Drizzle schema
 *
 * @example
 * ```ts
 * import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
 * import { pgGenerate } from "drizzle-docs-generator";
 *
 * const users = pgTable("users", {
 *   id: serial("id").primaryKey(),
 *   name: text("name").notNull(),
 *   email: varchar("email", { length: 255 }).unique(),
 * });
 *
 * const dbml = pgGenerate({ schema: { users } });
 * console.log(dbml);
 * ```
 *
 * To include JSDoc comments as DBML Note clauses, use the `source` option:
 * ```typescript
 * const dbml = pgGenerate({ schema: { users }, source: "./schema.ts" });
 * ```
 */
export function pgGenerate<TSchema extends Record<string, unknown>>(
  options: GenerateOptions<TSchema>,
): string {
  const generator = new PgGenerator(options);
  const dbml = generator.generate();

  if (options.out) {
    writeDbmlFile(options.out, dbml);
  }

  return dbml;
}
