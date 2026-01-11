import { type AnyColumn, getTableColumns } from "drizzle-orm";
import { PgEnumColumn } from "drizzle-orm/pg-core";
import { BaseGenerator, DbmlBuilder, writeDbmlFile, type DialectConfig } from "./common.js";
import type { GenerateOptions } from "../types.js";

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
    escapeName: (name: string) => `"${name}"`,
    isIncrement: (column: AnyColumn) => {
      const sqlType = column.getSQLType().toLowerCase();
      return sqlType.includes("serial");
    },
  };

  /**
   * Generate DBML including PostgreSQL-specific constructs like enums
   */
  override generate(): string {
    const dbml = new DbmlBuilder();

    // Generate enums first
    const enums = this.collectEnums();
    for (const [name, values] of enums) {
      this.generateEnum(dbml, name, values);
      dbml.line();
    }

    // Then generate tables and refs
    const baseOutput = super.generate();
    if (baseOutput) {
      dbml.line(baseOutput);
    }

    return dbml.build().trim();
  }

  /**
   * Collect all enum types from the schema
   */
  private collectEnums(): Map<string, string[]> {
    const enums = new Map<string, string[]>();
    const tables = this.getTables();

    for (const table of tables) {
      const columns = getTableColumns(table);

      for (const column of Object.values(columns)) {
        if (column instanceof PgEnumColumn) {
          const enumObj = (
            column as unknown as { enum: { enumName: string; enumValues: string[] } }
          ).enum;
          if (enumObj && !enums.has(enumObj.enumName)) {
            enums.set(enumObj.enumName, enumObj.enumValues);
          }
        }
      }
    }

    return enums;
  }

  /**
   * Generate a PostgreSQL enum definition
   */
  private generateEnum(dbml: DbmlBuilder, name: string, values: string[]): void {
    dbml.line(`enum ${this.dialectConfig.escapeName(name)} {`);
    dbml.indent();
    for (const value of values) {
      dbml.line(value);
    }
    dbml.dedent();
    dbml.line("}");
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
