import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mysqlGenerate } from "./mysql";
import {
  mysqlTable,
  serial,
  text,
  varchar,
  int,
  boolean,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm/_relations";
import type { SchemaComments } from "../parser/comments";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

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

  it("should handle composite primary keys", () => {
    const userRoles = mysqlTable(
      "user_roles",
      {
        userId: int("user_id").notNull(),
        roleId: int("role_id").notNull(),
      },
      (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
    );

    const dbml = mysqlGenerate({ schema: { userRoles } });

    expect(dbml).toContain("Table `user_roles` {");
    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("[pk]");
  });

  it("should generate foreign key references", () => {
    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = mysqlTable(
      "posts",
      {
        id: serial("id").primaryKey(),
        authorId: int("author_id").notNull(),
      },
      (table) => [
        foreignKey({
          columns: [table.authorId],
          foreignColumns: [users.id],
        }),
      ],
    );

    const dbml = mysqlGenerate({ schema: { users, posts } });

    expect(dbml).toContain("Ref:");
    expect(dbml).toContain("`posts`.`author_id`");
    expect(dbml).toContain("`users`.`id`");
  });

  it("should handle unique constraints", () => {
    const users = mysqlTable(
      "users",
      {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }),
        username: varchar("username", { length: 50 }),
      },
      (table) => [unique().on(table.email, table.username)],
    );

    const dbml = mysqlGenerate({ schema: { users } });

    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("[unique]");
  });

  it("should handle indexes", () => {
    const users = mysqlTable(
      "users",
      {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }),
        name: text("name"),
      },
      (table) => [index("email_idx").on(table.email)],
    );

    const dbml = mysqlGenerate({ schema: { users } });

    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("`email`");
  });
});

describe("mysqlGenerate with relations", () => {
  const RELATIONS_TEST_DIR = join(import.meta.dirname, "__test_fixtures_mysql_relations__");

  beforeAll(() => {
    mkdirSync(RELATIONS_TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(RELATIONS_TEST_DIR, { recursive: true, force: true });
  });

  it("should auto-detect v1 defineRelations() and generate references", async () => {
    const { defineRelations } = await import("drizzle-orm");

    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = mysqlTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: int("author_id").notNull(),
    });

    const schema = { users, posts };
    const rqbv2Relations = defineRelations(schema, (r) => ({
      users: {
        posts: r.many.posts(),
      },
      posts: {
        author: r.one.users({
          from: r.posts.authorId,
          to: r.users.id,
        }),
      },
    }));

    const dbml = mysqlGenerate({
      schema: { ...schema, rqbv2Relations },
    });

    expect(dbml).toContain("Table `users` {");
    expect(dbml).toContain("Table `posts` {");
    expect(dbml).toContain("Ref: `posts`.`author_id` > `users`.`id`");
  });

  it("should generate Ref from relations() when sourceFile is provided", () => {
    const schemaCode = `
import { mysqlTable, serial, text, int } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title"),
  authorId: int("author_id").notNull(),
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

    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = mysqlTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: int("author_id").notNull(),
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

    const dbml = mysqlGenerate({
      schema: { users, posts, usersRelations, postsRelations },
      source: filePath,
    });

    expect(dbml).toContain("Table `users` {");
    expect(dbml).toContain("Table `posts` {");
    expect(dbml).toContain("Ref:");
    expect(dbml).toContain("`posts`.`author_id`");
    expect(dbml).toContain("`users`.`id`");
  });

  it("should generate multiple Refs for multiple one() relations", () => {
    const schemaCode = `
import { mysqlTable, serial, int } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
});

export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
});

export const comments = mysqlTable("comments", {
  id: serial("id").primaryKey(),
  postId: int("post_id"),
  authorId: int("author_id"),
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

    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
    });

    const posts = mysqlTable("posts", {
      id: serial("id").primaryKey(),
    });

    const comments = mysqlTable("comments", {
      id: serial("id").primaryKey(),
      postId: int("post_id"),
      authorId: int("author_id"),
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

    const dbml = mysqlGenerate({
      schema: { users, posts, comments, commentsRelations },
      source: filePath,
    });

    expect(dbml).toContain("Ref: `comments`.`post_id` > `posts`.`id`");
    expect(dbml).toContain("Ref: `comments`.`author_id` > `users`.`id`");
  });

  it("should not generate Ref for many() without corresponding one()", () => {
    const schemaCode = `
import { mysqlTable, serial, int } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
});

export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
  authorId: int("author_id"),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-many-only.ts");
    writeFileSync(filePath, schemaCode);

    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
    });

    const posts = mysqlTable("posts", {
      id: serial("id").primaryKey(),
      authorId: int("author_id"),
    });

    const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));

    const dbml = mysqlGenerate({
      schema: { users, posts, usersRelations },
      source: filePath,
    });

    // Should not contain Ref since many() doesn't have fields/references
    expect(dbml).not.toContain("Ref:");
  });

  it("should generate one-to-one Ref (-) when bidirectional one() relations exist", () => {
    const schemaCode = `
import { mysqlTable, serial, int } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  profileId: int("profile_id"),
});

export const profiles = mysqlTable("profiles", {
  id: serial("id").primaryKey(),
  userId: int("user_id"),
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

    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      profileId: int("profile_id"),
    });

    const profiles = mysqlTable("profiles", {
      id: serial("id").primaryKey(),
      userId: int("user_id"),
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

    const dbml = mysqlGenerate({
      schema: { users, profiles, usersRelations, profilesRelations },
      source: filePath,
    });

    // Should use "-" for one-to-one relationship
    expect(dbml).toContain("Ref: `users`.`profile_id` - `profiles`.`id`");
    // Should NOT have duplicate ref
    expect(dbml).not.toContain("Ref: `profiles`.`id` - `users`.`profile_id`");
  });
});

const TEST_DIR = join(import.meta.dirname, "__test_fixtures_mysql__");

describe("mysqlGenerate with comments", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should include table Note from comments option", () => {
    const users = mysqlTable("users", {
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

    const dbml = mysqlGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User accounts table'");
  });

  it("should include column note from comments option", () => {
    const users = mysqlTable("users", {
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

    const dbml = mysqlGenerate({ schema: { users }, comments });

    expect(dbml).toContain("note: 'Primary key'");
    expect(dbml).toContain("note: 'User display name'");
  });

  it("should include both table and column notes", () => {
    const users = mysqlTable("users", {
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

    const dbml = mysqlGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User accounts'");
    expect(dbml).toContain("note: 'Unique ID'");
  });

  it("should extract comments from source option", () => {
    const schemaCode = `
import { mysqlTable, serial, text } from "drizzle-orm/mysql-core";

/** Users table with account info */
export const users = mysqlTable("users", {
  /** Auto-generated ID */
  id: serial("id").primaryKey(),
  /** Full name */
  name: text("name"),
});
`;
    const filePath = join(TEST_DIR, "schema-with-comments.ts");
    writeFileSync(filePath, schemaCode);

    const users = mysqlTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const dbml = mysqlGenerate({ schema: { users }, source: filePath });

    expect(dbml).toContain("Note: 'Users table with account info'");
    expect(dbml).toContain("note: 'Auto-generated ID'");
    expect(dbml).toContain("note: 'Full name'");
  });

  it("should escape special characters in comments", () => {
    const users = mysqlTable("users", {
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

    const dbml = mysqlGenerate({ schema: { users }, comments });

    expect(dbml).toContain("Note: 'User\\'s table with \\'quotes\\''");
    expect(dbml).toContain("note: 'It\\'s the primary key'");
  });
});
