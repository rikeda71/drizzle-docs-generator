/**
 * SQLite example schema for v1 defineRelations API
 *
 * This schema demonstrates the modern v1 defineRelations() API
 * which is the recommended approach for defining relations in Drizzle v1+
 *
 * Key features:
 * - Uses defineRelations() from drizzle-orm
 * - Cleaner, more modern relation definitions
 * - Supports bidirectional relation queries
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
import { defineRelations } from "drizzle-orm";

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

// v1 Relations using defineRelations() API
const schema = {
  users,
  posts,
  comments,
  tags,
  postTags,
};

export const relationsConfig = defineRelations(schema, (r) => ({
  users: {
    posts: r.many.posts(),
    comments: r.many.comments(),
  },
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    comments: r.many.comments(),
    postTags: r.many.postTags(),
  },
  comments: {
    post: r.one.posts({
      from: r.comments.postId,
      to: r.posts.id,
    }),
    author: r.one.users({
      from: r.comments.authorId,
      to: r.users.id,
    }),
  },
  tags: {
    postTags: r.many.postTags(),
  },
  postTags: {
    post: r.one.posts({
      from: r.postTags.postId,
      to: r.posts.id,
    }),
    tag: r.one.tags({
      from: r.postTags.tagId,
      to: r.tags.id,
    }),
  },
}));
