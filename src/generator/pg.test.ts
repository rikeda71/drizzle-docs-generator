import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pgGenerate } from "./pg.js";
import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { SchemaComments } from "../parser/comments.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("pgGenerate", () => {
  it("should generate DBML for a simple table", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      email: varchar("email", { length: 255 }).unique(),
    });

    const dbml = pgGenerate({ schema: { users } });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('"id" serial [primary key, not null, increment]');
    expect(dbml).toContain('"name" text [not null]');
    expect(dbml).toContain('"email" varchar(255) [unique]');
    expect(dbml).toContain("}");
  });

  it("should generate DBML for multiple tables", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      authorId: integer("author_id"),
    });

    const dbml = pgGenerate({ schema: { users, posts } });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
    expect(dbml).toContain('"title" text [not null]');
    expect(dbml).toContain('"author_id" integer');
  });

  it("should handle columns with default values", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      active: boolean("active").default(true),
      role: text("role").default("user"),
      createdAt: timestamp("created_at").defaultNow(),
    });

    const dbml = pgGenerate({ schema: { users } });

    expect(dbml).toContain("default: true");
    expect(dbml).toContain("default: 'user'");
  });

  it("should generate empty string for empty schema", () => {
    const dbml = pgGenerate({ schema: {} });
    expect(dbml).toBe("");
  });

  it("should handle composite primary keys", () => {
    const userRoles = pgTable(
      "user_roles",
      {
        userId: integer("user_id").notNull(),
        roleId: integer("role_id").notNull(),
      },
      (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
    );

    const dbml = pgGenerate({ schema: { userRoles } });

    expect(dbml).toContain('Table "user_roles" {');
    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("[pk]");
  });

  it("should generate foreign key references", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable(
      "posts",
      {
        id: serial("id").primaryKey(),
        authorId: integer("author_id").notNull(),
      },
      (table) => [
        foreignKey({
          columns: [table.authorId],
          foreignColumns: [users.id],
        }),
      ],
    );

    const dbml = pgGenerate({ schema: { users, posts } });

    expect(dbml).toContain("Ref:");
    expect(dbml).toContain('"posts"."author_id"');
    expect(dbml).toContain('"users"."id"');
  });

  it("should handle unique constraints", () => {
    const users = pgTable(
      "users",
      {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }),
        username: varchar("username", { length: 50 }),
      },
      (table) => [unique().on(table.email, table.username)],
    );

    const dbml = pgGenerate({ schema: { users } });

    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("[unique]");
  });

  it("should handle indexes", () => {
    const users = pgTable(
      "users",
      {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }),
        name: text("name"),
      },
      (table) => [index("email_idx").on(table.email)],
    );

    const dbml = pgGenerate({ schema: { users } });

    expect(dbml).toContain("indexes {");
    expect(dbml).toContain('"email"');
  });
});

describe("pgGenerate with relations", () => {
  it("should generate references from relations when relational option is true", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: integer("author_id").notNull(),
    });

    const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));

    const postsRelations = relations(posts, ({ one }) => ({
      author: one(users, {
        fields: [posts.authorId],
        references: [users.id],
      }),
    }));

    const dbml = pgGenerate({
      schema: { users, posts, usersRelations, postsRelations },
      relational: true,
    });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
  });
});

const TEST_DIR = join(import.meta.dirname, "__test_fixtures__");

describe("pgGenerate with comments", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should include table Note from comments option", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const comments: SchemaComments = {
      tables: {
        users: {
          comment: "User accounts table",
          columns: {},
        },
      },
    };

    const dbml = pgGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User accounts table'");
  });

  it("should include column note from comments option", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const comments: SchemaComments = {
      tables: {
        users: {
          columns: {
            id: { comment: "Primary key" },
            name: { comment: "User display name" },
          },
        },
      },
    };

    const dbml = pgGenerate({ schema: { users }, comments });

    expect(dbml).toContain("note: 'Primary key'");
    expect(dbml).toContain("note: 'User display name'");
  });

  it("should include both table and column notes", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const comments: SchemaComments = {
      tables: {
        users: {
          comment: "User accounts",
          columns: {
            id: { comment: "Unique ID" },
          },
        },
      },
    };

    const dbml = pgGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User accounts'");
    expect(dbml).toContain("note: 'Unique ID'");
  });

  it("should extract comments from sourceFile option", () => {
    const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

/** Users table with account info */
export const users = pgTable("users", {
  /** Auto-generated ID */
  id: serial("id").primaryKey(),
  /** Full name */
  name: text("name"),
});
`;
    const filePath = join(TEST_DIR, "schema-with-comments.ts");
    writeFileSync(filePath, schemaCode);

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const dbml = pgGenerate({ schema: { users }, sourceFile: filePath });

    expect(dbml).toContain("Note: 'Users table with account info'");
    expect(dbml).toContain("note: 'Auto-generated ID'");
    expect(dbml).toContain("note: 'Full name'");
  });

  it("should escape special characters in comments", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
    });

    const comments: SchemaComments = {
      tables: {
        users: {
          comment: "User's table with 'quotes'",
          columns: {
            id: { comment: "It's the primary key" },
          },
        },
      },
    };

    const dbml = pgGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User\\'s table with \\'quotes\\''");
    expect(dbml).toContain("note: 'It\\'s the primary key'");
  });
});
