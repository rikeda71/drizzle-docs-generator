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

  it("should extract JSDoc comment from table definition", () => {
    const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/** User accounts table */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`;
    const filePath = join(TEST_DIR, "table-comment.ts");
    writeFileSync(filePath, schemaCode);

    const comments = extractComments(filePath);

    expect(comments.tables.users).toBeDefined();
    expect(comments.tables.users.comment).toBe("User accounts table");
  });

  it("should extract JSDoc comments from column definitions", () => {
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
    const filePath = join(TEST_DIR, "column-comments.ts");
    writeFileSync(filePath, schemaCode);

    const comments = extractComments(filePath);

    expect(comments.tables.users).toBeDefined();
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
    const filePath = join(TEST_DIR, "both-comments.ts");
    writeFileSync(filePath, schemaCode);

    const comments = extractComments(filePath);

    expect(comments.tables.users.comment).toBe("Stores user information");
    expect(comments.tables.users.columns.id?.comment).toBe("Unique identifier");
    expect(comments.tables.users.columns.name?.comment).toBe("Display name");
  });

  it("should handle multiple tables", () => {
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

  it("should handle MySQL table definitions", () => {
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

  it("should handle SQLite table definitions", () => {
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

  it("should handle multi-line JSDoc comments", () => {
    const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/**
 * This table stores user account information.
 * It includes basic profile data.
 */
export const users = pgTable("users", {
  /**
   * Unique identifier for the user.
   * Auto-incremented.
   */
  id: serial("id").primaryKey(),
});
`;
    const filePath = join(TEST_DIR, "multiline-jsdoc.ts");
    writeFileSync(filePath, schemaCode);

    const comments = extractComments(filePath);

    expect(comments.tables.users.comment).toBe(
      "This table stores user account information. It includes basic profile data.",
    );
    expect(comments.tables.users.columns.id?.comment).toBe(
      "Unique identifier for the user. Auto-incremented.",
    );
  });

  it("should ignore @tags in JSDoc comments", () => {
    const schemaCode = `
import { pgTable, serial } from "drizzle-orm/pg-core";

/**
 * Users table
 * @deprecated Use accounts table instead
 */
export const users = pgTable("users", {
  /**
   * User ID
   * @type {number}
   */
  id: serial("id").primaryKey(),
});
`;
    const filePath = join(TEST_DIR, "jsdoc-tags.ts");
    writeFileSync(filePath, schemaCode);

    const comments = extractComments(filePath);

    expect(comments.tables.users.comment).toBe("Users table");
    expect(comments.tables.users.columns.id?.comment).toBe("User ID");
  });

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

  it("should handle single-line comments", () => {
    const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  // User ID
  id: serial("id").primaryKey(),
});
`;
    const filePath = join(TEST_DIR, "single-line-comments.ts");
    writeFileSync(filePath, schemaCode);

    const comments = extractComments(filePath);

    expect(comments.tables.users.comment).toBe("Users table");
    expect(comments.tables.users.columns.id?.comment).toBe("User ID");
  });
});
