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
  hasAllMarkdownTables,
  hasErDiagram,
  hasTablesIndex,
  hasColumnsSection,
} from "../test-utils/dbml-validator.js";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Paths to example schemas (v0: relations(), v1: defineRelations())
const EXAMPLES_DIR = join(import.meta.dirname, "../../examples");
const PG_SCHEMA_V0 = join(EXAMPLES_DIR, "pg/schema.ts");
const PG_SCHEMA_V1 = join(EXAMPLES_DIR, "pg/schema-v2.ts");
const MYSQL_SCHEMA_V0 = join(EXAMPLES_DIR, "mysql/schema.ts");
const MYSQL_SCHEMA_V1 = join(EXAMPLES_DIR, "mysql/schema-v2.ts");
const SQLITE_SCHEMA_V0 = join(EXAMPLES_DIR, "sqlite/schema.ts");
const SQLITE_SCHEMA_V1 = join(EXAMPLES_DIR, "sqlite/schema-v2.ts");

// Temporary output directory for file output tests
const TEST_OUTPUT_DIR = join(import.meta.dirname, "__integration_test_output__");

// Expected table names in all schemas
const EXPECTED_TABLES = ["users", "posts", "comments", "tags", "post_tags"];

describe("CLI Integration Tests", () => {
  beforeAll(() => {
    // Ensure example schemas exist (v0 and v1 for all dialects)
    expect(existsSync(PG_SCHEMA_V0)).toBe(true);
    expect(existsSync(PG_SCHEMA_V1)).toBe(true);
    expect(existsSync(MYSQL_SCHEMA_V0)).toBe(true);
    expect(existsSync(MYSQL_SCHEMA_V1)).toBe(true);
    expect(existsSync(SQLITE_SCHEMA_V0)).toBe(true);
    expect(existsSync(SQLITE_SCHEMA_V1)).toBe(true);

    // Create output directory for file tests
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  // ============================================
  // PostgreSQL v0 (relations()) Tests
  // ============================================
  describe("PostgreSQL v0 (relations())", () => {
    it("should generate DBML and relations with -r flag", async () => {
      const result = await runGenerate(PG_SCHEMA_V0, "postgresql", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });
  });

  // ============================================
  // PostgreSQL v1 (defineRelations()) Tests
  // ============================================
  describe("PostgreSQL v1 (defineRelations())", () => {
    it("should generate DBML for schema", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
    });

    it("should generate all expected columns for users table", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(
        hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], '"'),
      ).toBe(true);
    });

    it("should generate foreign key references", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should generate indexes for tables", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "users", '"')).toBe(true);
      expect(hasIndexes(result.stdout, "posts", '"')).toBe(true);
    });

    it("should generate composite primary key for post_tags", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "post_tags", '"')).toBe(true);
      expect(result.stdout).toContain("[pk]");
    });

    it("should extract JSDoc comments as Notes", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql");

      expect(result.exitCode).toBe(0);
      expect(hasTableNote(result.stdout, "users", "User accounts", '"')).toBe(true);
      expect(hasTableNote(result.stdout, "posts", "Blog posts", '"')).toBe(true);
    });

    it("should generate relations with -r flag using defineRelations", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
      expect(hasReference(result.stdout, "comments", "post_id", "posts", "id", '"')).toBe(true);
      expect(hasReference(result.stdout, "comments", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should output to file with -o flag", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "pg-v1-output.dbml");

      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { output: outputPath });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasAllTables(fileContent, EXPECTED_TABLES, '"')).toBe(true);

      rmSync(outputPath, { force: true });
    });
  });

  // ============================================
  // MySQL v0 (relations()) Tests
  // ============================================
  describe("MySQL v0 (relations())", () => {
    it("should generate DBML and relations with -r flag", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V0, "mysql", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, "`")).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", "`")).toBe(true);
    });
  });

  // ============================================
  // MySQL v1 (defineRelations()) Tests
  // ============================================
  describe("MySQL v1 (defineRelations())", () => {
    it("should generate DBML for schema", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, "`")).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
    });

    it("should generate all expected columns for users table", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(
        hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], "`"),
      ).toBe(true);
    });

    it("should generate foreign key references", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", "`")).toBe(true);
    });

    it("should generate indexes for tables", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "users", "`")).toBe(true);
      expect(hasIndexes(result.stdout, "posts", "`")).toBe(true);
    });

    it("should generate composite primary key for post_tags", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "post_tags", "`")).toBe(true);
      expect(result.stdout).toContain("[pk]");
    });

    it("should extract JSDoc comments as Notes", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(hasTableNote(result.stdout, "users", "User accounts", "`")).toBe(true);
      expect(hasTableNote(result.stdout, "posts", "Blog posts", "`")).toBe(true);
    });

    it("should use backtick escaping for identifiers", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Table `users` {");
      expect(result.stdout).toContain("`id`");
      expect(result.stdout).not.toContain('"users"');
    });

    it("should generate relations with -r flag using defineRelations", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", "`")).toBe(true);
      expect(hasReference(result.stdout, "comments", "post_id", "posts", "id", "`")).toBe(true);
      expect(hasReference(result.stdout, "comments", "author_id", "users", "id", "`")).toBe(true);
    });

    it("should output to file with -o flag", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "mysql-v1-output.dbml");

      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql", { output: outputPath });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasAllTables(fileContent, EXPECTED_TABLES, "`")).toBe(true);

      rmSync(outputPath, { force: true });
    });
  });

  // ============================================
  // SQLite v0 (relations()) Tests
  // ============================================
  describe("SQLite v0 (relations())", () => {
    it("should generate DBML and relations with -r flag", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V0, "sqlite", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });
  });

  // ============================================
  // SQLite v1 (defineRelations()) Tests
  // ============================================
  describe("SQLite v1 (defineRelations())", () => {
    it("should generate DBML for schema", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
      expect(countTables(result.stdout)).toBe(5);
    });

    it("should generate all expected columns for users table", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(
        hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], '"'),
      ).toBe(true);
    });

    it("should generate foreign key references", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should generate indexes for tables", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "users", '"')).toBe(true);
      expect(hasIndexes(result.stdout, "posts", '"')).toBe(true);
    });

    it("should generate composite primary key for post_tags", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasIndexes(result.stdout, "post_tags", '"')).toBe(true);
      expect(result.stdout).toContain("[pk]");
    });

    it("should extract JSDoc comments as Notes", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(hasTableNote(result.stdout, "users", "User accounts", '"')).toBe(true);
      expect(hasTableNote(result.stdout, "posts", "Blog posts", '"')).toBe(true);
    });

    it("should detect INTEGER PRIMARY KEY as auto-increment", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('"id" integer [primary key, not null, increment');
    });

    it("should generate relations with -r flag using defineRelations", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite", { relational: true });

      expect(result.exitCode).toBe(0);
      expect(countRefs(result.stdout)).toBeGreaterThan(0);
      expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
      expect(hasReference(result.stdout, "comments", "post_id", "posts", "id", '"')).toBe(true);
      expect(hasReference(result.stdout, "comments", "author_id", "users", "id", '"')).toBe(true);
    });

    it("should output to file with -o flag", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "sqlite-v1-output.dbml");

      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite", { output: outputPath });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasAllTables(fileContent, EXPECTED_TABLES, '"')).toBe(true);

      rmSync(outputPath, { force: true });
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================
  describe("Error Handling", () => {
    it("should error for non-existent file", async () => {
      const result = await runGenerate("./non-existent-schema.ts", "postgresql");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Schema path not found");
    });

    it("should error for invalid dialect", async () => {
      const result = await runCli(["generate", PG_SCHEMA_V0, "-d", "invalid-dialect"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid dialect");
    });
  });

  // ============================================
  // Directory Import Tests
  // ============================================
  describe("Directory Import", () => {
    it("should generate DBML from directory containing schema files", async () => {
      const schemaDir = join(EXAMPLES_DIR, "pg");
      const result = await runCli(["generate", schemaDir, "-d", "postgresql"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Table "users"');
      expect(result.stdout).toContain('Table "posts"');
      // Should include schemas from multiple files in the directory
      expect(countTables(result.stdout)).toBeGreaterThanOrEqual(5);
    });

    it("should error for empty directory", async () => {
      const emptyDir = join(import.meta.dirname, "../../tests/fixtures/empty");
      const result = await runCli(["generate", emptyDir, "-d", "postgresql"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No schema files found in directory");
    });
  });

  // ============================================
  // Cross-Dialect Consistency Tests (v1 API)
  // ============================================
  describe("Cross-Dialect Consistency (v1 API)", () => {
    it("should generate same number of tables across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA_V1, "postgresql"),
        runGenerate(MYSQL_SCHEMA_V1, "mysql"),
        runGenerate(SQLITE_SCHEMA_V1, "sqlite"),
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
        runGenerate(PG_SCHEMA_V1, "postgresql"),
        runGenerate(MYSQL_SCHEMA_V1, "mysql"),
        runGenerate(SQLITE_SCHEMA_V1, "sqlite"),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      expect(countRefs(pgResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(mysqlResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(sqliteResult.stdout)).toBeGreaterThan(0);
    });

    it("should extract comments across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA_V1, "postgresql"),
        runGenerate(MYSQL_SCHEMA_V1, "mysql"),
        runGenerate(SQLITE_SCHEMA_V1, "sqlite"),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      expect(pgResult.stdout).toContain("Note:");
      expect(mysqlResult.stdout).toContain("Note:");
      expect(sqliteResult.stdout).toContain("Note:");
    });

    it("should generate relations with -r flag across all dialects", async () => {
      const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
        runGenerate(PG_SCHEMA_V1, "postgresql", { relational: true }),
        runGenerate(MYSQL_SCHEMA_V1, "mysql", { relational: true }),
        runGenerate(SQLITE_SCHEMA_V1, "sqlite", { relational: true }),
      ]);

      expect(pgResult.exitCode).toBe(0);
      expect(mysqlResult.exitCode).toBe(0);
      expect(sqliteResult.exitCode).toBe(0);

      expect(countRefs(pgResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(mysqlResult.stdout)).toBeGreaterThan(0);
      expect(countRefs(sqliteResult.stdout)).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Markdown Output Format Tests
  // ============================================
  describe("Markdown Format Output", () => {
    it("should generate Markdown with --format markdown", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "markdown" });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(hasTablesIndex(result.stdout)).toBe(true);
      expect(hasAllMarkdownTables(result.stdout, EXPECTED_TABLES)).toBe(true);
      expect(hasColumnsSection(result.stdout)).toBe(true);
    });

    it("should include ER diagram by default in Markdown output", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "markdown" });

      expect(result.exitCode).toBe(0);
      expect(hasErDiagram(result.stdout)).toBe(true);
    });

    it("should exclude ER diagram with --no-er-diagram", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
        format: "markdown",
        noErDiagram: true,
      });

      expect(result.exitCode).toBe(0);
      expect(hasErDiagram(result.stdout)).toBe(false);
      expect(hasTablesIndex(result.stdout)).toBe(true);
    });

    it("should output single file Markdown with --single-file", async () => {
      const outputPath = join(TEST_OUTPUT_DIR, "single-file-output.md");

      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
        format: "markdown",
        singleFile: true,
        output: outputPath,
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const fileContent = readFileSync(outputPath, "utf-8");
      expect(hasTablesIndex(fileContent)).toBe(true);
      expect(hasAllMarkdownTables(fileContent, EXPECTED_TABLES)).toBe(true);
      expect(hasErDiagram(fileContent)).toBe(true);

      rmSync(outputPath, { force: true });
    });

    it("should output multiple files Markdown without --single-file", async () => {
      const outputDir = join(TEST_OUTPUT_DIR, "multi-file-output");

      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
        format: "markdown",
        output: outputDir,
      });

      expect(result.exitCode).toBe(0);

      // Check README.md exists
      expect(existsSync(join(outputDir, "README.md"))).toBe(true);

      // Check individual table files exist
      for (const tableName of EXPECTED_TABLES) {
        expect(existsSync(join(outputDir, `${tableName}.md`))).toBe(true);
      }

      // Verify README.md content
      const readmeContent = readFileSync(join(outputDir, "README.md"), "utf-8");
      expect(hasTablesIndex(readmeContent)).toBe(true);
      expect(hasErDiagram(readmeContent)).toBe(true);

      // Verify individual table file content
      const usersContent = readFileSync(join(outputDir, "users.md"), "utf-8");
      expect(usersContent).toContain("# users");
      expect(usersContent).toContain("### Columns");

      rmSync(outputDir, { recursive: true, force: true });
    });

    it("should generate Markdown with relations using -r flag", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
        format: "markdown",
        relational: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### Relations");
      expect(result.stdout).toContain("posts.author_id");
    });

    it("should work with MySQL dialect in Markdown format", async () => {
      const result = await runGenerate(MYSQL_SCHEMA_V1, "mysql", { format: "markdown" });

      expect(result.exitCode).toBe(0);
      expect(hasTablesIndex(result.stdout)).toBe(true);
      expect(hasAllMarkdownTables(result.stdout, EXPECTED_TABLES)).toBe(true);
    });

    it("should work with SQLite dialect in Markdown format", async () => {
      const result = await runGenerate(SQLITE_SCHEMA_V1, "sqlite", { format: "markdown" });

      expect(result.exitCode).toBe(0);
      expect(hasTablesIndex(result.stdout)).toBe(true);
      expect(hasAllMarkdownTables(result.stdout, EXPECTED_TABLES)).toBe(true);
    });
  });

  // ============================================
  // Format Option Validation Tests
  // ============================================
  describe("Format Option Validation", () => {
    it("should error for invalid format", async () => {
      const result = await runCli(["generate", PG_SCHEMA_V0, "-f", "invalid-format"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid format");
    });

    it("should warn when --single-file used with dbml format", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
        singleFile: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("--single-file is only applicable with --format markdown");
    });

    it("should warn when --no-er-diagram used with dbml format", async () => {
      const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
        noErDiagram: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("--no-er-diagram is only applicable with --format markdown");
    });
  });
});
