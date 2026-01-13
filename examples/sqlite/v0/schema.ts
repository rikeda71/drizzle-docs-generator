/**
 * SQLite example schema for integration testing
 *
 * This schema includes all features that should be tested:
 * - Multiple tables with various column types
 * - Primary keys (single and composite)
 * - Foreign key references
 * - Unique constraints
 * - Indexes
 * - Default values (literal and SQL expressions)
 * - JSDoc comments (table and column)
 * - Relations definitions
 */

import {
  sqliteTable,
  integer,
  text,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm/_relations";

/** User accounts table storing basic user information */
export const users = sqliteTable(
  "users",
  {
    /** Auto-generated unique identifier */
    id: integer("id").primaryKey(),
    /** User's display name */
    name: text("name").notNull(),
    /** Email address (must be unique) */
    email: text("email").unique().notNull(),
    /** Whether the user account is active */
    active: integer("active", { mode: "boolean" }).default(true),
    /** Timestamp when the user was created (stored as unix timestamp) */
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => [index("users_email_idx").on(table.email)],
);

/** Blog posts created by users */
export const posts = sqliteTable(
  "posts",
  {
    /** Auto-generated unique identifier */
    id: integer("id").primaryKey(),
    /** Post title */
    title: text("title").notNull(),
    /** Post content body */
    content: text("content"),
    /** Whether the post is published */
    published: integer("published", { mode: "boolean" }).default(false),
    /** ID of the post author */
    authorId: integer("author_id").notNull(),
    /** Timestamp when the post was created (stored as unix timestamp) */
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => [
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
    }),
    index("posts_author_idx").on(table.authorId),
  ],
);

/** Comments on posts */
export const comments = sqliteTable(
  "comments",
  {
    /** Auto-generated unique identifier */
    id: integer("id").primaryKey(),
    /** Comment text */
    body: text("body").notNull(),
    /** ID of the post this comment belongs to */
    postId: integer("post_id").notNull(),
    /** ID of the user who wrote the comment */
    authorId: integer("author_id").notNull(),
    /** Timestamp when the comment was created (stored as unix timestamp) */
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [posts.id],
    }),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
    }),
  ],
);

/** Tags for categorizing posts */
export const tags = sqliteTable(
  "tags",
  {
    /** Auto-generated unique identifier */
    id: integer("id").primaryKey(),
    /** Tag name (must be unique) */
    name: text("name").unique().notNull(),
    /** Tag color for display */
    color: text("color").default("#000000"),
  },
  (table) => [unique("tags_name_unique").on(table.name)],
);

/** Join table for many-to-many relationship between posts and tags */
export const postTags = sqliteTable(
  "post_tags",
  {
    /** ID of the post */
    postId: integer("post_id").notNull(),
    /** ID of the tag */
    tagId: integer("tag_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    foreignKey({
      columns: [table.postId],
      foreignColumns: [posts.id],
    }),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.id],
    }),
  ],
);

// Relations definitions for Drizzle ORM relational queries

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
  postTags: many(postTags),
}));

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

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));
