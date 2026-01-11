import { describe, it, expect } from "vitest";
import { mysqlGenerate } from "./mysql";
import { mysqlTable, serial, text, varchar, int, boolean } from "drizzle-orm/mysql-core";

describe("mysqlGenerate", () => {
  it("should generate DBML for a simple table", () => {
    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      email: varchar("email", { length: 255 }).unique(),
    });

    const dbml = mysqlGenerate({ schema: { users } });

    expect(dbml).toContain("Table `users` {");
    expect(dbml).toContain("`id` serial [primary key, not null, increment]");
    expect(dbml).toContain("`name` text [not null]");
    expect(dbml).toContain("`email` varchar(255) [unique]");
    expect(dbml).toContain("}");
  });

  it("should generate DBML for multiple tables", () => {
    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = mysqlTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      authorId: int("author_id"),
    });

    const dbml = mysqlGenerate({ schema: { users, posts } });

    expect(dbml).toContain("Table `users` {");
    expect(dbml).toContain("Table `posts` {");
    expect(dbml).toContain("`title` text [not null]");
  });

  it("should handle columns with default values", () => {
    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      active: boolean("active").default(true),
      role: text("role").default("user"),
    });

    const dbml = mysqlGenerate({ schema: { users } });

    expect(dbml).toContain("default: true");
    expect(dbml).toContain("default: 'user'");
  });

  it("should generate empty string for empty schema", () => {
    const dbml = mysqlGenerate({ schema: {} });
    expect(dbml).toBe("");
  });

  it("should use backtick escaping for MySQL", () => {
    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
    });

    const dbml = mysqlGenerate({ schema: { users } });

    expect(dbml).toContain("`users`");
    expect(dbml).toContain("`id`");
    expect(dbml).not.toContain('"users"');
  });
});
