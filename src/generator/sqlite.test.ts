import { describe, it, expect } from "vitest";
import { sqliteGenerate } from "./sqlite.js";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

describe("sqliteGenerate", () => {
  it("should generate DBML for a simple table", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").unique(),
    });

    const dbml = sqliteGenerate({ schema: { users } });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('"id" integer [primary key, not null, increment]');
    expect(dbml).toContain('"name" text [not null]');
    expect(dbml).toContain('"email" text [unique]');
    expect(dbml).toContain("}");
  });

  it("should generate DBML for multiple tables", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    const posts = sqliteTable("posts", {
      id: integer("id").primaryKey(),
      title: text("title").notNull(),
      authorId: integer("author_id"),
    });

    const dbml = sqliteGenerate({ schema: { users, posts } });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
    expect(dbml).toContain('"title" text [not null]');
  });

  it("should handle columns with default values", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      role: text("role").default("user"),
      count: integer("count").default(0),
    });

    const dbml = sqliteGenerate({ schema: { users } });

    expect(dbml).toContain("default: 'user'");
    expect(dbml).toContain("default: 0");
  });

  it("should generate empty string for empty schema", () => {
    const dbml = sqliteGenerate({ schema: {} });
    expect(dbml).toBe("");
  });

  it("should identify INTEGER PRIMARY KEY as auto-increment in SQLite", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      count: integer("count"),
    });

    const dbml = sqliteGenerate({ schema: { users } });

    // Only the primary key integer should have increment
    expect(dbml).toContain('"id" integer [primary key, not null, increment]');
    expect(dbml).toContain('"count" integer');
    expect(dbml).not.toContain('"count" integer [increment]');
  });
});
