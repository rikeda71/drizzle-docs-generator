/**
 * Shared utilities and constants for CLI integration tests
 */

import { join } from "node:path";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { beforeAll, expect } from "vitest";

// Paths to example schemas (v0: relations(), v1: defineRelations())
export const EXAMPLES_DIR = join(import.meta.dirname, "../../examples");
export const PG_SCHEMA_V0 = join(EXAMPLES_DIR, "pg/v0/schema.ts");
export const PG_SCHEMA_V1 = join(EXAMPLES_DIR, "pg/v1/schema.ts");
export const MYSQL_SCHEMA_V0 = join(EXAMPLES_DIR, "mysql/v0/schema.ts");
export const MYSQL_SCHEMA_V1 = join(EXAMPLES_DIR, "mysql/v1/schema.ts");
export const SQLITE_SCHEMA_V0 = join(EXAMPLES_DIR, "sqlite/v0/schema.ts");
export const SQLITE_SCHEMA_V1 = join(EXAMPLES_DIR, "sqlite/v1/schema.ts");

// Temporary output directory for file output tests
export const TEST_OUTPUT_DIR = join(import.meta.dirname, "__integration_test_output__");

// Expected table names in all schemas
export const EXPECTED_TABLES = ["users", "posts", "comments", "tags", "post_tags"];

/**
 * Setup function to ensure example schemas exist and create output directory.
 * Call this in beforeAll() of tests that need schema files.
 */
export function setupIntegrationTest(): void {
  beforeAll(() => {
    // Ensure example schemas exist (v0 and v1 for all dialects)
    expect(existsSync(PG_SCHEMA_V0)).toBe(true);
    expect(existsSync(PG_SCHEMA_V1)).toBe(true);
    expect(existsSync(MYSQL_SCHEMA_V0)).toBe(true);
    expect(existsSync(MYSQL_SCHEMA_V1)).toBe(true);
    expect(existsSync(SQLITE_SCHEMA_V0)).toBe(true);
    expect(existsSync(SQLITE_SCHEMA_V1)).toBe(true);

    // Create output directory for file tests (don't delete to avoid race conditions)
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });
}

// Re-export fs utilities for convenience
export { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync };
export { join };
