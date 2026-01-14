/**
 * MySQL CLI Integration Tests
 */

import { describe, it, expect } from "vitest";
import { runGenerate } from "../test-utils/cli-runner.js";
import {
  hasAllTables,
  hasAllColumns,
  hasReference,
  hasIndexes,
  hasTableNote,
  countTables,
  countRefs,
} from "../test-utils/dbml-validator.js";
import {
  setupIntegrationTest,
  MYSQL_SCHEMA_V0,
  MYSQL_SCHEMA_V1,
  EXPECTED_TABLES,
  TEST_OUTPUT_DIR,
  existsSync,
  rmSync,
  readFileSync,
  join,
} from "./integration-test-utils.js";

setupIntegrationTest();

describe("MySQL v0 (relations())", () => {
  it("should auto-detect relations() and generate DBML with relations", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V0, "mysql");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
    expect(countTables(result.stdout)).toBe(5);
    expect(countRefs(result.stdout)).toBeGreaterThan(0);
    expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
  });
});

describe("MySQL v1 (defineRelations())", () => {
  it("should generate DBML for schema", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
    expect(countTables(result.stdout)).toBe(5);
  });

  it("should generate all expected columns for users table", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(
      hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], '"'),
    ).toBe(true);
  });

  it("should generate foreign key references", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
  });

  it("should generate indexes for tables", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(hasIndexes(result.stdout, "users", '"')).toBe(true);
    expect(hasIndexes(result.stdout, "posts", '"')).toBe(true);
  });

  it("should generate composite primary key for post_tags", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(hasIndexes(result.stdout, "post_tags", '"')).toBe(true);
    expect(result.stdout).toContain("[pk]");
  });

  it("should extract JSDoc comments as Notes", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(hasTableNote(result.stdout, "users", "User accounts", '"')).toBe(true);
    expect(hasTableNote(result.stdout, "posts", "Blog posts", '"')).toBe(true);
  });

  it("should use double-quote escaping for identifiers", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Table "users" {');
    expect(result.stdout).toContain('"id"');
    expect(result.stdout).not.toContain("`users`");
  });

  it("should auto-detect defineRelations() and generate relations", async () => {
    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

    expect(result.exitCode).toBe(0);
    expect(countRefs(result.stdout)).toBeGreaterThan(0);
    expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    expect(hasReference(result.stdout, "comments", "post_id", "posts", "id", '"')).toBe(true);
    expect(hasReference(result.stdout, "comments", "author_id", "users", "id", '"')).toBe(true);
  });

  it("should output to file with -o flag", async () => {
    const outputPath = join(TEST_OUTPUT_DIR, "mysql-v1-output.dbml");

    const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql", { output: outputPath, force: true });

    expect(result.exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);

    const fileContent = readFileSync(outputPath, "utf-8");
    expect(hasAllTables(fileContent, EXPECTED_TABLES, '"')).toBe(true);

    rmSync(outputPath, { force: true });
  });
});
