import { describe, it, expect } from "vitest";
import { DbmlFormatter } from "./dbml";
import type { IntermediateSchema } from "../types";

describe("DbmlFormatter", () => {
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Table users {");
      expect(dbml).toContain("id serial [primary key, not null, increment]");
      expect(dbml).toContain("name text [not null]");
      expect(dbml).toContain("email varchar(255) [unique]");
      expect(dbml).toContain("}");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Table users {");
      expect(dbml).toContain("Table posts {");
      expect(dbml).toContain("author_id integer [not null]");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("default: true");
      expect(dbml).toContain("default: 'user'");
      expect(dbml).toContain("default: `now()`");
    });

    it("should format empty schema", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [],
        relations: [],
        enums: [],
      };

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toBe("");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("indexes {");
      expect(dbml).toContain("(email) [name: 'email_idx']");
      expect(dbml).toContain("(email) [unique, name: 'email_unique_idx']");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Ref: posts.author_id > users.id");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Ref: users.profile_id - profiles.id");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Ref: users.id < posts.author_id");
    });

    it("should format relations with onDelete and onUpdate", () => {
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
            onDelete: "CASCADE",
            onUpdate: "SET NULL",
          },
        ],
        enums: [],
      };

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Ref: posts.author_id > users.id [delete: cascade, update: set null]");
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Enum user_status {");
      expect(dbml).toContain("active");
      expect(dbml).toContain("inactive");
      expect(dbml).toContain("pending");
    });

    it("should include table comments as Note", () => {
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Note: 'User accounts table'");
    });

    it("should include column comments as note attribute", () => {
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("note: 'Primary key'");
      expect(dbml).toContain("note: 'User display name'");
    });

    it("should escape special characters in comments", () => {
      const schema: IntermediateSchema = {
        databaseType: "postgresql",
        tables: [
          {
            name: "users",
            comment: "User's table with 'quotes'",
            columns: [
              {
                name: "id",
                type: "serial",
                nullable: false,
                primaryKey: true,
                unique: false,
                comment: "It's the primary key",
              },
            ],
            indexes: [],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain("Note: 'User\\'s table with \\'quotes\\''");
      expect(dbml).toContain("note: 'It\\'s the primary key'");
    });

    it("should escape names with special characters", () => {
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

      const formatter = new DbmlFormatter();
      const dbml = formatter.format(schema);

      expect(dbml).toContain('Table "user-accounts" {');
      expect(dbml).toContain('"user-id" serial');
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

      const formatter = new DbmlFormatter({ includeComments: false });
      const dbml = formatter.format(schema);

      expect(dbml).not.toContain("Note:");
      expect(dbml).not.toContain("note:");
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
            ],
            constraints: [],
          },
        ],
        relations: [],
        enums: [],
      };

      const formatter = new DbmlFormatter({ includeIndexes: false });
      const dbml = formatter.format(schema);

      expect(dbml).not.toContain("indexes {");
    });
  });

  describe("OutputFormatter interface", () => {
    it("should implement OutputFormatter interface", () => {
      const formatter = new DbmlFormatter();
      expect(typeof formatter.format).toBe("function");
    });
  });
});
