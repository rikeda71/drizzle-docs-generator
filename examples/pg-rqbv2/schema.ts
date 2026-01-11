/**
 * PostgreSQL example schema using RQBv2 (defineRelations)
 *
 * This schema demonstrates the new Drizzle ORM v1 API:
 * - Tables defined with pgTable
 * - Relations defined with defineRelations() instead of relations()
 * - JSDoc comments for documentation
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";

/** User accounts table storing basic user information */
export const users = pgTable(
  "users",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** User's display name */
    name: varchar("name", { length: 100 }).notNull(),
    /** Email address (must be unique) */
    email: varchar("email", { length: 255 }).notNull().unique(),
    /** Whether the user account is active */
    active: boolean("active").default(true),
    /** Timestamp when the user was created */
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index().on(table.email)],
);

/** Blog posts created by users */
export const posts = pgTable(
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
    authorId: integer("author_id").notNull(),
    /** Timestamp when the post was created */
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index().on(table.authorId),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
    }),
  ],
);

/** Comments on posts */
export const comments = pgTable(
  "comments",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** Comment text */
    body: text("body").notNull(),
    /** ID of the post this comment belongs to */
    postId: integer("post_id").notNull(),
    /** ID of the user who wrote the comment */
    authorId: integer("author_id").notNull(),
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
export const tags = pgTable(
  "tags",
  {
    /** Auto-generated unique identifier */
    id: serial("id").primaryKey(),
    /** Tag name (must be unique) */
    name: varchar("name", { length: 50 }).notNull().unique(),
    /** Tag color for display */
    color: varchar("color", { length: 7 }).default("#000000"),
  },
  (table) => [unique().on(table.name)],
);

/** Join table for many-to-many relationship between posts and tags */
export const postTags = pgTable(
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

// Schema object for defineRelations
const schema = { users, posts, comments, tags, postTags };

/**
 * Relations defined using RQBv2 (defineRelations)
 * This is the new v1 API for defining relations
 */
export const relations = defineRelations(schema, (r) => ({
  users: {
    /** Posts written by this user */
    posts: r.many.posts(),
    /** Comments written by this user */
    comments: r.many.comments(),
  },
  posts: {
    /** Author of this post */
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    /** Comments on this post */
    comments: r.many.comments(),
    /** Tags associated with this post */
    postTags: r.many.postTags(),
  },
  comments: {
    /** Post this comment belongs to */
    post: r.one.posts({
      from: r.comments.postId,
      to: r.posts.id,
    }),
    /** Author of this comment */
    author: r.one.users({
      from: r.comments.authorId,
      to: r.users.id,
    }),
  },
  tags: {
    /** Posts associated with this tag */
    postTags: r.many.postTags(),
  },
  postTags: {
    /** Post in this relationship */
    post: r.one.posts({
      from: r.postTags.postId,
      to: r.posts.id,
    }),
    /** Tag in this relationship */
    tag: r.one.tags({
      from: r.postTags.tagId,
      to: r.tags.id,
    }),
  },
}));
