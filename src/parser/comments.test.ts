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
  describe("Directory input", () => {
    it("should skip node_modules and hidden directories", () => {
      const dir = join(TEST_DIR, "dir-input");
      mkdirSync(join(dir, "node_modules", "some-pkg"), { recursive: true });
      mkdirSync(join(dir, ".hidden"), { recursive: true });
      mkdirSync(join(dir, "nested"), { recursive: true });

      writeFileSync(
        join(dir, "nested", "users.ts"),
        `
import { pgTable, serial } from "drizzle-orm/pg-core";
/** Users */
export const users = pgTable("users", { id: serial("id").primaryKey() });
`,
      );
      writeFileSync(
        join(dir, "node_modules", "some-pkg", "schema.ts"),
        `
import { pgTable, serial } from "drizzle-orm/pg-core";
/** From node_modules */
export const vendored = pgTable("vendored", { id: serial("id").primaryKey() });
`,
      );
      writeFileSync(
        join(dir, ".hidden", "schema.ts"),
        `
import { pgTable, serial } from "drizzle-orm/pg-core";
/** Hidden */
export const hidden = pgTable("hidden", { id: serial("id").primaryKey() });
`,
      );

      const comments = extractComments(dir);

      expect(comments.tables.users.comment).toBe("Users");
      expect(comments.tables.vendored).toBeUndefined();
      expect(comments.tables.hidden).toBeUndefined();
    });
  });

  describe("Enum comments (pgEnum)", () => {
    it("should extract enum comment and value comments from array form", () => {
      const schemaCode = `
import { pgEnum } from "drizzle-orm/pg-core";

/** Body type of a bike */
export const bikeBodyTypeEnum = pgEnum("bike_body_type", [
  /** No fairing */
  "naked",
  /** Dual purpose on/off-road */
  "onOff",
  "quadricycle",
]);
`;
      const filePath = join(TEST_DIR, "enum-array-form.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.enums).toBeDefined();
      expect(comments.enums?.bike_body_type).toBeDefined();
      expect(comments.enums?.bike_body_type.comment).toBe("Body type of a bike");
      expect(comments.enums?.bike_body_type.values.naked.comment).toBe("No fairing");
      expect(comments.enums?.bike_body_type.values.onOff.comment).toBe("Dual purpose on/off-road");
      expect(comments.enums?.bike_body_type.values.quadricycle).toBeUndefined();
      // Enums must not be registered as tables
      expect(comments.tables.bike_body_type).toBeUndefined();
    });

    it("should extract value comments from object form keyed by database value", () => {
      const schemaCode = `
import { pgEnum } from "drizzle-orm/pg-core";

/** Order status */
export const orderStatusEnum = pgEnum("order_status", {
  /** Order was created */
  Created: "created",
  /** Order was shipped */
  Shipped: "shipped",
});
`;
      const filePath = join(TEST_DIR, "enum-object-form.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.enums?.order_status.comment).toBe("Order status");
      expect(comments.enums?.order_status.values.created.comment).toBe("Order was created");
      expect(comments.enums?.order_status.values.shipped.comment).toBe("Order was shipped");
      expect(comments.enums?.order_status.values.Created).toBeUndefined();
    });

    it("should extract comments from schema-scoped enum (pgSchema().enum())", () => {
      const schemaCode = `
import { pgSchema } from "drizzle-orm/pg-core";

export const appSchema = pgSchema("app");

/** Role in the application */
export const roleEnum = appSchema.enum("role", [
  /** Full access */
  "admin",
  "member",
]);
`;
      const filePath = join(TEST_DIR, "enum-pg-schema.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.enums?.role.comment).toBe("Role in the application");
      expect(comments.enums?.role.values.admin.comment).toBe("Full access");
      expect(comments.enums?.role.values.member).toBeUndefined();
    });

    it("should support single-line comments on enum values", () => {
      const schemaCode = `
import { pgEnum } from "drizzle-orm/pg-core";

// Priority level
export const priorityEnum = pgEnum("priority", [
  // Highest priority
  "high",
  "low",
]);
`;
      const filePath = join(TEST_DIR, "enum-single-line.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.enums?.priority.comment).toBe("Priority level");
      expect(comments.enums?.priority.values.high.comment).toBe("Highest priority");
    });

    it("should register enum without comments with empty values", () => {
      const schemaCode = `
import { pgEnum } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["active", "inactive"]);
`;
      const filePath = join(TEST_DIR, "enum-no-comments.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.enums?.status).toBeDefined();
      expect(comments.enums?.status.comment).toBeUndefined();
      expect(comments.enums?.status.values).toEqual({});
    });

    it("should extract enum comments alongside table comments in the same file", () => {
      const schemaCode = `
import { pgTable, pgEnum, serial } from "drizzle-orm/pg-core";

/** Bike body type */
export const bikeBodyTypeEnum = pgEnum("bike_body_type", [
  /** No fairing */
  "naked",
]);

/** Bikes table */
export const bikes = pgTable("bikes", {
  /** Primary key */
  id: serial("id").primaryKey(),
  /** Body type of the bike */
  bodyType: bikeBodyTypeEnum("body_type").notNull(),
});
`;
      const filePath = join(TEST_DIR, "enum-with-table.ts");
      writeFileSync(filePath, schemaCode);

      const comments = extractComments(filePath);

      expect(comments.tables.bikes.comment).toBe("Bikes table");
      expect(comments.tables.bikes.columns.body_type.comment).toBe("Body type of the bike");
      expect(comments.enums?.bike_body_type.comment).toBe("Bike body type");
      expect(comments.enums?.bike_body_type.values.naked.comment).toBe("No fairing");
    });
  });
});
