/**
 * Overwrite Protection (--force option) CLI Integration Tests
 */

import { describe, it, expect } from "vitest";
import { runGenerate } from "../test-utils/cli-runner.js";
import { hasTablesIndex } from "../test-utils/dbml-validator.js";
import {
  setupIntegrationTest,
  PG_SCHEMA_V1,
  TEST_OUTPUT_DIR,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  join,
} from "./integration-test-utils.js";

setupIntegrationTest();

describe("Overwrite Protection (--force option)", () => {
  const forceTestDir = join(TEST_OUTPUT_DIR, "force-test");

  it("should error when output file already exists without --force (DBML)", async () => {
    const outputPath = join(forceTestDir, "existing.dbml");

    // Create the directory and file
    mkdirSync(forceTestDir, { recursive: true });
    writeFileSync(outputPath, "existing content", "utf-8");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      output: outputPath,
      format: "dbml",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Output file already exists");
    expect(result.stderr).toContain("--force");

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should overwrite existing file with --force (DBML)", async () => {
    const outputPath = join(forceTestDir, "existing.dbml");

    // Create the directory and file
    mkdirSync(forceTestDir, { recursive: true });
    writeFileSync(outputPath, "existing content", "utf-8");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      output: outputPath,
      force: true,
      format: "dbml",
    });

    expect(result.exitCode).toBe(0);

    // Verify file was overwritten with new content
    const fileContent = readFileSync(outputPath, "utf-8");
    expect(fileContent).not.toBe("existing content");
    expect(fileContent).toContain('Table "users"');

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should error when output file already exists without --force (Markdown single file)", async () => {
    const outputPath = join(forceTestDir, "existing.md");

    // Create the directory and file
    mkdirSync(forceTestDir, { recursive: true });
    writeFileSync(outputPath, "existing content", "utf-8");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
      singleFile: true,
      output: outputPath,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Output file already exists");
    expect(result.stderr).toContain("--force");

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should overwrite existing file with --force (Markdown single file)", async () => {
    const outputPath = join(forceTestDir, "existing.md");

    // Create the directory and file
    mkdirSync(forceTestDir, { recursive: true });
    writeFileSync(outputPath, "existing content", "utf-8");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
      singleFile: true,
      output: outputPath,
      force: true,
    });

    expect(result.exitCode).toBe(0);

    // Verify file was overwritten with new content
    const fileContent = readFileSync(outputPath, "utf-8");
    expect(fileContent).not.toBe("existing content");
    expect(hasTablesIndex(fileContent)).toBe(true);

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should error when output directory has existing files without --force (Markdown multi-file)", async () => {
    const outputDir = join(forceTestDir, "multi-file");

    // Create the directory and existing files
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "README.md"), "existing README", "utf-8");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
      output: outputDir,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("files already exist");
    expect(result.stderr).toContain("README.md");
    expect(result.stderr).toContain("--force");

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should overwrite existing files with --force (Markdown multi-file)", async () => {
    const outputDir = join(forceTestDir, "multi-file");

    // Create the directory and existing files
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "README.md"), "existing README", "utf-8");
    writeFileSync(join(outputDir, "users.md"), "existing users", "utf-8");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
      output: outputDir,
      force: true,
    });

    expect(result.exitCode).toBe(0);

    // Verify files were overwritten with new content
    const readmeContent = readFileSync(join(outputDir, "README.md"), "utf-8");
    expect(readmeContent).not.toBe("existing README");
    expect(hasTablesIndex(readmeContent)).toBe(true);

    const usersContent = readFileSync(join(outputDir, "users.md"), "utf-8");
    expect(usersContent).not.toBe("existing users");
    expect(usersContent).toContain("# users");

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should succeed when output directory is empty without --force", async () => {
    const outputDir = join(forceTestDir, "empty-dir");

    // Create empty directory
    mkdirSync(outputDir, { recursive: true });

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
      output: outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(outputDir, "README.md"))).toBe(true);

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });

  it("should succeed when output directory does not exist without --force", async () => {
    const outputDir = join(forceTestDir, "new-dir");

    // Ensure directory does not exist
    rmSync(outputDir, { recursive: true, force: true });

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      format: "markdown",
      output: outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(outputDir, "README.md"))).toBe(true);

    // Cleanup
    rmSync(forceTestDir, { recursive: true, force: true });
  });
});
