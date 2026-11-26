/**
 * CLI Integration Tests for tables in a named schema (pgSchema) (#176)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runGenerate } from "../test-utils/cli-runner.js";
import { Parser } from "@dbml/core";
import {
  TEST_OUTPUT_DIR,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  join,
} from "./integration-test-utils.js";

const FIXTURE_DIR = join(TEST_OUTPUT_DIR, "pg-schema-fixture");
const SCHEMA_PATH = join(FIXTURE_DIR, "schema.ts");

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(
    SCHEMA_PATH,
    `import { integer, pgSchema, pgTable, serial, text } from "drizzle-orm/pg-core";

export const billing = pgSchema("billing");

/** Public users */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

/** Billing users */
export const billingUsers = billing.table("users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
});
`,
  );
});

describe("Tables in a named schema (pgSchema)", () => {
  it("should qualify schema tables and refs in DBML output", async () => {
    const result = await runGenerate(SCHEMA_PATH, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Table "billing"."users" {');
    expect(result.stdout).toContain('Table "users" {');
    expect(result.stdout).toContain("Note: 'Billing users'");
    expect(result.stdout).toContain("Note: 'Public users'");
    expect(result.stdout).toContain('Ref: "billing"."users"."user_id" > "users"."id"');
    expect(() => Parser.parse(result.stdout, "dbmlv2")).not.toThrow();
  });

  it("should write a separate Markdown file for each same-named table", async () => {
    const outputDir = join(TEST_OUTPUT_DIR, "pg-schema-multi-file-output");

    const result = await runGenerate(SCHEMA_PATH, "postgresql", {
      format: "markdown",
      output: outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(outputDir, "users.md"))).toBe(true);
    expect(existsSync(join(outputDir, "billing.users.md"))).toBe(true);

    const billingContent = readFileSync(join(outputDir, "billing.users.md"), "utf-8");
    expect(billingContent).toContain("# billing.users");
    expect(billingContent).toContain("Billing users");

    const usersContent = readFileSync(join(outputDir, "users.md"), "utf-8");
    expect(usersContent).toContain("# users");
    expect(usersContent).toContain("Public users");

    const readmeContent = readFileSync(join(outputDir, "README.md"), "utf-8");
    expect(readmeContent).toContain("[billing.users](./billing.users.md)");
    expect(readmeContent).toContain("[users](./users.md)");

    rmSync(outputDir, { recursive: true, force: true });
  });

  it("should keep same-named tables distinct in single-file Markdown output", async () => {
    const result = await runGenerate(SCHEMA_PATH, "postgresql", {
      format: "markdown",
      singleFile: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("## billing.users");
    expect(result.stdout).toContain("## users");
    expect(result.stdout).toContain("[billing.users](#billingusers)");
    expect(result.stdout).toContain("billing_users {");
  });

  it("should fail instead of overwriting when two tables map to the same Markdown file", async () => {
    const fixtureDir = join(TEST_OUTPUT_DIR, "pg-schema-duplicate-file-fixture");
    const schemaPath = join(fixtureDir, "schema.ts");
    const outputDir = join(TEST_OUTPUT_DIR, "pg-schema-duplicate-file-output");
    mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(
      schemaPath,
      `import { pgSchema, pgTable, serial } from "drizzle-orm/pg-core";

export const billing = pgSchema("billing");

export const dottedUsers = pgTable("billing.users", {
  id: serial("id").primaryKey(),
});

export const billingUsers = billing.table("users", {
  id: serial("id").primaryKey(),
});
`,
    );

    const result = await runGenerate(schemaPath, "postgresql", {
      format: "markdown",
      output: outputDir,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Multiple tables would be written to the same file");
    expect(result.stderr).toContain("billing.users.md");
    expect(existsSync(join(outputDir, "billing.users.md"))).toBe(false);

    rmSync(outputDir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  });
});
