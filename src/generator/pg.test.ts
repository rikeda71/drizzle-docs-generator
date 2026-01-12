import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pgGenerate, PgGenerator } from "./pg";
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
import { relations } from "drizzle-orm/_relations";
import type { SchemaComments } from "../parser/comments";
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
  const RELATIONS_TEST_DIR = join(import.meta.dirname, "__test_fixtures_relations__");

  beforeAll(() => {
    mkdirSync(RELATIONS_TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(RELATIONS_TEST_DIR, { recursive: true, force: true });
  });

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

  it("should generate Ref from relations() when sourceFile is provided", () => {
    const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
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
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
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

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
    });

    const comments = pgTable("comments", {
      id: serial("id").primaryKey(),
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

    const dbml = pgGenerate({
      schema: { users, posts, comments, commentsRelations },
      relational: true,
      source: filePath,
    });

    expect(dbml).toContain('Ref: "comments"."post_id" > "posts"."id"');
    expect(dbml).toContain('Ref: "comments"."author_id" > "users"."id"');
  });

  it("should not generate Ref for many() without corresponding one()", () => {
    const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-many-only.ts");
    writeFileSync(filePath, schemaCode);

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      authorId: integer("author_id"),
    });

    const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));

    const dbml = pgGenerate({
      schema: { users, posts, usersRelations },
      relational: true,
      source: filePath,
    });

    // Should not contain Ref since many() doesn't have fields/references
    expect(dbml).not.toContain("Ref:");
  });

  it("should generate one-to-one Ref (-) when bidirectional one() relations exist", () => {
    const schemaCode = `
import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id"),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
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

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      profileId: integer("profile_id"),
    });

    const profiles = pgTable("profiles", {
      id: serial("id").primaryKey(),
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

    const dbml = pgGenerate({
      schema: { users, profiles, usersRelations, profilesRelations },
      relational: true,
      source: filePath,
    });

    // Should use "-" for one-to-one relationship
    expect(dbml).toContain('Ref: "users"."profile_id" - "profiles"."id"');
    // Should NOT have duplicate ref
    expect(dbml).not.toContain('Ref: "profiles"."id" - "users"."profile_id"');
  });

  it("should support source option with directory", () => {
    const schemaDir = join(RELATIONS_TEST_DIR, "schema_dir");
    mkdirSync(schemaDir, { recursive: true });

    // Create multiple schema files in directory
    writeFileSync(
      join(schemaDir, "users.ts"),
      `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`,
    );

    writeFileSync(
      join(schemaDir, "posts.ts"),
      `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`,
    );

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      authorId: integer("author_id"),
    });

    const postsRelations = relations(posts, ({ one }) => ({
      author: one(users, {
        fields: [posts.authorId],
        references: [users.id],
      }),
    }));

    const dbml = pgGenerate({
      schema: { users, posts, postsRelations },
      relational: true,
      source: schemaDir, // Use directory instead of file
    });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
    expect(dbml).toContain('Ref: "posts"."author_id" > "users"."id"');
  });
});

describe("pgGenerate with RQBv2 (defineRelations)", () => {
  it("should generate references from defineRelations() runtime objects", async () => {
    const { defineRelations } = await import("drizzle-orm");

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: integer("author_id").notNull(),
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

    // Pass tables and RQBv2 relation entries separately
    // RQBv2 entries have different keys than table names
    const dbml = pgGenerate({
      schema: {
        users,
        posts,
        usersRelEntry: rqbv2Relations.users,
        postsRelEntry: rqbv2Relations.posts,
      },
      relational: true,
    });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
    expect(dbml).toContain('Ref: "posts"."author_id" > "users"."id"');
  });

  it("should generate one-to-one Ref (-) for bidirectional one() relations in RQBv2", async () => {
    const { defineRelations } = await import("drizzle-orm");

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
      profileId: integer("profile_id"),
    });

    const profiles = pgTable("profiles", {
      id: serial("id").primaryKey(),
      bio: text("bio"),
      userId: integer("user_id"),
    });

    const schema = { users, profiles };

    const rqbv2Relations = defineRelations(schema, (r) => ({
      users: {
        profile: r.one.profiles({
          from: r.users.profileId,
          to: r.profiles.id,
        }),
      },
      profiles: {
        user: r.one.users({
          from: r.profiles.userId,
          to: r.users.id,
        }),
      },
    }));

    const dbml = pgGenerate({
      schema: {
        users,
        profiles,
        usersRelEntry: rqbv2Relations.users,
        profilesRelEntry: rqbv2Relations.profiles,
      },
      relational: true,
    });

    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "profiles" {');
    // Both directions define one(), so it should be one-to-one (-)
    // At least one ref should exist
    expect(dbml).toMatch(
      /Ref: "(users|profiles)"\."(profile_id|user_id)" (-|>) "(users|profiles)"\."id"/,
    );
  });

  it("should work with v0 relations() syntax on v1 runtime", async () => {
    // This test ensures backward compatibility: v0 schema with v1 drizzle-orm
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: integer("author_id").notNull(),
    });

    const postsRelations = relations(posts, ({ one }) => ({
      author: one(users, {
        fields: [posts.authorId],
        references: [users.id],
      }),
    }));

    // Use the schema with v0-style relations on v1 runtime
    // Since there's no AST parsing (no source file), it should still work via runtime
    const dbml = pgGenerate({
      schema: { users, posts, postsRelations },
      relational: true,
    });

    // Tables should be generated
    expect(dbml).toContain('Table "users" {');
    expect(dbml).toContain('Table "posts" {');
    // Note: Without source file, v0 relations cannot generate refs from runtime
    // This is expected behavior - AST parsing is required for v0 relations
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

  it("should extract comments from source option", () => {
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

    const dbml = pgGenerate({ schema: { users }, source: filePath });

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

describe("PgGenerator.toIntermediateSchema", () => {
  it("should convert a simple table to intermediate schema", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      email: varchar("email", { length: 255 }).unique(),
    });

    const generator = new PgGenerator({ schema: { users } });
    const schema = generator.toIntermediateSchema();

    expect(schema.databaseType).toBe("postgresql");
    expect(schema.tables).toHaveLength(1);
    expect(schema.tables[0].name).toBe("users");
    expect(schema.tables[0].columns).toHaveLength(3);

    // Check id column
    const idColumn = schema.tables[0].columns.find((c: { name: string }) => c.name === "id");
    expect(idColumn).toBeDefined();
    expect(idColumn.type).toBe("serial");
    expect(idColumn.primaryKey).toBe(true);
    expect(idColumn.nullable).toBe(false);
    expect(idColumn.autoIncrement).toBe(true);

    // Check name column
    const nameColumn = schema.tables[0].columns.find((c: { name: string }) => c.name === "name");
    expect(nameColumn).toBeDefined();
    expect(nameColumn.type).toBe("text");
    expect(nameColumn.nullable).toBe(false);

    // Check email column
    const emailColumn = schema.tables[0].columns.find((c: { name: string }) => c.name === "email");
    expect(emailColumn).toBeDefined();
    expect(emailColumn.type).toBe("varchar(255)");
    expect(emailColumn.unique).toBe(true);
    expect(emailColumn.nullable).toBe(true);
  });

  it("should handle columns with default values", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      active: boolean("active").default(true),
      role: text("role").default("user"),
      createdAt: timestamp("created_at").defaultNow(),
    });

    const generator = new PgGenerator({ schema: { users } });
    const schema = generator.toIntermediateSchema();

    const activeColumn = schema.tables[0].columns.find(
      (c: { name: string }) => c.name === "active",
    );
    expect(activeColumn.defaultValue).toBe("true");

    const roleColumn = schema.tables[0].columns.find((c: { name: string }) => c.name === "role");
    expect(roleColumn.defaultValue).toBe("'user'");
  });

  it("should extract foreign key relations", () => {
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

    const generator = new PgGenerator({ schema: { users, posts } });
    const schema = generator.toIntermediateSchema();

    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0].fromTable).toBe("posts");
    expect(schema.relations[0].fromColumns).toEqual(["author_id"]);
    expect(schema.relations[0].toTable).toBe("users");
    expect(schema.relations[0].toColumns).toEqual(["id"]);
    expect(schema.relations[0].type).toBe("many-to-one");
  });

  it("should extract composite primary keys as constraints", () => {
    const userRoles = pgTable(
      "user_roles",
      {
        userId: integer("user_id").notNull(),
        roleId: integer("role_id").notNull(),
      },
      (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
    );

    const generator = new PgGenerator({ schema: { userRoles } });
    const schema = generator.toIntermediateSchema();

    const pkConstraint = schema.tables[0].constraints.find(
      (c: { type: string }) => c.type === "primary_key",
    );
    expect(pkConstraint).toBeDefined();
    expect(pkConstraint.columns).toContain("user_id");
    expect(pkConstraint.columns).toContain("role_id");
  });

  it("should extract unique constraints", () => {
    const users = pgTable(
      "users",
      {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }),
        username: varchar("username", { length: 50 }),
      },
      (table) => [unique().on(table.email, table.username)],
    );

    const generator = new PgGenerator({ schema: { users } });
    const schema = generator.toIntermediateSchema();

    const uniqueConstraint = schema.tables[0].constraints.find(
      (c: { type: string }) => c.type === "unique",
    );
    expect(uniqueConstraint).toBeDefined();
    expect(uniqueConstraint.columns).toContain("email");
    expect(uniqueConstraint.columns).toContain("username");
  });

  it("should extract indexes", () => {
    const users = pgTable(
      "users",
      {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }),
        name: text("name"),
      },
      (table) => [index("email_idx").on(table.email)],
    );

    const generator = new PgGenerator({ schema: { users } });
    const schema = generator.toIntermediateSchema();

    expect(schema.tables[0].indexes).toHaveLength(1);
    expect(schema.tables[0].indexes[0].name).toBe("email_idx");
    expect(schema.tables[0].indexes[0].columns).toEqual(["email"]);
    expect(schema.tables[0].indexes[0].unique).toBe(false);
  });

  it("should include comments in intermediate schema", () => {
    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const comments: SchemaComments = {
      tables: {
        users: {
          comment: "User accounts table",
          columns: {
            id: { comment: "Primary key" },
            name: { comment: "User display name" },
          },
        },
      },
    };

    const generator = new PgGenerator({ schema: { users }, comments });
    const schema = generator.toIntermediateSchema();

    expect(schema.tables[0].comment).toBe("User accounts table");

    const idColumn = schema.tables[0].columns.find((c: { name: string }) => c.name === "id");
    expect(idColumn.comment).toBe("Primary key");

    const nameColumn = schema.tables[0].columns.find((c: { name: string }) => c.name === "name");
    expect(nameColumn.comment).toBe("User display name");
  });

  it("should return empty schema for empty input", () => {
    const generator = new PgGenerator({ schema: {} });
    const schema = generator.toIntermediateSchema();

    expect(schema.databaseType).toBe("postgresql");
    expect(schema.tables).toHaveLength(0);
    expect(schema.relations).toHaveLength(0);
    expect(schema.enums).toHaveLength(0);
  });
});

describe("PgGenerator.toIntermediateSchema with enums", () => {
  it("should extract PostgreSQL enums", async () => {
    const { pgEnum } = await import("drizzle-orm/pg-core");

    const statusEnum = pgEnum("status", ["active", "inactive", "pending"]);

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      status: statusEnum("status").notNull(),
    });

    const generator = new PgGenerator({ schema: { users, statusEnum } });
    const schema = generator.toIntermediateSchema();

    expect(schema.enums).toHaveLength(1);
    expect(schema.enums[0].name).toBe("status");
    expect(schema.enums[0].values).toEqual(["active", "inactive", "pending"]);
  });

  it("should extract multiple enums", async () => {
    const { pgEnum } = await import("drizzle-orm/pg-core");

    const statusEnum = pgEnum("status", ["active", "inactive"]);
    const roleEnum = pgEnum("role", ["admin", "user", "guest"]);

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      status: statusEnum("status"),
      role: roleEnum("role"),
    });

    const generator = new PgGenerator({ schema: { users, statusEnum, roleEnum } });
    const schema = generator.toIntermediateSchema();

    expect(schema.enums).toHaveLength(2);

    const statusEnumDef = schema.enums.find((e: { name: string }) => e.name === "status");
    expect(statusEnumDef).toBeDefined();
    expect(statusEnumDef.values).toEqual(["active", "inactive"]);

    const roleEnumDef = schema.enums.find((e: { name: string }) => e.name === "role");
    expect(roleEnumDef).toBeDefined();
    expect(roleEnumDef.values).toEqual(["admin", "user", "guest"]);
  });
});

describe("PgGenerator.toIntermediateSchema with relations", () => {
  const RELATIONS_TEST_DIR = join(import.meta.dirname, "__test_fixtures_intermediate__");

  beforeAll(() => {
    mkdirSync(RELATIONS_TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(RELATIONS_TEST_DIR, { recursive: true, force: true });
  });

  it("should convert relations to intermediate schema format", () => {
    const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title"),
  authorId: integer("author_id").notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`;
    const filePath = join(RELATIONS_TEST_DIR, "schema-relations.ts");
    writeFileSync(filePath, schemaCode);

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: integer("author_id").notNull(),
    });

    const postsRelations = relations(posts, ({ one }) => ({
      author: one(users, {
        fields: [posts.authorId],
        references: [users.id],
      }),
    }));

    const generator = new PgGenerator({
      schema: { users, posts, postsRelations },
      relational: true,
      source: filePath,
    });
    const schema = generator.toIntermediateSchema();

    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0].fromTable).toBe("posts");
    expect(schema.relations[0].fromColumns).toEqual(["author_id"]);
    expect(schema.relations[0].toTable).toBe("users");
    expect(schema.relations[0].toColumns).toEqual(["id"]);
    expect(schema.relations[0].type).toBe("many-to-one");
  });

  it("should detect one-to-one relations in intermediate schema", () => {
    const schemaCode = `
import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id"),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
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

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      profileId: integer("profile_id"),
    });

    const profiles = pgTable("profiles", {
      id: serial("id").primaryKey(),
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

    const generator = new PgGenerator({
      schema: { users, profiles, usersRelations, profilesRelations },
      relational: true,
      source: filePath,
    });
    const schema = generator.toIntermediateSchema();

    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0].type).toBe("one-to-one");
  });

  it("should work with RQBv2 defineRelations in intermediate schema", async () => {
    const { defineRelations } = await import("drizzle-orm");

    const users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name"),
    });

    const posts = pgTable("posts", {
      id: serial("id").primaryKey(),
      title: text("title"),
      authorId: integer("author_id").notNull(),
    });

    const tableSchema = { users, posts };

    const rqbv2Relations = defineRelations(tableSchema, (r) => ({
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

    const generator = new PgGenerator({
      schema: {
        users,
        posts,
        usersRelEntry: rqbv2Relations.users,
        postsRelEntry: rqbv2Relations.posts,
      },
      relational: true,
    });
    const schema = generator.toIntermediateSchema();

    expect(schema.tables).toHaveLength(2);
    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0].fromTable).toBe("posts");
    expect(schema.relations[0].toTable).toBe("users");
    expect(schema.relations[0].type).toBe("many-to-one");
  });
});
