/**
 * PostgreSQL CLI Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cpSync, realpathSync } from "node:fs";
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
  PG_SCHEMA_V0,
  PG_SCHEMA_V1,
  EXPECTED_TABLES,
  TEST_OUTPUT_DIR,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  join,
} from "./integration-test-utils.js";

setupIntegrationTest();

describe("PostgreSQL v0 (relations())", () => {
  it("should auto-detect relations() and generate DBML with relations", async () => {
    const result = await runGenerate(PG_SCHEMA_V0, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
    expect(countTables(result.stdout)).toBe(7);
    expect(countRefs(result.stdout)).toBeGreaterThan(0);
    expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
  });
});

describe("PostgreSQL v1 (defineRelations())", () => {
  it("should generate DBML for schema", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(hasAllTables(result.stdout, EXPECTED_TABLES, '"')).toBe(true);
    expect(countTables(result.stdout)).toBe(7);
  });

  it("should generate all expected columns for users table", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(
      hasAllColumns(result.stdout, "users", ["id", "name", "email", "active", "created_at"], '"'),
    ).toBe(true);
  });

  it("should generate foreign key references", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
  });

  it("should generate indexes for tables", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(hasIndexes(result.stdout, "users", '"')).toBe(true);
    expect(hasIndexes(result.stdout, "posts", '"')).toBe(true);
  });

  it("should generate composite primary key for post_tags", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(hasIndexes(result.stdout, "post_tags", '"')).toBe(true);
    expect(result.stdout).toContain("[pk]");
  });

  it("should extract JSDoc comments as Notes", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(hasTableNote(result.stdout, "users", "User accounts", '"')).toBe(true);
    expect(hasTableNote(result.stdout, "posts", "Blog posts", '"')).toBe(true);
  });

  it("should generate enum definitions with JSDoc comments", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("// Lifecycle status of an order");
    expect(result.stdout).toContain('Enum "order_status" {');
    expect(result.stdout).toContain("pending [note: 'Order has been placed but not yet paid']");
    expect(result.stdout).toContain("paid [note: 'Payment confirmed']");
    expect(result.stdout).toContain('"status" order_status [not null');
  });

  it("should auto-detect defineRelations() and generate relations", async () => {
    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(countRefs(result.stdout)).toBeGreaterThan(0);
    expect(hasReference(result.stdout, "posts", "author_id", "users", "id", '"')).toBe(true);
    expect(hasReference(result.stdout, "comments", "post_id", "posts", "id", '"')).toBe(true);
    expect(hasReference(result.stdout, "comments", "author_id", "users", "id", '"')).toBe(true);
  });

  it("should output to file with -o flag", async () => {
    const outputPath = join(TEST_OUTPUT_DIR, "pg-v1-output.dbml");

    const result = await runGenerate(PG_SCHEMA_V1, "postgresql", {
      output: outputPath,
      force: true,
      format: "dbml",
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);

    const fileContent = readFileSync(outputPath, "utf-8");
    expect(hasAllTables(fileContent, EXPECTED_TABLES, '"')).toBe(true);

    rmSync(outputPath, { force: true });
  });
});

/**
 * Regression tests for #158: the schema under test resolves its own copy of
 * drizzle-orm (copied into a nested node_modules), so the column classes are
 * NOT the same class objects the CLI imports. Enum detection must rely on
 * drizzle's entityKind brand check instead of instanceof.
 */
describe("PostgreSQL enums with a duplicate drizzle-orm copy (#158)", () => {
  const PROJECT_DIR = join(TEST_OUTPUT_DIR, "duplicate-drizzle-orm");
  const SCHEMA_DIR = join(PROJECT_DIR, "schema");
  const REPO_ROOT = join(import.meta.dirname, "../..");

  beforeAll(() => {
    rmSync(PROJECT_DIR, { recursive: true, force: true });
    mkdirSync(SCHEMA_DIR, { recursive: true });

    // Copy the real drizzle-orm package (resolving the pnpm symlink) so that
    // imports from the schema files resolve to a separate module instance.
    const drizzleOrmSource = realpathSync(join(REPO_ROOT, "node_modules/drizzle-orm"));
    cpSync(drizzleOrmSource, join(PROJECT_DIR, "node_modules/drizzle-orm"), {
      recursive: true,
      dereference: true,
    });

    writeFileSync(
      join(SCHEMA_DIR, "enums.ts"),
      `import { pgEnum } from "drizzle-orm/pg-core";

/** Body type of a bike */
export const bikeBodyTypeEnum = pgEnum("bike_body_type", [
  /** No fairing */
  "naked",
  /** Dual purpose on/off-road */
  "onOff",
  "quadricycle",
]);
`,
    );

    writeFileSync(
      join(SCHEMA_DIR, "tables.ts"),
      `import { pgTable, serial } from "drizzle-orm/pg-core";
import { bikeBodyTypeEnum } from "./enums";

/** Bikes */
export const bikes = pgTable("bikes", {
  /** Primary key */
  id: serial("id").primaryKey(),
  /** Body type */
  bodyType: bikeBodyTypeEnum("body_type").notNull(),
});
`,
    );
  });

  afterAll(() => {
    rmSync(PROJECT_DIR, { recursive: true, force: true });
  });

  it("should detect enums and their comments in DBML output", async () => {
    const result = await runGenerate(SCHEMA_DIR, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("// Body type of a bike");
    expect(result.stdout).toContain('Enum "bike_body_type" {');
    expect(result.stdout).toContain("naked [note: 'No fairing']");
    expect(result.stdout).toContain("onOff [note: 'Dual purpose on/off-road']");
    expect(result.stdout).toContain("quadricycle");
    // Column and table comments must also be found when a directory is passed
    expect(result.stdout).toContain("\"body_type\" bike_body_type [not null, note: 'Body type']");
    expect(hasTableNote(result.stdout, "bikes", "Bikes", '"')).toBe(true);
  });

  it("should skip node_modules when a project directory is passed", async () => {
    // PROJECT_DIR contains node_modules/drizzle-orm; scanning it must not
    // try to import files from node_modules
    const result = await runGenerate(PROJECT_DIR, "postgresql", { format: "dbml" });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain('Enum "bike_body_type" {');
    expect(result.stdout).toContain('Table "bikes" {');
    expect(hasTableNote(result.stdout, "bikes", "Bikes", '"')).toBe(true);
  });

  it("should write enums.md with comments in multi-file Markdown output", async () => {
    const outputDir = join(PROJECT_DIR, "docs");

    const result = await runGenerate(SCHEMA_DIR, "postgresql", {
      format: "markdown",
      output: outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(outputDir, "bikes.md"))).toBe(true);
    expect(existsSync(join(outputDir, "enums.md"))).toBe(true);

    const enumsContent = readFileSync(join(outputDir, "enums.md"), "utf-8");
    expect(enumsContent).toContain("## bike_body_type");
    expect(enumsContent).toContain("Body type of a bike");
    expect(enumsContent).toContain("| naked | No fairing |");
    expect(enumsContent).toContain("| quadricycle | - |");

    const readmeContent = readFileSync(join(outputDir, "README.md"), "utf-8");
    expect(readmeContent).toContain("[bike_body_type](./enums.md#bike_body_type)");
  });
});
