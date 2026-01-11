/**
 * CLI Integration Tests
 *
 * These tests execute the CLI with actual schema files and verify the output.
 * Tests are run against the example schemas in the examples/ directory.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runGenerate, runCli } from "../test-utils/cli-runner.js";
import {
  hasAllTables,
  hasAllColumns,
  hasReference,
  hasIndexes,
  hasTableNote,
  countTables,
  countRefs,
} from "../test-utils/dbml-validator.js";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Paths to example schemas
const EXAMPLES_DIR = join(import.meta.dirname, "../../examples");
const PG_SCHEMA = join(EXAMPLES_DIR, "pg/schema.ts");
const MYSQL_SCHEMA = join(EXAMPLES_DIR, "mysql/schema.ts");
const SQLITE_SCHEMA = join(EXAMPLES_DIR, "sqlite/schema.ts");

// Temporary output directory for file output tests
const TEST_OUTPUT_DIR = join(import.meta.dirname, "__integration_test_output__");

// Expected table names in all schemas
const EXPECTED_TABLES = ["users", "posts", "comments", "tags", "post_tags"];

describe("CLI Integration Tests", () => {
  beforeAll(() => {
    // Ensure example schemas exist
    expect(existsSync(PG_SCHEMA)).toBe(true);
    expect(existsSync(MYSQL_SCHEMA)).toBe(true);
    expect(existsSync(SQLITE_SCHEMA)).toBe(true);

    // Create output directory for file tests
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  describe("PostgreSQL Integration", () => {
    it("should generate DBML for PostgreSQL schema", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).not.toBe("");

      // Validate output structure
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
    });

    it("should generate all expected columns for users table", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(
        hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], '"'),
      ).toBe(true);
    });

    it("should generate foreign key references", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should generate indexes for tables", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql");

      expect(result.exitCode).toBe(0);
      // Users and posts have explicit indexes
      expect(hasIndexes(result.stdout, "users", '"')).toBe(true);
      expect(hasIndexes(result.stdout, "posts", '"')).toBe(true);
    });

    it("should generate composite primary key for post_tags", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql");

      expect(result.exitCode).toBe(0);
      // Composite primary key should appear in indexes section
      expect(hasIndexes(result.stdout, "post_tags", '"')).toBe(true);
      expect(result.stdout).toContain("[pk]");
    });

    it("should extract JSDoc comments as Notes", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql");

      expect(result.exitCode).toBe(0);
      // Table-level comments
      expect(hasTableNote(result.stdout, "users", "User accounts", '"')).toBe(true);
      expect(hasTableNote(result.stdout, "posts", "Blog posts", '"')).toBe(true);
    });

    it("should generate relations with -r flag", async () => {
      const result = await runGenerate(PG_SCHEMA, "postgresql", { relational: true });

      expect(result.exitCode).toBe(0);
      // Should have Ref statements for relations
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should output to file with -o flag", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "pg-output.dbml");

      const result = await runGenerate(PG_SCHEMA, "postgresql", { output: outputPath });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasAllTables(fileContent, EXPECTED_TABLES, '"')).toBe(true);

      // Cleanup
      rmSync(outputPath, { force: true });
    });
  });

  describe("MySQL Integration", () => {
    it("should generate DBML for MySQL schema", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).not.toBe("");

      // MySQL uses backtick escaping
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, "`")).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
    });

    it("should generate all expected columns for users table", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(
        hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], "`"),
      ).toBe(true);
    });

    it("should generate foreign key references", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", "`")).toBe(true);
    });

    it("should generate indexes for tables", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "users", "`")).toBe(true);
      expect(hasIndexes(result.stdout, "posts", "`")).toBe(true);
    });

    it("should generate composite primary key for post_tags", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "post_tags", "`")).toBe(true);
      expect(result.stdout).toContain("[pk]");
    });

    it("should extract JSDoc comments as Notes", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasTableNote(result.stdout, "users", "User accounts", "`")).toBe(true);
      expect(hasTableNote(result.stdout, "posts", "Blog posts", "`")).toBe(true);
    });

    it("should use backtick escaping for identifiers", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Table `users` {");
      expect(result.stdout).toContain("`id`");
      expect(result.stdout).not.toContain('"users"');
    });

    it("should generate relations with -r flag", async () => {
      const result = await runGenerate(MYSQL_SCHEMA, "mysql", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", "`")).toBe(true);
    });

    it("should output to file with -o flag", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "mysql-output.dbml");

      const result = await runGenerate(MYSQL_SCHEMA, "mysql", { output: outputPath });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasAllTables(fileContent, EXPECTED_TABLES, "`")).toBe(true);

      rmSync(outputPath, { force: true });
    });
  });

  describe("SQLite Integration", () => {
    it("should generate DBML for SQLite schema", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).not.toBe("");

      expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
    });

    it("should generate all expected columns for users table", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(
        hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], '"'),
      ).toBe(true);
    });

    it("should generate foreign key references", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should generate indexes for tables", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "users", '"')).toBe(true);
      expect(hasIndexes(result.stdout, "posts", '"')).toBe(true);
    });

    it("should generate composite primary key for post_tags", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "post_tags", '"')).toBe(true);
      expect(result.stdout).toContain("[pk]");
    });

    it("should extract JSDoc comments as Notes", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasTableNote(result.stdout, "users", "User accounts", '"')).toBe(true);
      expect(hasTableNote(result.stdout, "posts", "Blog posts", '"')).toBe(true);
    });

    it("should detect INTEGER PRIMARY KEY as auto-increment", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite");

      expect(result.exitCode).toBe(0);
      // INTEGER PRIMARY KEY in SQLite should have increment
      // Note: the output also includes note attribute from JSDoc comments
      expect(result.stdout).toContain('"id" integer [primary key, not null, increment');
    });

    it("should generate relations with -r flag", async () => {
      const result = await runGenerate(SQLITE_SCHEMA, "sqlite", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should output to file with -o flag", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "sqlite-output.dbml");

      const result = await runGenerate(SQLITE_SCHEMA, "sqlite", { output: outputPath });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasAllTables(fileContent, EXPECTED_TABLES, '"')).toBe(true);

      rmSync(outputPath, { force: true });
    });
  });

  describe("Error Handling", () => {
    it("should error for non-existent file", async () => {
      const result = await runGenerate("./non-existent-schema.ts", "postgresql");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Schema file not found");
    });

    it("should error for invalid dialect", async () => {
      const result = await runCli(["generate", PG_SCHEMA, "-d", "invalid-dialect"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid dialect");
    });
  });

  describe("Cross-Dialect Consistency", () => {
    it("should generate same number of tables across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA, "postgresql"),
        runGenerate(MYSQL_SCHEMA, "mysql"),
        runGenerate(SQLITE_SCHEMA, "sqlite"),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      expect(countTables(pgResult.stdout)).toBe(5);
      expect(countTables(mysqlResult.stdout)).toBe(5);
      expect(countTables(sqliteResult.stdout)).toBe(5);
    });

    it("should generate references across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA, "postgresql"),
        runGenerate(MYSQL_SCHEMA, "mysql"),
        runGenerate(SQLITE_SCHEMA, "sqlite"),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      // All should have foreign key references
      expect(countRefs(pgResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(mysqlResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(sqliteResult.stdout)).toBeGreaterThan(0);
    });

    it("should extract comments across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA, "postgresql"),
        runGenerate(MYSQL_SCHEMA, "mysql"),
        runGenerate(SQLITE_SCHEMA, "sqlite"),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      // All should have Note clauses
      expect(pgResult.stdout).toContain("Note:");
      expect(mysqlResult.stdout).toContain("Note:");
      expect(sqliteResult.stdout).toContain("Note:");
    });

    it("should generate relations with -r flag across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA, "postgresql", { relational: true }),
        runGenerate(MYSQL_SCHEMA, "mysql", { relational: true }),
        runGenerate(SQLITE_SCHEMA, "sqlite", { relational: true }),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      // All should have Ref statements
      expect(countRefs(pgResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(mysqlResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(sqliteResult.stdout)).toBeGreaterThan(0);
    });
  });
});
