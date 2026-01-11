#!/usr/bin/env node

/**
 * CLI for drizzle-docs-generator
 *
 * TODO: CLI実装が必要
 * - スキーマファイルの動的インポート（import()を使用）
 * - pgGenerate/mysqlGenerate/sqliteGenerateの呼び出し
 * - エラーハンドリング（ファイル不存在、インポートエラー等）
 * - --watch オプションでファイル変更監視
 *
 * 実装例:
 * ```typescript
 * .action(async (schema, options) => {
 *   const schemaPath = resolve(process.cwd(), schema);
 *   const schemaModule = await import(schemaPath);
 *   const generate = options.dialect === "mysql" ? mysqlGenerate
 *     : options.dialect === "sqlite" ? sqliteGenerate
 *     : pgGenerate;
 *   const dbml = generate({ schema: schemaModule, out: options.output });
 *   if (!options.output) console.log(dbml);
 * });
 * ```
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const program = new Command();

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as { version: string; description: string };

program.name("drizzle-docs").description(packageJson.description).version(packageJson.version);

program
  .command("generate")
  .description("Generate DBML from Drizzle schema files")
  .argument("<schema>", "Path to Drizzle schema file")
  .option("-o, --output <file>", "Output file path")
  .option("-d, --dialect <dialect>", "Database dialect (postgresql, mysql, sqlite)", "postgresql")
  .action((schema: string, options: { output?: string; dialect: string }) => {
    const schemaPath = resolve(process.cwd(), schema);
    console.log(`Generating DBML from: ${schemaPath}`);
    console.log(`Dialect: ${options.dialect}`);
    if (options.output) {
      console.log(`Output: ${options.output}`);
    }
    // TODO: Implement generation logic
    console.log("Generation not yet implemented");
  });

program.parse();
