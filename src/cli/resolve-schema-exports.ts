/**
 * Resolve schema module exports, handling CJS default export wrapping.
 * When a CJS module is loaded via import(), its exports are wrapped in
 * a `default` property. This function unwraps them so table definitions
 * are accessible as top-level properties.
 */
export function resolveSchemaExports(mod: Record<string, unknown>): Record<string, unknown> {
  const { default: defaultExport, ...namedExports } = mod;
  if (defaultExport && typeof defaultExport === "object" && !Array.isArray(defaultExport)) {
    return { ...(defaultExport as Record<string, unknown>), ...namedExports };
  }
  return mod;
}
