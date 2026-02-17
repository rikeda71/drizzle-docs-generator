import { describe, it, expect } from "vitest";
import { resolveSchemaExports } from "./resolve-schema-exports";

describe("resolveSchemaExports", () => {
  it("should pass through ESM named exports unchanged", () => {
    const mod = { users: { name: "users" }, posts: { name: "posts" } };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({ users: { name: "users" }, posts: { name: "posts" } });
  });

  it("should unwrap CJS default export object", () => {
    const mod = {
      default: { users: { name: "users" }, posts: { name: "posts" } },
    };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({ users: { name: "users" }, posts: { name: "posts" } });
  });

  it("should merge CJS default with named exports, preferring named", () => {
    const mod = {
      default: { users: { name: "users-default" }, posts: { name: "posts" } },
      users: { name: "users-named" },
    };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({
      users: { name: "users-named" },
      posts: { name: "posts" },
    });
  });

  it("should not unwrap default if it is not an object", () => {
    const mod = { default: "not-an-object", users: { name: "users" } };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({ default: "not-an-object", users: { name: "users" } });
  });

  it("should not unwrap default if it is an array", () => {
    const mod = { default: [1, 2, 3] };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({ default: [1, 2, 3] });
  });

  it("should not unwrap default if it is null", () => {
    const mod = { default: null, users: { name: "users" } };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({ default: null, users: { name: "users" } });
  });

  it("should handle module with no default export", () => {
    const mod = { users: { name: "users" } };
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({ users: { name: "users" } });
  });

  it("should handle empty module", () => {
    const mod = {};
    const result = resolveSchemaExports(mod);
    expect(result).toEqual({});
  });
});
