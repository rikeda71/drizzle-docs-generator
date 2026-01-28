/**
 * PostgreSQL example schema for integration testing
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
 * - Nullable foreign keys (Issue #117)
 */

import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  uuid,
  boolean,
  timestamp,
  primaryKey,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/_relations";

/** User accounts table storing basic user information */
export const users = pgTable(
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
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
    }),
    index("posts_author_idx").on(table.authorId),
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
    name: varchar("name", { length: 50 }).unique().notNull(),
    /** Tag color for display */
    color: varchar("color", { length: 7 }).default("#000000"),
  },
  (table) => [unique("tags_name_unique").on(table.name)],
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

/** Discount coupons */
export const coupons = pgTable("coupons", {
  /** Auto-generated unique identifier */
  id: uuid("id").defaultRandom().primaryKey(),
  /** Coupon code */
  code: varchar("code", { length: 50 }).notNull().unique(),
  /** Discount percentage */
  discountPercent: integer("discount_percent").notNull(),
});

/** Orders with optional coupon reference */
export const orders = pgTable(
  "orders",
  {
    /** Auto-generated unique identifier */
    id: uuid("id").defaultRandom().primaryKey(),
    /** ID of the user who placed the order */
    userId: integer("user_id").notNull(),
    /** Optional coupon applied to this order (nullable foreign key) */
    couponId: uuid("coupon_id"),
    /** Total order amount in cents */
    totalCents: integer("total_cents").notNull(),
    /** Timestamp when the order was created */
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
    foreignKey({
      columns: [table.couponId],
      foreignColumns: [coupons.id],
      onDelete: "set null",
    }),
    index("orders_user_idx").on(table.userId),
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

export const couponsRelations = relations(coupons, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  coupon: one(coupons, {
    fields: [orders.couponId],
    references: [coupons.id],
  }),
}));
