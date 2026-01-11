#!/usr/bin/env node

/**
 * CLI for drizzle-docs-generator
 *
 * Generates DBML files from Drizzle ORM schema definitions.
 */

import { Command } from "commander";
import { existsSync, lstatSync, readdirSync, readFileSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pgGenerate, mysqlGenerate, sqliteGenerate } from "../generator/index";
import { register } from "tsx/esm/api";

// Register tsx loader to support TypeScript and extensionless imports
const unregister = register();

const program = new Command();

// Use import.meta.dirname (Node 20.11+) to resolve package.json
// This works correctly even after bundling
const packageJsonPath = join(import.meta.dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  version: string;
  description: string;
};

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
    source: schemaPath,
  });

  return dbml;
}

/**
 * Find all TypeScript schema files in a directory
 */
function findSchemaFiles(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        files.push(...findSchemaFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|js|mts|mjs|cts|cjs)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error reading directory ${dirPath}: ${error.message}`);
    }
  }

  return files;
}

/**
 * Resolve schema path (file or directory)
 */
function resolveSchemaPath(schema: string): string[] {
  const schemaPath = resolve(process.cwd(), schema);

  // Check if path exists
  if (!existsSync(schemaPath)) {
    console.error(`Error: Schema path not found: ${schemaPath}`);
    process.exit(1);
  }

  // Check if it's a directory
  const stats = lstatSync(schemaPath);
  if (stats.isDirectory()) {
    const schemaFiles = findSchemaFiles(schemaPath);
    if (schemaFiles.length === 0) {
      console.error(`Error: No schema files found in directory: ${schemaPath}`);
      process.exit(1);
    }
    return schemaFiles;
  }

  // Single file
  return [schemaPath];
}

/**
 * Run the generate command
 */
async function runGenerate(schema: string, options: GenerateCommandOptions): Promise<void> {
  const schemaPaths = resolveSchemaPath(schema);

  try {
    // Merge all schema modules
    const mergedSchema: Record<string, unknown> = {};

    for (const schemaPath of schemaPaths) {
      const schemaUrl = pathToFileURL(schemaPath).href;
      const cacheBuster = options.watch ? `?t=${Date.now()}` : "";

      try {
        const schemaModule = (await import(schemaUrl + cacheBuster)) as Record<string, unknown>;
        Object.assign(mergedSchema, schemaModule);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error importing ${schemaPath}: ${error.message}`);
          console.error("\nPossible causes:");
          console.error("- Syntax error in the schema file");
          console.error("- Missing dependencies (make sure drizzle-orm is installed)");
          console.error("- Circular dependencies between schema files");
        }
        throw error;
      }
    }

    const generate = getGenerator(options.dialect);
    const dbml = generate({
      schema: mergedSchema,
      out: options.output,
      relational: options.relational,
      source: schemaPaths[0], // Use first file for source path
    });

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
  .argument("<schema>", "Path to Drizzle schema file or directory")
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

// Cleanup: Unregister tsx loader when process exits
process.on("exit", () => {
  unregister();
});
