/**
 * Check whether a directory must be skipped when scanning for schema files
 *
 * Dependencies (node_modules) and hidden directories (e.g. .git) never contain
 * user schema files, and importing files from them can fail.
 */
export function isIgnoredDirectory(name: string): boolean {
  return name === "node_modules" || name.startsWith(".");
}
