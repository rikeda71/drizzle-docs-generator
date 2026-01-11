import { describe, it, expect } from "vitest";
import { generateDbml } from "./index.js";
import type { ParsedSchema } from "../types.js";

describe("generateDbml", () => {
  it("should generate empty string for empty schema", () => {
    const schema: ParsedSchema = {
      tables: [],
      relations: [],
    };

    const result = generateDbml(schema);
    expect(result).toBe("");
  });

  it("should generate DBML for a simple table", () => {
    const schema: ParsedSchema = {
      tables: [
        {
          name: "users",
          columns: [
            { name: "id", type: "integer", primaryKey: true },
            { name: "name", type: "varchar" },
            { name: "email", type: "varchar", unique: true, notNull: true },
          ],
        },
      ],
      relations: [],
    };

    const result = generateDbml(schema);
    expect(result).toContain("Table users {");
    expect(result).toContain("id integer [primary key]");
    expect(result).toContain("email varchar [unique, not null]");
    expect(result).toContain("}");
  });

  it("should include table comments as Note", () => {
    const schema: ParsedSchema = {
      tables: [
        {
          name: "users",
          columns: [{ name: "id", type: "integer", primaryKey: true }],
          comment: "User accounts table",
        },
      ],
      relations: [],
    };

    const result = generateDbml(schema);
    expect(result).toContain("Note: 'User accounts table'");
  });

  it("should include column comments as note attribute", () => {
    const schema: ParsedSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              type: "integer",
              primaryKey: true,
              comment: "Primary key",
            },
          ],
        },
      ],
      relations: [],
    };

    const result = generateDbml(schema);
    expect(result).toContain("note: 'Primary key'");
  });
});
