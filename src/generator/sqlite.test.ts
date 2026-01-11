import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sqliteGenerate } from "./sqlite";
import {
  sqliteTable,
  integer,
  text,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import type { SchemaComments } from "../parser/comments";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

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

  it("should handle composite primary keys", () => {
    const userRoles = sqliteTable(
      "user_roles",
      {
        userId: integer("user_id").notNull(),
        roleId: integer("role_id").notNull(),
      },
      (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
    );

    const dbml = sqliteGenerate({ schema: { userRoles } });

    expect(dbml).toContain('Table "user_roles" {');
    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("[pk]");
  });

  it("should generate foreign key references", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    const posts = sqliteTable(
      "posts",
      {
        id: integer("id").primaryKey(),
        authorId: integer("author_id").notNull(),
      },
      (table) => [
        foreignKey({
          columns: [table.authorId],
          foreignColumns: [users.id],
        }),
      ],
    );

    const dbml = sqliteGenerate({ schema: { users, posts } });

    expect(dbml).toContain("Ref:");
    expect(dbml).toContain('"posts"."author_id"');
    expect(dbml).toContain('"users"."id"');
  });

  it("should handle unique constraints", () => {
    const users = sqliteTable(
      "users",
      {
        id: integer("id").primaryKey(),
        email: text("email"),
        username: text("username"),
      },
      (table) => [unique().on(table.email, table.username)],
    );

    const dbml = sqliteGenerate({ schema: { users } });

    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("[unique]");
  });

  it("should handle indexes", () => {
    const users = sqliteTable(
      "users",
      {
        id: integer("id").primaryKey(),
        email: text("email"),
        name: text("name"),
      },
      (table) => [index("email_idx").on(table.email)],
    );

    const dbml = sqliteGenerate({ schema: { users } });

    expect(dbml).toContain("indexes {");
    expect(dbml).toContain('"email"');
  });
});

describe("sqliteGenerate with relations", () => {
  const RELATIONS_TEST_DIR = join(import.meta.dirname, "__test_fixtures_sqlite_relations__");

  beforeAll(() => {
    mkdirSync(RELATIONS_TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(RELATIONS_TEST_DIR, { recursive: true, force: true });
  });

  it("should generate references from relations when relational option is true", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    const posts = sqliteTable("posts", {
      id: integer("id").primaryKey(),
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

    const dbml = sqliteGenerate({
      schema: { users, posts, usersRelations, postsRelations },
      relational: true,
    });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
  });

  it("should generate Ref from relations() when sourceFile is provided", () => {
    const schemaCode = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name"),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  title: text("title"),
  authorId: integer("author_id").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-with-relations.ts");
    writeFileSync(filePath, schemaCode);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    const posts = sqliteTable("posts", {
      id: integer("id").primaryKey(),
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

    const dbml = sqliteGenerate({
      schema: { users, posts, usersRelations, postsRelations },
      relational: true,
      source: filePath,
    });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
    expect(dbml).toContain("Ref:");
    expect(dbml).toContain('"posts"."author_id"');
    expect(dbml).toContain('"users"."id"');
  });

  it("should generate multiple Refs for multiple one() relations", () => {
    const schemaCode = `
import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey(),
  postId: integer("post_id"),
  authorId: integer("author_id"),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-multiple-relations.ts");
    writeFileSync(filePath, schemaCode);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
    });

    const posts = sqliteTable("posts", {
      id: integer("id").primaryKey(),
    });

    const comments = sqliteTable("comments", {
      id: integer("id").primaryKey(),
      postId: integer("post_id"),
      authorId: integer("author_id"),
    });

    const commentsRelations = relations(comments, ({ one }) => ({
      post: one(posts, {
        fields: [comments.postId],
        references: [posts.id],
      }),
      author: one(users, {
        fields: [comments.authorId],
        references: [users.id],
      }),
    }));

    const dbml = sqliteGenerate({
      schema: { users, posts, comments, commentsRelations },
      relational: true,
      source: filePath,
    });

    expect(dbml).toContain('Ref: "comments"."post_id" > "posts"."id"');
    expect(dbml).toContain('Ref: "comments"."author_id" > "users"."id"');
  });

  it("should not generate Ref for many() without corresponding one()", () => {
    const schemaCode = `
import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  authorId: integer("author_id"),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-many-only.ts");
    writeFileSync(filePath, schemaCode);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
    });

    const posts = sqliteTable("posts", {
      id: integer("id").primaryKey(),
      authorId: integer("author_id"),
    });

    const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));

    const dbml = sqliteGenerate({
      schema: { users, posts, usersRelations },
      relational: true,
      source: filePath,
    });

    // Should not contain Ref since many() doesn't have fields/references
    expect(dbml).not.toContain("Ref:");
  });

  it("should generate one-to-one Ref (-) when bidirectional one() relations exist", () => {
    const schemaCode = `
import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  profileId: integer("profile_id"),
});

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey(),
  userId: integer("user_id"),
});

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.profileId],
    references: [profiles.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.id],
    references: [users.profileId],
  }),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-one-to-one.ts");
    writeFileSync(filePath, schemaCode);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      profileId: integer("profile_id"),
    });

    const profiles = sqliteTable("profiles", {
      id: integer("id").primaryKey(),
      userId: integer("user_id"),
    });

    const usersRelations = relations(users, ({ one }) => ({
      profile: one(profiles, {
        fields: [users.profileId],
        references: [profiles.id],
      }),
    }));

    const profilesRelations = relations(profiles, ({ one }) => ({
      user: one(users, {
        fields: [profiles.id],
        references: [users.profileId],
      }),
    }));

    const dbml = sqliteGenerate({
      schema: { users, profiles, usersRelations, profilesRelations },
      relational: true,
      source: filePath,
    });

    // Should use "-" for one-to-one relationship
    expect(dbml).toContain('Ref: "users"."profile_id" - "profiles"."id"');
    // Should NOT have duplicate ref
    expect(dbml).not.toContain('Ref: "profiles"."id" - "users"."profile_id"');
  });
});

const TEST_DIR = join(import.meta.dirname, "__test_fixtures_sqlite__");

describe("sqliteGenerate with comments", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should include table Note from comments option", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
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

    const dbml = sqliteGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User accounts table'");
  });

  it("should include column note from comments option", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
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

    const dbml = sqliteGenerate({ schema: { users }, comments });

    expect(dbml).toContain("note: 'Primary key'");
    expect(dbml).toContain("note: 'User display name'");
  });

  it("should include both table and column notes", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
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

    const dbml = sqliteGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User accounts'");
    expect(dbml).toContain("note: 'Unique ID'");
  });

  it("should extract comments from source option", () => {
    const schemaCode = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/** Users table with account info */
export const users = sqliteTable("users", {
  /** Auto-generated ID */
  id: integer("id").primaryKey(),
  /** Full name */
  name: text("name"),
});
`;
    const filePath = join(TEST_DIR, "schema-with-comments.ts");
    writeFileSync(filePath, schemaCode);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    const dbml = sqliteGenerate({ schema: { users }, source: filePath });

    expect(dbml).toContain("Note: 'Users table with account info'");
    expect(dbml).toContain("note: 'Auto-generated ID'");
    expect(dbml).toContain("note: 'Full name'");
  });

  it("should escape special characters in comments", () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
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

    const dbml = sqliteGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User\\'s table with \\'quotes\\''");
    expect(dbml).toContain("note: 'It\\'s the primary key'");
  });
});
