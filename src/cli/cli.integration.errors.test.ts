/**
 * Error Handling and Validation CLI Integration Tests
 */

import { describe, it, expect } from "vitest";
import { runGenerate, runCli } from "../test-utils/cli-runner.js";
import { countTables } from "../test-utils/dbml-validator.js";
import {
  setupIntegrationTest,
  EXAMPLES_DIR,
  PG_SCHEMA_V0,
  PG_SCHEMA_V1,
  join,
} from "./integration-test-utils.js";

setupIntegrationTest();

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
