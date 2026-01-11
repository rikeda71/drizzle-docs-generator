/**
 * Test utilities for integration testing
 */

export { runCli, runGenerate } from "./cli-runner.js";
export type { CliResult } from "./cli-runner.js";
export {
  hasAllTables,
  hasAllColumns,
  hasReference,
  hasIndexes,
  hasTableNote,
  countTables,
  countRefs,
} from "./dbml-validator.js";
