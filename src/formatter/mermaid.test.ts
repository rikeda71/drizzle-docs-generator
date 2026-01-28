import { describe, it, expect } from "vitest";
import { MermaidErDiagramFormatter } from "./mermaid";
import type { IntermediateSchema } from "../types";

describe("MermaidErDiagramFormatter", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain("erDiagram");
      expect(mermaid).toContain("users {");
      expect(mermaid).toContain("serial id PK");
      expect(mermaid).toContain("text name");
      expect(mermaid).toContain("varchar email UK");
      expect(mermaid).toContain("}");
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain("users {");
      expect(mermaid).toContain("posts {");
      expect(mermaid).toContain("int author_id");
    });

    it("should format empty schema", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [],
        relations: [],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toBe("erDiagram");
    });

    it("should include column comments when enabled", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain('"Primary key"');
      expect(mermaid).toContain('"User display name"');
    });

    it("should escape special characters in comments", () => {
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
                comment: 'It\'s the "primary" key',
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain('It\'s the \\"primary\\" key');
    });

    it("should handle names with special characters", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "user-accounts",
            columns: [
              {
                name: "user-id",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // Special characters should be replaced with underscores
      expect(mermaid).toContain("user_accounts {");
      expect(mermaid).toContain("user_id");
    });
  });

  describe("relations", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // profile_id is nullable, so it should use ||--o| (optional one-to-one)
      expect(mermaid).toContain('users ||--o| profiles : "profile_id"');
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain('users ||--o{ posts : "id"');
    });

    it("should format many-to-one relations", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain('posts }o--|| users : "author_id"');
    });

    it("should format many-to-many relations", () => {
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
            name: "groups",
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
            name: "user_groups",
            columns: [
              {
                name: "user_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "group_id",
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
            toTable: "groups",
            toColumns: ["id"],
            type: "many-to-many",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain('users }o--o{ groups : "id"');
    });

    it("should mark FK columns correctly", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // author_id should be marked as FK
      expect(mermaid).toContain("int author_id FK");
    });

    it("should handle composite foreign keys", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "orders",
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
            name: "order_items",
            columns: [
              {
                name: "order_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "product_id",
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
            fromTable: "order_items",
            fromColumns: ["order_id", "product_id"],
            toTable: "orders",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain("int order_id FK");
      expect(mermaid).toContain("int product_id FK");
      expect(mermaid).toContain(': "order_id, product_id"');
    });

    it("should use optional one notation for nullable foreign keys in many-to-one relations", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "coupons",
            columns: [
              {
                name: "id",
                type: "uuid",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "code",
                type: "text",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "orders",
            columns: [
              {
                name: "id",
                type: "uuid",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "coupon_id",
                type: "uuid",
                nullable: true,
                primaryKey: false,
                unique: false,
              },
              {
                name: "total_cents",
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
            fromTable: "orders",
            fromColumns: ["coupon_id"],
            toTable: "coupons",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // Should use }o--o| for nullable foreign key (optional one)
      expect(mermaid).toContain('orders }o--o| coupons : "coupon_id"');
    });

    it("should use required one notation for non-nullable foreign keys in many-to-one relations", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // Should use }o--|| for non-nullable foreign key (required one)
      expect(mermaid).toContain('posts }o--|| users : "author_id"');
    });

    it("should use optional one notation for nullable foreign keys in one-to-one relations", () => {
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
            name: "profiles",
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
                nullable: true,
                primaryKey: false,
                unique: true,
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [
          {
            fromTable: "profiles",
            fromColumns: ["user_id"],
            toTable: "users",
            toColumns: ["id"],
            type: "one-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // Should use ||--o| for nullable foreign key (optional one-to-one)
      expect(mermaid).toContain('profiles ||--o| users : "user_id"');
    });
  });

  describe("formatFocused", () => {
    it("should return only erDiagram for non-existent table", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.formatFocused(schema, "nonexistent");

      expect(mermaid).toBe("erDiagram");
    });

    it("should include only the focused table when no relations", () => {
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
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.formatFocused(schema, "users");

      expect(mermaid).toContain("users {");
      expect(mermaid).not.toContain("posts {");
    });

    it("should include related tables through relations", () => {
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
          {
            name: "comments",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "post_id",
                type: "integer",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
            ],
            indexes: [],
            constraints: [],
          },
          {
            name: "tags",
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
            fromTable: "posts",
            fromColumns: ["author_id"],
            toTable: "users",
            toColumns: ["id"],
            type: "many-to-one",
          },
          {
            fromTable: "comments",
            fromColumns: ["post_id"],
            toTable: "posts",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.formatFocused(schema, "posts");

      // Should include posts (focused), users (related via author_id), comments (related via post_id)
      expect(mermaid).toContain("posts {");
      expect(mermaid).toContain("users {");
      expect(mermaid).toContain("comments {");
      // Should not include tags (unrelated)
      expect(mermaid).not.toContain("tags {");
      // Should include relevant relations
      expect(mermaid).toContain('posts }o--|| users : "author_id"');
      expect(mermaid).toContain('comments }o--|| posts : "post_id"');
    });

    it("should correctly mark FK columns in focused view", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.formatFocused(schema, "users");

      // author_id should be marked as FK in the focused view
      expect(mermaid).toContain("int author_id FK");
    });
  });

  describe("formatter options", () => {
    it("should exclude comments when includeComments is false", () => {
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
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter({ includeComments: false });
      const mermaid = formatter.format(schema);

      expect(mermaid).not.toContain("Primary key");
      expect(mermaid).not.toContain('"');
    });

    it("should exclude column types when includeColumnTypes is false", () => {
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
                name: "name",
                type: "text",
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

      const formatter = new MermaidErDiagramFormatter({ includeColumnTypes: false });
      const mermaid = formatter.format(schema);

      expect(mermaid).not.toContain("serial");
      expect(mermaid).not.toContain("text");
      expect(mermaid).toContain("id PK");
      expect(mermaid).toContain("name");
    });
  });

  describe("type simplification", () => {
    it("should simplify varchar(255) to varchar", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "email",
                type: "varchar(255)",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain("varchar email");
      expect(mermaid).not.toContain("varchar(255)");
    });

    it("should map integer to int", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            columns: [
              {
                name: "age",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect(mermaid).toContain("int age");
    });

    it("should map 'timestamp with time zone' to timestamptz", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "invites",
            columns: [
              {
                name: "id",
                type: "uuid",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "created_at",
                type: "timestamp with time zone",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect.soft(mermaid).toContain("timestamptz created_at");
      expect.soft(mermaid).not.toContain("timestamp with time zone");
    });

    it("should map 'time with time zone' to timetz", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "events",
            columns: [
              {
                name: "start_time",
                type: "time with time zone",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect.soft(mermaid).toContain("timetz start_time");
      expect.soft(mermaid).not.toContain("time with time zone");
    });

    it("should map 'double precision' to double", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "measurements",
            columns: [
              {
                name: "value",
                type: "double precision",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect.soft(mermaid).toContain("double value");
      expect.soft(mermaid).not.toContain("double precision");
    });

    it("should map MySQL unsigned types correctly", () => {
      const schema: IntermediateSchema = {
        databaseType: "mysql",
        tables: [
          {
            name: "counters",
            columns: [
              {
                name: "small_count",
                type: "tinyint unsigned",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "medium_count",
                type: "int unsigned",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "big_count",
                type: "bigint unsigned",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "float_val",
                type: "float unsigned",
                nullable: false,
                primaryKey: false,
                unique: false,
              },
              {
                name: "double_val",
                type: "double unsigned",
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      expect.soft(mermaid).toContain("utinyint small_count");
      expect.soft(mermaid).toContain("uint medium_count");
      expect.soft(mermaid).toContain("ubigint big_count");
      expect.soft(mermaid).toContain("ufloat float_val");
      expect.soft(mermaid).toContain("udouble double_val");
      expect.soft(mermaid).not.toContain(" unsigned");
    });
  });

  describe("includeColumns option", () => {
    it("should exclude columns when includeColumns is false", () => {
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
                name: "name",
                type: "text",
                nullable: false,
                primaryKey: false,
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
            fromTable: "posts",
            fromColumns: ["user_id"],
            toTable: "users",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter({ includeColumns: false });
      const mermaid = formatter.format(schema);

      // Should not contain column definitions
      expect.soft(mermaid).not.toContain("users {");
      expect.soft(mermaid).not.toContain("posts {");
      expect.soft(mermaid).not.toContain("serial id PK");
      expect.soft(mermaid).not.toContain("text name");
      expect.soft(mermaid).not.toContain("integer user_id");

      // Should still contain table names
      expect.soft(mermaid).toContain("users");
      expect.soft(mermaid).toContain("posts");

      // Should still contain relations
      expect.soft(mermaid).toContain("posts }o--|| users");
    });

    it("should include columns when includeColumns is true (default)", () => {
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
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter({ includeColumns: true });
      const mermaid = formatter.format(schema);

      // Should contain column definitions
      expect.soft(mermaid).toContain("users {");
      expect.soft(mermaid).toContain("serial id PK");
      expect.soft(mermaid).toContain("varchar email UK");
      expect.soft(mermaid).toContain("}");
    });

    it("should include columns by default when includeColumns is not specified", () => {
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

      const formatter = new MermaidErDiagramFormatter();
      const mermaid = formatter.format(schema);

      // Should contain column definitions by default
      expect.soft(mermaid).toContain("users {");
      expect.soft(mermaid).toContain("serial id PK");
      expect.soft(mermaid).toContain("}");
    });

    it("should maintain relations even when columns are excluded", () => {
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
          {
            name: "comments",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
              },
              {
                name: "post_id",
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
            fromColumns: ["user_id"],
            toTable: "users",
            toColumns: ["id"],
            type: "many-to-one",
          },
          {
            fromTable: "comments",
            fromColumns: ["post_id"],
            toTable: "posts",
            toColumns: ["id"],
            type: "many-to-one",
          },
        ],
        enums: [],
      };

      const formatter = new MermaidErDiagramFormatter({ includeColumns: false });
      const mermaid = formatter.format(schema);

      // Relations should be present
      expect.soft(mermaid).toContain("posts }o--|| users");
      expect.soft(mermaid).toContain("comments }o--|| posts");

      // Column definitions should not be present (check for entity block syntax)
      expect.soft(mermaid).not.toContain("users {");
      expect.soft(mermaid).not.toContain("posts {");
      expect.soft(mermaid).not.toContain("comments {");
      // Check for closing brace on its own line (entity definition closing)
      expect.soft(mermaid).not.toMatch(/^\s+\}$/m);
    });
  });

  describe("OutputFormatter interface", () => {
    it("should implement OutputFormatter interface", () => {
      const formatter = new MermaidErDiagramFormatter();
      expect(typeof formatter.format).toBe("function");
    });
  });
});
