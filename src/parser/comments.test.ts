import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { extractComments } from "./comments";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dirname, "__test_fixtures__");

describe("extractComments", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("JSDoc single-line comments (/** ... */)", () => {
    it("should extract table comment", () => {
      const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/** User accounts table */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-single-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users).toBeDefined();
      expect(comments.tables.users.comment).toBe("User accounts table");
    });

    it("should extract column comments", () => {
      const schemaCode = `
import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  /** Primary key */
  id: serial("id").primaryKey(),
  /** User's full name */
  name: text("name").notNull(),
  /** User's email address */
  email: varchar("email", { length: 255 }).unique(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-single-columns.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.columns.id?.comment).toBe("Primary key");
      expect(comments.tables.users.columns.name?.comment).toBe("User's full name");
      expect(comments.tables.users.columns.email?.comment).toBe("User's email address");
    });

    it("should extract both table and column comments", () => {
      const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/** Stores user information */
export const users = pgTable("users", {
  /** Unique identifier */
  id: serial("id").primaryKey(),
  /** Display name */
  name: text("name"),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-single-both.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Stores user information");
      expect(comments.tables.users.columns.id?.comment).toBe("Unique identifier");
      expect(comments.tables.users.columns.name?.comment).toBe("Display name");
    });
  });

  describe("JSDoc multi-line comments", () => {
    it("should extract multi-line table comment", () => {
      const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/**
 * This table stores user account information.
 * It includes basic profile data.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-multiline-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe(
        "This table stores user account information.\nIt includes basic profile data.",
      );
    });

    it("should extract multi-line column comment", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  /**
   * Unique identifier for the user.
   * Auto-incremented.
   */
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-multiline-column.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.columns.id?.comment).toBe(
        "Unique identifier for the user.\nAuto-incremented.",
      );
    });

    it("should extract multi-line comments with extra formatting", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/**
 *
 * User table with extra blank lines.
 *
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-multiline-extra.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("User table with extra blank lines.");
    });
  });

  describe("JSDoc @tags handling", () => {
    it("should ignore @deprecated tag", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/**
 * Users table
 * @deprecated Use accounts table instead
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-deprecated.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Users table");
    });

    it("should ignore @type tag", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  /**
   * User ID
   * @type {number}
   */
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-type.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.columns.id?.comment).toBe("User ID");
    });

    it("should ignore @param and @returns tags", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/**
 * Configuration table
 * @param key - The config key
 * @returns Config value
 */
export const configs = pgTable("configs", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "jsdoc-param-returns.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.configs.comment).toBe("Configuration table");
    });
  });

  describe("Single-line comments (// ...)", () => {
    it("should extract table comment from single-line comment", () => {
      const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "single-line-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Users table");
    });

    it("should extract column comment from single-line comment", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  // User ID
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "single-line-column.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.columns.id?.comment).toBe("User ID");
    });

    it("should prefer JSDoc over single-line comment when both exist", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

// This should be ignored
/** This should be used */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "prefer-jsdoc.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("This should be used");
    });
  });

  describe("Dialect support", () => {
    it("should handle PostgreSQL table definitions (pgTable)", () => {
      const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/** PostgreSQL users table */
export const users = pgTable("users", {
  /** Auto-increment ID */
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "pg-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("PostgreSQL users table");
      expect(comments.tables.users.columns.id?.comment).toBe("Auto-increment ID");
    });

    it("should handle MySQL table definitions (mysqlTable)", () => {
      const schemaCode = `
import { mysqlTable, serial, text } from "drizzle-orm/mysql-core";

/** MySQL users table */
export const users = mysqlTable("users", {
  /** Auto-increment ID */
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "mysql-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("MySQL users table");
      expect(comments.tables.users.columns.id?.comment).toBe("Auto-increment ID");
    });

    it("should handle SQLite table definitions (sqliteTable)", () => {
      const schemaCode = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/** SQLite users table */
export const users = sqliteTable("users", {
  /** Primary key */
  id: integer("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "sqlite-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("SQLite users table");
      expect(comments.tables.users.columns.id?.comment).toBe("Primary key");
    });
  });

  describe("Multiple tables", () => {
    it("should extract comments from multiple tables", () => {
      const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

/** Users table */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

/** Blog posts */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  /** Post title */
  title: text("title"),
  authorId: integer("author_id"),
});
`;
      const filePath = join(TEST_DIR, "multiple-tables.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Users table");
      expect(comments.tables.posts.comment).toBe("Blog posts");
      expect(comments.tables.posts.columns.title?.comment).toBe("Post title");
    });
  });

  describe("Edge cases", () => {
    it("should return empty for tables without comments", () => {
      const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`;
      const filePath = join(TEST_DIR, "no-comments.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users).toBeDefined();
      expect(comments.tables.users.comment).toBeUndefined();
      expect(Object.keys(comments.tables.users.columns)).toHaveLength(0);
    });

    it("should handle chained column methods", () => {
      const schemaCode = `
import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  /** ID with chained methods */
  id: serial("id").primaryKey().notNull(),
  /** Email with multiple chains */
  email: varchar("email", { length: 255 }).unique().notNull(),
});
`;
      const filePath = join(TEST_DIR, "chained-methods.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.columns.id?.comment).toBe("ID with chained methods");
      expect(comments.tables.users.columns.email?.comment).toBe("Email with multiple chains");
    });

    it("should handle special characters in comments", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/** User's "special" table with <html> & symbols */
export const users = pgTable("users", {
  /** ID: 'quoted' & "double-quoted" */
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "special-chars.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe('User\'s "special" table with <html> & symbols');
      expect(comments.tables.users.columns.id?.comment).toBe("ID: 'quoted' & \"double-quoted\"");
    });

    it("should handle empty JSDoc comment", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/** */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "empty-jsdoc.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("");
    });

    it("should handle comments with only whitespace in JSDoc", () => {
      const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/**
 *
 *
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});
`;
      const filePath = join(TEST_DIR, "whitespace-jsdoc.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("");
    });
  });
});

describe("extractComments with Drizzle v1 table helpers", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("Casing helpers (snakeCase.table / camelCase.table)", () => {
    it("should extract comments from snakeCase.table and convert keys to snake_case", () => {
      const schemaCode = `
import { integer, snakeCase } from "drizzle-orm/pg-core";

/** brands table */
export const bikeBrandsTable = snakeCase.table("bike_brands", {
  /** unique code of the brand */
  code: integer().notNull().unique(),
  /** owner of the brand */
  ownerId: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-snake-case-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.bike_brands).toBeDefined();
      expect(comments.tables.bike_brands.comment).toBe("brands table");
      expect(comments.tables.bike_brands.columns.code?.comment).toBe("unique code of the brand");
      expect(comments.tables.bike_brands.columns.owner_id?.comment).toBe("owner of the brand");
      expect(comments.tables.bike_brands.columns.ownerId).toBeUndefined();
    });

    it("should extract comments from camelCase.table and convert keys to camelCase", () => {
      const schemaCode = `
import { integer, camelCase } from "drizzle-orm/pg-core";

/** brands table */
export const brands = camelCase.table("brands", {
  /** owner of the brand */
  owner_id: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-camel-case-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.brands.comment).toBe("brands table");
      expect(comments.tables.brands.columns.ownerId?.comment).toBe("owner of the brand");
    });

    it("should prefer an explicit column name over the casing-converted key", () => {
      const schemaCode = `
import { integer, snakeCase } from "drizzle-orm/pg-core";

export const brands = snakeCase.table("brands", {
  /** explicit name wins */
  ownerId: integer("owner"),
});
`;
      const filePath = join(TEST_DIR, "v1-snake-case-explicit-name.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.brands.columns.owner?.comment).toBe("explicit name wins");
      expect(comments.tables.brands.columns.owner_id).toBeUndefined();
    });

    it("should support import aliases of casing helpers", () => {
      const schemaCode = `
import { integer, snakeCase as sc } from "drizzle-orm/pg-core";

/** aliased table */
export const brands = sc.table("brands", {
  /** owner of the brand */
  ownerId: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-snake-case-alias.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.brands.comment).toBe("aliased table");
      expect(comments.tables.brands.columns.owner_id?.comment).toBe("owner of the brand");
    });

    it("should handle withRLS on casing helpers", () => {
      const schemaCode = `
import { integer, snakeCase } from "drizzle-orm/pg-core";

/** RLS table */
export const brands = snakeCase.table.withRLS("brands", {
  /** owner of the brand */
  ownerId: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-snake-case-rls.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.brands.comment).toBe("RLS table");
      expect(comments.tables.brands.columns.owner_id?.comment).toBe("owner of the brand");
    });

    it("should handle MySQL and SQLite casing helpers", () => {
      const schemaCode = `
import { int, snakeCase as mysqlSnakeCase } from "drizzle-orm/mysql-core";
import { integer, camelCase as sqliteCamelCase } from "drizzle-orm/sqlite-core";

/** MySQL brands */
export const mysqlBrands = mysqlSnakeCase.table("mysql_brands", {
  /** MySQL owner */
  ownerId: int(),
});

/** SQLite brands */
export const sqliteBrands = sqliteCamelCase.table("sqlite_brands", {
  /** SQLite owner */
  owner_id: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-casing-other-dialects.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.mysql_brands.comment).toBe("MySQL brands");
      expect(comments.tables.mysql_brands.columns.owner_id?.comment).toBe("MySQL owner");
      expect(comments.tables.sqlite_brands.comment).toBe("SQLite brands");
      expect(comments.tables.sqlite_brands.columns.ownerId?.comment).toBe("SQLite owner");
    });
  });

  describe("Schema helpers (pgSchema / snakeCase.schema)", () => {
    it("should extract comments from pgSchema(...).table without casing conversion", () => {
      const schemaCode = `
import { integer, pgSchema } from "drizzle-orm/pg-core";

export const auth = pgSchema("auth");

/** Auth users */
export const users = auth.table("users", {
  /** user's id */
  userId: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-pg-schema.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Auth users");
      expect(comments.tables.users.columns.userId?.comment).toBe("user's id");
    });

    it("should apply casing from a schema variable created with snakeCase.schema", () => {
      const schemaCode = `
import { integer, snakeCase } from "drizzle-orm/pg-core";

export const auth = snakeCase.schema("auth");

/** Auth users */
export const users = auth.table("users", {
  /** user's id */
  userId: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-snake-case-schema-variable.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Auth users");
      expect(comments.tables.users.columns.user_id?.comment).toBe("user's id");
    });

    it("should apply casing from an inline camelCase.schema(...).table call", () => {
      const schemaCode = `
import { integer, camelCase } from "drizzle-orm/pg-core";

/** Auth users */
export const users = camelCase.schema("auth").table("users", {
  /** user's id */
  user_id: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-camel-case-schema-inline.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("Auth users");
      expect(comments.tables.users.columns.userId?.comment).toBe("user's id");
    });

    it("should resolve a schema variable declared in another file of a directory", () => {
      const schemaDir = join(TEST_DIR, "v1-schema-dir");
      mkdirSync(schemaDir, { recursive: true });
      // The table file sorts before the schema file on purpose:
      // the schema variable must be resolvable regardless of the file order
      writeFileSync(
        join(schemaDir, "a-tables.ts"),
        `
import { integer } from "drizzle-orm/pg-core";
import { auth } from "./z-schema";

/** Auth users */
export const users = auth.table("users", {
  /** user's id */
  userId: integer(),
});
`,
      );
      writeFileSync(
        join(schemaDir, "z-schema.ts"),
        `
import { snakeCase } from "drizzle-orm/pg-core";

export const auth = snakeCase.schema("auth");
`,
      );

      const comments = extractComments(schemaDir);

      expect(comments.tables.users.comment).toBe("Auth users");
      expect(comments.tables.users.columns.user_id?.comment).toBe("user's id");
    });
  });

  describe("Columns without explicit names", () => {
    it("should use the property key as-is for pgTable columns without a name", () => {
      const schemaCode = `
import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  /** Primary key */
  id: serial().primaryKey(),
  /** Display name */
  displayName: varchar({ length: 100 }).notNull(),
  /** Creation time */
  createdAt: timestamp({ mode: "date" }).defaultNow(),
});
`;
      const filePath = join(TEST_DIR, "v1-keyless-columns.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.columns.id?.comment).toBe("Primary key");
      expect(comments.tables.users.columns.displayName?.comment).toBe("Display name");
      expect(comments.tables.users.columns.createdAt?.comment).toBe("Creation time");
    });

    it("should handle withRLS on pgTable without casing conversion", () => {
      const schemaCode = `
import { pgTable, integer } from "drizzle-orm/pg-core";

/** RLS table */
export const users = pgTable.withRLS("users", {
  /** user's id */
  userId: integer(),
});
`;
      const filePath = join(TEST_DIR, "v1-pg-table-rls.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users.comment).toBe("RLS table");
      expect(comments.tables.users.columns.userId?.comment).toBe("user's id");
    });

    it("should skip columns whose name is not statically known", () => {
      const schemaCode = `
import { pgTable, integer } from "drizzle-orm/pg-core";

const dynamicName = "computed";

export const users = pgTable("users", {
  /** Unknown name */
  id: integer(dynamicName),
});
`;
      const filePath = join(TEST_DIR, "v1-dynamic-column-name.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.users).toBeDefined();
      expect(Object.keys(comments.tables.users.columns)).toHaveLength(0);
    });
  });
});
