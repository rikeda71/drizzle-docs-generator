/**
 * CLI runner utility for integration tests
 *
 * Provides functions to execute the CLI and capture output
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI with the given arguments
 *
 * @param args - CLI arguments (e.g., ["generate", "schema.ts", "-d", "postgresql"])
 * @param options - Optional configuration
 * @returns Promise resolving to CLI output and exit code
 */
export async function runCli(
  args: string[],
  options: { cwd?: string; timeout?: number } = {},
): Promise<CliResult> {
  const { cwd = process.cwd(), timeout = 30000 } = options;

  // Path to the built CLI
  const cliPath = resolve(import.meta.dirname, "../../dist/cli/index.js");

  return new Promise((resolve, reject) => {
    const proc = spawn("node", [cliPath, ...args], {
      cwd,
      env: { ...process.env, NODE_ENV: "test" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      reject(new Error(`CLI execution timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Run the CLI generate command with common options
 *
 * @param schemaPath - Path to the schema file
 * @param dialect - Database dialect
 * @param options - Additional CLI options
 * @returns Promise resolving to CLI output and exit code
 */
export async function runGenerate(
  schemaPath: string,
  dialect: "postgresql" | "mysql" | "sqlite",
  options: {
    output?: string;
    relational?: boolean;
    format?: "dbml" | "markdown";
    singleFile?: boolean;
    noErDiagram?: boolean;
    force?: boolean;
    cwd?: string;
  } = {},
): Promise<CliResult> {
  const args = ["generate", schemaPath, "-d", dialect];

  if (options.output) {
    args.push("-o", options.output);
  }

  if (options.relational) {
    args.push("-r");
  }

  if (options.format) {
    args.push("-f", options.format);
  }

  if (options.singleFile) {
    args.push("--single-file");
  }

  if (options.noErDiagram) {
    args.push("--no-er-diagram");
  }

  if (options.force) {
    args.push("--force");
  }

  return runCli(args, { cwd: options.cwd });
}
