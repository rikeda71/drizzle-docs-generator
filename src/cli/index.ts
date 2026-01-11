#!/usr/bin/env node

/**
 * CLI for drizzle-docs-generator
 *
 * Generates DBML files from Drizzle ORM schema definitions.
 */

import { Command } from "commander";
import { existsSync, readFileSync, watch } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pgGenerate, mysqlGenerate, sqliteGenerate } from "../generator/index.js";

const program = new Command();

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as { version: string; description: string };

program.name("drizzle-docs").description(packageJson.description).version(packageJson.version);

type Dialect = "postgresql" | "mysql" | "sqlite";

interface GenerateCommandOptions {
  output?: string;
  dialect: Dialect;
  relational?: boolean;
  watch?: boolean;
}

/**
 * Get the generate function based on dialect
 */
function getGenerator(dialect: Dialect) {
  switch (dialect) {
    case "mysql":
      return mysqlGenerate;
    case "sqlite":
      return sqliteGenerate;
    case "postgresql":
    default:
      return pgGenerate;
  }
}

/**
 * Generate DBML from a schema file
 */
async function generateDbml(
  schemaPath: string,
  options: GenerateCommandOptions,
): Promise<string | undefined> {
  // Use file URL for dynamic import (required for ESM)
  const schemaUrl = pathToFileURL(schemaPath).href;

  // Dynamic import with cache busting for watch mode
  const cacheBuster = options.watch ? `?t=${Date.now()}` : "";
  const schemaModule = (await import(schemaUrl + cacheBuster)) as Record<string, unknown>;

  const generate = getGenerator(options.dialect);

  const dbml = generate({
    schema: schemaModule,
    out: options.output,
    relational: options.relational,
    sourceFile: schemaPath,
  });

  return dbml;
}

/**
 * Run the generate command
 */
async function runGenerate(schema: string, options: GenerateCommandOptions): Promise<void> {
  const schemaPath = resolve(process.cwd(), schema);

  // Check if file exists
  if (!existsSync(schemaPath)) {
    console.error(`Error: Schema file not found: ${schemaPath}`);
    process.exit(1);
  }

  try {
    const dbml = await generateDbml(schemaPath, options);

    if (!options.output && dbml) {
      console.log(dbml);
    } else if (options.output) {
      console.log(`DBML generated: ${options.output}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error generating DBML: ${error.message}`);
    } else {
      console.error("Error generating DBML:", error);
    }
    process.exit(1);
  }
}

/**
 * Watch mode: regenerate DBML on file changes
 */
function watchSchema(schema: string, options: GenerateCommandOptions): void {
  const schemaPath = resolve(process.cwd(), schema);

  console.log(`Watching for changes: ${schemaPath}`);

  let debounceTimer: NodeJS.Timeout | null = null;

  watch(schemaPath, async (eventType) => {
    if (eventType === "change") {
      // Debounce to avoid multiple triggers
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        console.log("\nFile changed, regenerating...");
        try {
          const dbml = await generateDbml(schemaPath, options);

          if (!options.output && dbml) {
            console.log(dbml);
          } else if (options.output) {
            console.log(`DBML regenerated: ${options.output}`);
          }
        } catch (error) {
          if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
          } else {
            console.error("Error:", error);
          }
        }
      }, 100);
    }
  });
}

program
  .command("generate")
  .description("Generate DBML from Drizzle schema files")
  .argument("<schema>", "Path to Drizzle schema file")
  .option("-o, --output <file>", "Output file path")
  .option("-d, --dialect <dialect>", "Database dialect (postgresql, mysql, sqlite)", "postgresql")
  .option("-r, --relational", "Use relations() definitions instead of foreign keys")
  .option("-w, --watch", "Watch for file changes and regenerate")
  .action(async (schema: string, options: GenerateCommandOptions) => {
    // Validate dialect
    const validDialects: Dialect[] = ["postgresql", "mysql", "sqlite"];
    if (!validDialects.includes(options.dialect)) {
      console.error(
        `Error: Invalid dialect "${options.dialect}". Valid options: ${validDialects.join(", ")}`,
      );
      process.exit(1);
    }

    // Initial generation
    await runGenerate(schema, options);

    // Start watch mode if requested
    if (options.watch) {
      watchSchema(schema, options);
    }
  });

program.parse();
