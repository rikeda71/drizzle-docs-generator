import { describe, it, expect } from "vitest";
import { MarkdownFormatter } from "./markdown";
import type { IntermediateSchema } from "../types";

describe("MarkdownFormatter", () => {
  describe("format", () => {
    it("should format a simple table", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
                autoIncrement: true,
              },
              {
                name: "name",
                type: "text",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "email",
                type: "varchar(255)",
                nullable: true,
                primaryKey: false,
                unique: true,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("# Tables");
      expect(markdown).toContain("| [users](#users) | 3 |");
      expect(markdown).toContain("## users");
      expect(markdown).toContain("### Columns");
      expect(markdown).toContain("| **id** | serial |");
      expect(markdown).toContain("| name | text |");
      expect(markdown).toContain("| email | varchar(255) |");
    });

    it("should format multiple tables", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "posts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "author_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("| [users](#users) | 1 |");
      expect(markdown).toContain("| [posts](#posts) | 2 |");
      expect(markdown).toContain("## users");
      expect(markdown).toContain("## posts");
    });

    it("should format columns with default values", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "active",
                type: "boolean",
                nullable: false,
                primaryKey: false,
                unique: false,
                defaultValue: "true",
              },
              {
                name: "role",
                type: "text",
                nullable: false,
                primaryKey: false,
                unique: false,
                defaultValue: "user",
              },
              {
                name: "created_at",
                type: "timestamp",
                nullable: false,
                primaryKey: false,
                unique: false,
                defaultValue: "now()",
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("`true`");
      expect(markdown).toContain("`user`");
      expect(markdown).toContain("`now()`");
    });

    it("should format empty schema", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("# Tables");
      expect(markdown).toContain("No tables defined.");
    });

    it("should format indexes", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "email",
                type: "varchar(255)",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [
              {
                name: "email_idx",
                columns: ["email"],
                unique: false,
              },
              {
                name: "email_unique_idx",
                columns: ["email"],
                unique: true,
              },
            ],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("### Indexes");
      expect(markdown).toContain("| email_idx | email | NO |");
      expect(markdown).toContain("| email_unique_idx | email | YES |");
    });

    it("should format relations", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "posts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "author_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [
          {
            fromTable: "posts",
            fromColumns: ["author_id"],
            toTable: "users",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("### Relations");
      expect(markdown).toContain("Many to One");
    });

    it("should format one-to-one relations", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "profile_id",
                type: "integer",
                nullable: true,
                primaryKey: false,
                unique: true,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "profiles",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [
          {
            fromTable: "users",
            fromColumns: ["profile_id"],
            toTable: "profiles",
            toColumns: ["id"],
            type: "one-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("### Relations");
      expect(markdown).toContain("One to One");
    });

    it("should format one-to-many relations", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "posts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "author_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [
          {
            fromTable: "users",
            fromColumns: ["id"],
            toTable: "posts",
            toColumns: ["author_id"],
            type: "one-to-many",
          },
        ],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("### Relations");
      expect(markdown).toContain("One to Many");
    });

    it("should format PostgreSQL enums", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "status",
                type: "user_status",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [
          {
            name: "user_status",
            values: ["active", "inactive", "pending"],
          },
        ],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("# Enums");
      expect(markdown).toContain("## user_status");
      expect(markdown).toContain("| active |");
      expect(markdown).toContain("| inactive |");
      expect(markdown).toContain("| pending |");
    });

    it("should include table comments", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            comment: "User accounts table",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      // Comment in index table
      expect(markdown).toContain("| [users](#users) | 1 | User accounts table |");
      // Comment in table section
      expect(markdown).toMatch(/## users\n\nUser accounts table/);
    });

    it("should include column comments", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
                comment: "Primary key",
              },
              {
                name: "name",
                type: "text",
                nullable: false,
                primaryKey: false,
                unique: false,
                comment: "User display name",
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("Primary key |");
      expect(markdown).toContain("User display name |");
    });

    it("should escape pipe characters in comments", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            comment: "Table with | pipe character",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
                comment: "Column | with pipe",
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("Table with \\| pipe character");
      expect(markdown).toContain("Column \\| with pipe");
    });

    it("should format constraints", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "email",
                type: "varchar(255)",
                nullable: false,
                primaryKey: false,
                unique: true,
              },
            ],
            indexes: [],
            constraints: [
              {
                name: "users_pkey",
                type: "primary_key",
                columns: ["id"],
              },
              {
                name: "users_email_unique",
                type: "unique",
                columns: ["email"],
              },
            ],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("### Constraints");
      expect(markdown).toContain("| users_pkey | PRIMARY KEY | (id) |");
      expect(markdown).toContain("| users_email_unique | UNIQUE | (email) |");
    });

    it("should format foreign key constraints", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "posts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "author_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [
              {
                name: "posts_author_fkey",
                type: "foreign_key",
                columns: ["author_id"],
                referencedTable: "users",
                referencedColumns: ["id"],
              },
            ],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      expect(markdown).toContain("### Constraints");
      expect(markdown).toContain("| posts_author_fkey | FOREIGN KEY | (author_id) → users(id) |");
    });

    it("should show nullable status correctly", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "nickname",
                type: "text",
                nullable: true,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      // id should be NO (not nullable)
      expect(markdown).toMatch(/\| \*\*id\*\* \| serial \| - \| NO \|/);
      // nickname should be YES (nullable)
      expect(markdown).toMatch(/\| nickname \| text \| - \| YES \|/);
    });

    it("should show parent/child relations in columns table", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "posts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "author_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [
          {
            fromTable: "posts",
            fromColumns: ["author_id"],
            toTable: "users",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      // users.id should have posts.author_id as child
      expect(markdown).toContain("[posts.author_id](#posts)");
      // posts.author_id should have users.id as parent
      expect(markdown).toContain("[users.id](#users)");
    });
  });

  describe("generateIndex", () => {
    it("should generate table index", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            comment: "User accounts",
            columns: [
              { name: "id", type: "serial", nullable: false, primaryKey: true, unique: false },
              { name: "name", type: "text", nullable: false, primaryKey: false, unique: false },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "posts",
            comment: "Blog posts",
            columns: [
              { name: "id", type: "serial", nullable: false, primaryKey: true, unique: false },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const index = formatter.generateIndex(schema);

      expect(index).toContain("# Tables");
      expect(index).toContain("| Name | Columns | Comment |");
      expect(index).toContain("| [users](#users) | 2 | User accounts |");
      expect(index).toContain("| [posts](#posts) | 1 | Blog posts |");
    });

    it("should handle empty tables", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const index = formatter.generateIndex(schema);

      expect(index).toContain("# Tables");
      expect(index).toContain("No tables defined.");
    });
  });

  describe("generateTableDoc", () => {
    it("should generate complete table documentation", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            comment: "User accounts table",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
                comment: "Primary key",
              },
              {
                name: "email",
                type: "varchar(255)",
                nullable: false,
                primaryKey: false,
                unique: true,
                comment: "User email",
              },
            ],
            indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
            constraints: [{ name: "users_pkey", type: "primary_key", columns: ["id"] }],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const tableDoc = formatter.generateTableDoc(schema.tables[0], schema);

      expect(tableDoc).toContain("## users");
      expect(tableDoc).toContain("User accounts table");
      expect(tableDoc).toContain("### Columns");
      expect(tableDoc).toContain("| **id** |");
      expect(tableDoc).toContain("| email |");
      expect(tableDoc).toContain("### Indexes");
      expect(tableDoc).toContain("| users_email_idx |");
      expect(tableDoc).toContain("### Constraints");
      expect(tableDoc).toContain("| users_pkey |");
    });
  });

  describe("formatter options", () => {
    it("should exclude comments when includeComments is false", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            comment: "User accounts table",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
                comment: "Primary key",
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter({ includeComments: false });
      const markdown = formatter.format(schema);

      // Table comment should not appear after heading
      expect(markdown).not.toMatch(/## users\n\nUser accounts table/);
      // Column comment should be "-"
      expect(markdown).toMatch(/\| \*\*id\*\* .* - \|$/m);
    });

    it("should exclude indexes when includeIndexes is false", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [{ name: "users_idx", columns: ["id"], unique: false }],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter({ includeIndexes: false });
      const markdown = formatter.format(schema);

      expect(markdown).not.toContain("### Indexes");
    });

    it("should exclude constraints when includeConstraints is false", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [{ name: "users_pkey", type: "primary_key", columns: ["id"] }],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter({ includeConstraints: false });
      const markdown = formatter.format(schema);

      expect(markdown).not.toContain("### Constraints");
    });

    it("should not use relative links when useRelativeLinks is false", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter({ useRelativeLinks: false });
      const markdown = formatter.format(schema);

      expect(markdown).toContain("| users | 1 |");
      expect(markdown).not.toContain("[users](#users)");
    });
  });

  describe("OutputFormatter interface", () => {
    it("should implement OutputFormatter interface", () => {
      const formatter = new MarkdownFormatter();
      expect(typeof formatter.format).toBe("function");
    });
  });

  describe("table names with underscores", () => {
    it("should preserve underscores in anchor links for table names", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "user_accounts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      // Table header should preserve underscore
      expect(markdown).toContain("## user_accounts");
      // Index table link should preserve underscore in anchor
      expect(markdown).toContain("| [user_accounts](#user_accounts) | 1 |");
    });

    it("should preserve underscores in anchor links for multiple underscore tables", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "post_tags",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "user_profiles",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      // Both table headers should preserve underscores
      expect(markdown).toContain("## post_tags");
      expect(markdown).toContain("## user_profiles");
      // Index table links should preserve underscores in anchors
      expect(markdown).toContain("| [post_tags](#post_tags) |");
      expect(markdown).toContain("| [user_profiles](#user_profiles) |");
    });

    it("should preserve underscores in relation links for underscore table names", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "user_accounts",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "post_tags",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "user_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [
          {
            fromTable: "post_tags",
            fromColumns: ["user_id"],
            toTable: "user_accounts",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(schema);

      // Relation links should preserve underscores in anchors
      expect(markdown).toContain("[user_accounts](#user_accounts)");
      expect(markdown).toContain("[post_tags](#post_tags)");
    });
  });
});
