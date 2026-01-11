#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const program = new Command();

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8")
) as { version: string; description: string };

program
  .name("drizzle-docs")
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command("generate")
  .description("Generate DBML from Drizzle schema files")
  .argument("<schema>", "Path to Drizzle schema file")
  .option("-o, --output <file>", "Output file path")
  .option(
    "-d, --dialect <dialect>",
    "Database dialect (postgresql, mysql, sqlite)",
    "postgresql"
  )
  .action(
    (
      schema: string,
      options: { output?: string; dialect: string }
    ) => {
      const schemaPath = resolve(process.cwd(), schema);
      console.log(`Generating DBML from: ${schemaPath}`);
      console.log(`Dialect: ${options.dialect}`);
      if (options.output) {
        console.log(`Output: ${options.output}`);
      }
      // TODO: Implement generation logic
      console.log("Generation not yet implemented");
    }
  );

program.parse();
