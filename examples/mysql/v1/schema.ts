/**
 * MySQL example schema for v1 defineRelations API
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
  mysqlTable,
  serial,
  text,
  varchar,
  int,
  boolean,
  timestamp,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/mysql-core";
import { defineRelations } from "drizzle-orm";

/** User accounts table storing basic user information */
export const users = mysqlTable(
  "users",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** User's display name */
    name: varchar("name", { length: 100 }).notNull(),
    /** Email address (must be unique) */
    email: varchar("email", { length: 255 }).unique().notNull(),
    /** Whether the user account is active */
    active: boolean("active").default(true),
    /** Timestamp when the user was created */
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("users_email_idx").on(table.email)],
);

/** Blog posts created by users */
export const posts = mysqlTable(
  "posts",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** Post title */
    title: varchar("title", { length: 200 }).notNull(),
    /** Post content body */
    content: text("content"),
    /** Whether the post is published */
    published: boolean("published").default(false),
    /** ID of the post author */
    authorId: int("author_id").notNull(),
    /** Timestamp when the post was created */
    createdAt: timestamp("created_at").defaultNow(),
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
export const comments = mysqlTable(
  "comments",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** Comment text */
    body: text("body").notNull(),
    /** ID of the post this comment belongs to */
    postId: int("post_id").notNull(),
    /** ID of the user who wrote the comment */
    authorId: int("author_id").notNull(),
    /** Timestamp when the comment was created */
    createdAt: timestamp("created_at").defaultNow(),
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
export const tags = mysqlTable(
  "tags",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** Tag name (must be unique) */
    name: varchar("name", { length: 50 }).unique().notNull(),
    /** Tag color for display */
    color: varchar("color", { length: 7 }).default("#000000"),
  },
  (table) => [unique("tags_name_unique").on(table.name)],
);

/** Join table for many-to-many relationship between posts and tags */
export const postTags = mysqlTable(
  "post_tags",
  {
    /** ID of the post */
    postId: int("post_id").notNull(),
    /** ID of the tag */
    tagId: int("tag_id").notNull(),
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

export const schema = defineRelations({
  users: (r) => ({
    posts: r.many(posts),
    comments: r.many(comments),
  }),
  posts: (r) => ({
    author: r.one(users, {
      fields: [posts.authorId],
      references: [users.id],
    }),
    comments: r.many(comments),
    postTags: r.many(postTags),
  }),
  comments: (r) => ({
    post: r.one(posts, {
      fields: [comments.postId],
      references: [posts.id],
    }),
    author: r.one(users, {
      fields: [comments.authorId],
      references: [users.id],
    }),
  }),
  tags: (r) => ({
    postTags: r.many(postTags),
  }),
  postTags: (r) => ({
    post: r.one(posts, {
      fields: [postTags.postId],
      references: [posts.id],
    }),
    tag: r.one(tags, {
      fields: [postTags.tagId],
      references: [tags.id],
    }),
  }),
});
