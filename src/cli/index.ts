#!/usr/bin/env node

/**
 * CLI for drizzle-docs-generator
 *
 * Generates DBML files from Drizzle ORM schema definitions.
 */

import { Command } from "commander";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  watch,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pgGenerate, mysqlGenerate, sqliteGenerate } from "../generator/index";
import { PgGenerator, MySqlGenerator, SqliteGenerator } from "../generator/index";
import { MarkdownFormatter } from "../formatter/markdown";
import { MermaidErDiagramFormatter } from "../formatter/mermaid";
import { register } from "tsx/esm/api";
import type { IntermediateSchema } from "../types";

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
type OutputFormat = "dbml" | "markdown";

interface GenerateCommandOptions {
  output?: string;
  dialect: Dialect;
  relational?: boolean;
  watch?: boolean;
  format: OutputFormat;
  singleFile?: boolean;
  erDiagram: boolean; // commander uses --no-er-diagram which sets erDiagram to false
}

/**
 * Get the generate function based on dialect
 */
function getGenerateFunction(dialect: Dialect) {
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
 * Get the generator class based on dialect
 */
function getGeneratorClass(dialect: Dialect) {
  switch (dialect) {
    case "mysql":
      return MySqlGenerator;
    case "sqlite":
      return SqliteGenerator;
    case "postgresql":
    default:
      return PgGenerator;
  }
}

/**
 * Generate output from a schema file (for watch mode)
 */
async function generateFromSchema(
  schemaPath: string,
  options: GenerateCommandOptions,
): Promise<string | undefined> {
  // Use file URL for dynamic import (required for ESM)
  const schemaUrl = pathToFileURL(schemaPath).href;

  // Dynamic import with cache busting for watch mode
  const cacheBuster = options.watch ? `?t=${Date.now()}` : "";
  const schemaModule = (await import(schemaUrl + cacheBuster)) as Record<string, unknown>;

  if (options.format === "markdown") {
    const GeneratorClass = getGeneratorClass(options.dialect);
    const generator = new GeneratorClass({
      schema: schemaModule,
      relational: options.relational,
      source: schemaPath,
    });
    const intermediateSchema = generator.toIntermediateSchema();
    return generateMarkdownOutput(intermediateSchema, options);
  } else {
    const generate = getGenerateFunction(options.dialect);
    return generate({
      schema: schemaModule,
      relational: options.relational,
      source: schemaPath,
    });
  }
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
 * Generate DBML format output
 */
function generateDbmlOutput(
  mergedSchema: Record<string, unknown>,
  schemaPaths: string[],
  options: GenerateCommandOptions,
): string {
  const generate = getGenerateFunction(options.dialect);
  return (
    generate({
      schema: mergedSchema,
      relational: options.relational,
      source: schemaPaths[0],
    }) || ""
  );
}

/**
 * Generate Markdown format output
 */
function generateMarkdownOutput(
  intermediateSchema: IntermediateSchema,
  options: GenerateCommandOptions,
): string {
  const markdownFormatter = new MarkdownFormatter();
  const markdown = markdownFormatter.format(intermediateSchema);

  // Include ER diagram unless --no-er-diagram is specified
  if (options.erDiagram) {
    const mermaidFormatter = new MermaidErDiagramFormatter();
    const erDiagram = mermaidFormatter.format(intermediateSchema);

    return `${markdown}\n\n---\n\n## ER Diagram\n\n\`\`\`mermaid\n${erDiagram}\n\`\`\``;
  }

  return markdown;
}

/**
 * Write Markdown to multiple files (one per table)
 */
function writeMarkdownMultipleFiles(
  intermediateSchema: IntermediateSchema,
  outputDir: string,
  options: GenerateCommandOptions,
): void {
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  const markdownFormatter = new MarkdownFormatter();

  // Write README.md with index
  const index = markdownFormatter.generateIndex(intermediateSchema);
  let readme = `${index}\n`;

  // Add ER diagram to README unless disabled
  if (options.erDiagram) {
    const mermaidFormatter = new MermaidErDiagramFormatter();
    const erDiagram = mermaidFormatter.format(intermediateSchema);
    readme += `\n---\n\n## ER Diagram\n\n\`\`\`mermaid\n${erDiagram}\n\`\`\``;
  }

  writeFileSync(join(outputDir, "README.md"), readme, "utf-8");

  // Write individual table files
  for (const table of intermediateSchema.tables) {
    const tableDoc = markdownFormatter.generateTableDoc(table, intermediateSchema);
    const fileName = `${table.name}.md`;
    writeFileSync(join(outputDir, fileName), `# ${table.name}\n\n${tableDoc}`, "utf-8");
  }
}

/**
 * Write single Markdown file
 */
function writeSingleMarkdownFile(content: string, outputPath: string): void {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
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

    if (options.format === "markdown") {
      // Generate Markdown format
      const GeneratorClass = getGeneratorClass(options.dialect);
      const generator = new GeneratorClass({
        schema: mergedSchema,
        relational: options.relational,
        source: schemaPaths[0],
      });
      const intermediateSchema = generator.toIntermediateSchema();

      if (options.singleFile) {
        // Single file Markdown output
        const content = generateMarkdownOutput(intermediateSchema, options);

        if (options.output) {
          writeSingleMarkdownFile(content, options.output);
          console.log(`Markdown generated: ${options.output}`);
        } else {
          console.log(content);
        }
      } else {
        // Multiple files Markdown output
        if (!options.output) {
          // If no output specified, default to stdout with single file format
          const content = generateMarkdownOutput(intermediateSchema, options);
          console.log(content);
        } else {
          writeMarkdownMultipleFiles(intermediateSchema, options.output, options);
          console.log(`Markdown generated: ${options.output}/`);
        }
      }
    } else {
      // Generate DBML format (default)
      const dbml = generateDbmlOutput(mergedSchema, schemaPaths, options);

      if (options.output) {
        const dir = dirname(options.output);
        mkdirSync(dir, { recursive: true });
        writeFileSync(options.output, dbml, "utf-8");
        console.log(`DBML generated: ${options.output}`);
      } else {
        console.log(dbml);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error generating output: ${error.message}`);
    } else {
      console.error("Error generating output:", error);
    }
    process.exit(1);
  }
}

/**
 * Watch mode: regenerate on file changes
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
          const output = await generateFromSchema(schemaPath, options);
          const formatLabel = options.format === "markdown" ? "Markdown" : "DBML";

          if (!options.output && output) {
            console.log(output);
          } else if (options.output) {
            console.log(`${formatLabel} regenerated: ${options.output}`);
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
  .description("Generate documentation from Drizzle schema files")
  .argument("<schema>", "Path to Drizzle schema file or directory")
  .option("-o, --output <path>", "Output file or directory path")
  .option("-d, --dialect <dialect>", "Database dialect (postgresql, mysql, sqlite)", "postgresql")
  .option("-f, --format <format>", "Output format (dbml, markdown)", "dbml")
  .option("-r, --relational", "Use relations() definitions instead of foreign keys")
  .option("-w, --watch", "Watch for file changes and regenerate")
  .option("--single-file", "Output Markdown as a single file (for markdown format)")
  .option("--no-er-diagram", "Exclude ER diagram from Markdown output")
  .action(async (schema: string, options: GenerateCommandOptions) => {
    // Validate dialect
    const validDialects: Dialect[] = ["postgresql", "mysql", "sqlite"];
    if (!validDialects.includes(options.dialect)) {
      console.error(
        `Error: Invalid dialect "${options.dialect}". Valid options: ${validDialects.join(", ")}`,
      );
      process.exit(1);
    }

    // Validate format
    const validFormats: OutputFormat[] = ["dbml", "markdown"];
    if (!validFormats.includes(options.format)) {
      console.error(
        `Error: Invalid format "${options.format}". Valid options: ${validFormats.join(", ")}`,
      );
      process.exit(1);
    }

    // Warn if --single-file or --no-er-diagram used with non-markdown format
    if (options.format !== "markdown") {
      if (options.singleFile) {
        console.warn("Warning: --single-file is only applicable with --format markdown");
      }
      if (!options.erDiagram) {
        console.warn("Warning: --no-er-diagram is only applicable with --format markdown");
      }
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
