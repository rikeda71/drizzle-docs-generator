import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { extractComments } from "./comments.js";
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
        "This table stores user account information. It includes basic profile data.",
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
        "Unique identifier for the user. Auto-incremented.",
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
