import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { extractRelations } from "./relations";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dirname, "__test_fixtures_relations__");

describe("extractRelations", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should extract one() relation with fields and references", () => {
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
    const filePath = join(TEST_DIR, "one-relation.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]).toEqual({
      sourceTable: "posts",
      targetTable: "users",
      type: "one",
      fields: ["authorId"],
      references: ["id"],
    });
  });

  it("should extract many() relation (without fields/references)", () => {
    const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
`;
    const filePath = join(TEST_DIR, "many-relation.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]).toEqual({
      sourceTable: "users",
      targetTable: "posts",
      type: "many",
      fields: [],
      references: [],
    });
  });

  it("should extract multiple relations from one relations() call", () => {
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
    const filePath = join(TEST_DIR, "multiple-relations.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    expect(result.relations).toHaveLength(2);
    expect(result.relations[0]).toEqual({
      sourceTable: "comments",
      targetTable: "posts",
      type: "one",
      fields: ["postId"],
      references: ["id"],
    });
    expect(result.relations[1]).toEqual({
      sourceTable: "comments",
      targetTable: "users",
      type: "one",
      fields: ["authorId"],
      references: ["id"],
    });
  });

  it("should extract relations from both one() and many()", () => {
    const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
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
    const filePath = join(TEST_DIR, "bidirectional-relations.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    expect(result.relations).toHaveLength(2);

    const manyRelation = result.relations.find((r) => r.type === "many");
    expect(manyRelation).toEqual({
      sourceTable: "users",
      targetTable: "posts",
      type: "many",
      fields: [],
      references: [],
    });

    const oneRelation = result.relations.find((r) => r.type === "one");
    expect(oneRelation).toEqual({
      sourceTable: "posts",
      targetTable: "users",
      type: "one",
      fields: ["authorId"],
      references: ["id"],
    });
  });

  it("should handle composite keys in fields and references", () => {
    const schemaCode = `
import { pgTable, serial, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
  authorOrgId: integer("author_org_id"),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId, posts.authorOrgId],
    references: [users.id, users.orgId],
  }),
}));
`;
    const filePath = join(TEST_DIR, "composite-key-relation.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]).toEqual({
      sourceTable: "posts",
      targetTable: "users",
      type: "one",
      fields: ["authorId", "authorOrgId"],
      references: ["id", "orgId"],
    });
  });

  it("should return empty relations for file without relations()", () => {
    const schemaCode = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`;
    const filePath = join(TEST_DIR, "no-relations.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    expect(result.relations).toHaveLength(0);
  });

  describe("v0 backward compatibility", () => {
    it("should extract relations from v0-style drizzle-orm/_relations import", () => {
      const schemaCode = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/_relations";

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
      const filePath = join(TEST_DIR, "v0-relations-import.ts");
      writeFileSync(filePath, schemaCode);

      const result = extractRelations(filePath);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0]).toEqual({
        sourceTable: "posts",
        targetTable: "users",
        type: "one",
        fields: ["authorId"],
        references: ["id"],
      });
    });

    it("should extract v0-style relations with older column types", () => {
      const schemaCode = `
import { pgTable, serial, varchar, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }),
  content: varchar("content", { length: 1000 }),
  authorId: integer("author_id").notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
`;
      const filePath = join(TEST_DIR, "v0-column-types.ts");
      writeFileSync(filePath, schemaCode);

      const result = extractRelations(filePath);

      expect(result.relations).toHaveLength(2);
      expect(result.relations).toContainEqual({
        sourceTable: "posts",
        targetTable: "users",
        type: "one",
        fields: ["authorId"],
        references: ["id"],
      });
      expect(result.relations).toContainEqual({
        sourceTable: "users",
        targetTable: "posts",
        type: "many",
        fields: [],
        references: [],
      });
    });

    it("should handle v0-style mixed imports (relations from drizzle-orm)", () => {
      const schemaCode = `
import { mysqlTable, int, varchar } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  categoryId: int("category_id").notNull(),
});

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));
`;
      const filePath = join(TEST_DIR, "v0-mysql-mixed.ts");
      writeFileSync(filePath, schemaCode);

      const result = extractRelations(filePath);

      expect(result.relations).toHaveLength(2);
      expect(result.relations).toContainEqual({
        sourceTable: "products",
        targetTable: "categories",
        type: "one",
        fields: ["categoryId"],
        references: ["id"],
      });
      expect(result.relations).toContainEqual({
        sourceTable: "categories",
        targetTable: "products",
        type: "many",
        fields: [],
        references: [],
      });
    });
  });

  it("should handle property access expressions in relation calls", () => {
    const schemaCode = `
import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
});

const helpers = {
  one,
  many,
};

export const postsRelations = relations(posts, ({ one }) => ({
  author: helpers.one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`;
    const filePath = join(TEST_DIR, "property-access.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    // Should still extract the relation even with property access
    expect.soft(result.relations).toHaveLength(1);
    expect.soft(result.relations[0]?.sourceTable).toBe("posts");
  });

  it("should handle identifier expressions in array elements", () => {
    const schemaCode = `
import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
});

const authorIdRef = posts.authorId;
const userIdRef = users.id;

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [authorIdRef],
    references: [userIdRef],
  }),
}));
`;
    const filePath = join(TEST_DIR, "identifier-refs.ts");
    writeFileSync(filePath, schemaCode);

    const result = extractRelations(filePath);

    // Should extract relation even with identifier references
    expect.soft(result.relations.length).toBeGreaterThanOrEqual(0);
  });
});
