import type { IntermediateSchema } from "../types";

/**
 * Options for output formatters
 */
export interface FormatterOptions {
  /**
   * Whether to include table/column comments in the output
   * @default true
   */
  includeComments?: boolean;

  /**
   * Whether to include indexes in the output
   * @default true
   */
  includeIndexes?: boolean;

  /**
   * Whether to include constraints in the output
   * @default true
   */
  includeConstraints?: boolean;
}

/**
 * OutputFormatter interface for generating various output formats from IntermediateSchema
 *
 * Implementations of this interface convert the database-agnostic IntermediateSchema
 * representation into specific output formats (DBML, Markdown, JSON, etc.)
 */
export interface OutputFormatter {
  /**
   * Format the intermediate schema into the target output format
   *
   * @param schema - The intermediate schema representation to format
   * @returns The formatted output as a string
   */
  format(schema: IntermediateSchema): string;
}
