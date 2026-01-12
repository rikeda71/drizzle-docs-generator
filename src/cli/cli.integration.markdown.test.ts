/**
 * Markdown Format Output CLI Integration Tests
 */

import { describe, it, expect } from "vitest";
import { runGenerate } from "../test-utils/cli-runner.js";
import {
  hasAllMarkdownTables,
  hasErDiagram,
  hasTablesIndex,
  hasColumnsSection,
} from "../test-utils/dbml-validator.js";
import {
  setupIntegrationTest,
  PG_SCHEMA_V1,
  MYSQL_SCHEMA_V1,
  SQLITE_SCHEMA_V1,
  EXPECTED_TABLES,
  TEST_OUTPUT_DIR,
  existsSync,
  rmSync,
  readFileSync,
  join,
} from "./integration-test-utils.js";

setupIntegrationTest();

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

  it("should auto-detect defineRelations() and generate Markdown with relations", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
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
