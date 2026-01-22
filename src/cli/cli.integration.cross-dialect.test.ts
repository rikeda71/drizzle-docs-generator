/**
 * Cross-Dialect Consistency CLI Integration Tests
 */

import { describe, it, expect } from "vitest";
import { runGenerate } from "../test-utils/cli-runner.js";
import { countTables, countRefs } from "../test-utils/dbml-validator.js";
import {
  setupIntegrationTest,
  PG_SCHEMA_V1,
  MYSQL_SCHEMA_V1,
  SQLITE_SCHEMA_V1,
} from "./integration-test-utils.js";

setupIntegrationTest();

describe("Cross-Dialect Consistency (v1 API)", () => {
  it("should generate same number of tables across all dialects", async () => {
    const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
      runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" }),
      runGenerate(MYSQL_SCHEMA_V1, "mysql", { format: "dbml" }),
      runGenerate(SQLITE_SCHEMA_V1, "sqlite", { format: "dbml" }),
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
      runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" }),
      runGenerate(MYSQL_SCHEMA_V1, "mysql", { format: "dbml" }),
      runGenerate(SQLITE_SCHEMA_V1, "sqlite", { format: "dbml" }),
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
      runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" }),
      runGenerate(MYSQL_SCHEMA_V1, "mysql", { format: "dbml" }),
      runGenerate(SQLITE_SCHEMA_V1, "sqlite", { format: "dbml" }),
    ]);

    expect(pgResult.exitCode).toBe(0);
    expect(mysqlResult.exitCode).toBe(0);
    expect(sqliteResult.exitCode).toBe(0);

    expect(pgResult.stdout).toContain("Note:");
    expect(mysqlResult.stdout).toContain("Note:");
    expect(sqliteResult.stdout).toContain("Note:");
  });

  it("should auto-detect relations across all dialects", async () => {
    const [pgResult, mysqlResult, sqliteResult] = await Promise.all([
      runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" }),
      runGenerate(MYSQL_SCHEMA_V1, "mysql", { format: "dbml" }),
      runGenerate(SQLITE_SCHEMA_V1, "sqlite", { format: "dbml" }),
    ]);

    expect(pgResult.exitCode).toBe(0);
    expect(mysqlResult.exitCode).toBe(0);
    expect(sqliteResult.exitCode).toBe(0);

    expect(countRefs(pgResult.stdout)).toBeGreaterThan(0);
    expect(countRefs(mysqlResult.stdout)).toBeGreaterThan(0);
    expect(countRefs(sqliteResult.stdout)).toBeGreaterThan(0);
  });
});
