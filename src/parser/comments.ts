import * as ts from "typescript";
import { getCasingFn, type Casing } from "drizzle-orm/casing";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isIgnoredDirectory } from "./files";

/**
 * Comments for a single column
 */
export interface ColumnComment {
  comment: string;
}

/**
 * Comments for a single table
 */
export interface TableComment {
  comment?: string;
  columns: Record<string, ColumnComment>;
}

/**
 * Comment for a single enum value
 */
export interface EnumValueComment {
  comment: string;
}

/**
 * Comments for a single enum (PostgreSQL pgEnum)
 */
export interface EnumComment {
  comment?: string;
  values: Record<string, EnumValueComment>;
}

/**
 * All extracted comments from a schema file
 */
export interface SchemaComments {
  tables: Record<string, TableComment>;
  /**
   * Comments for PostgreSQL enums, keyed by enum name.
   * Optional for backward compatibility with pre-extracted comments.
   */
  enums?: Record<string, EnumComment>;
}

/**
 * Column casing carried by a Drizzle helper binding
 *
 * - "snake_case" / "camelCase": Drizzle v1 casing helpers (`snakeCase`, `camelCase`)
 * - "none": other Drizzle helpers that keep property keys as-is (`pgTable`, `pgSchema`, ...)
 */
type BindingCasing = Casing | "none";

/**
 * Drizzle helpers that can appear in the receiver chain of a table definition,
 * mapped to the casing they apply to column property keys
 */
const DRIZZLE_HELPER_CASINGS = new Map<string, BindingCasing>([
  ["snakeCase", "snake_case"],
  ["camelCase", "camelCase"],
  ["pgTable", "none"],
  ["mysqlTable", "none"],
  ["sqliteTable", "none"],
  ["pgSchema", "none"],
  ["mysqlSchema", "none"],
  ["mysqlDatabase", "none"],
]);

/**
 * Classic table helpers, accepted by name (`pgTable("users", ...)`)
 */
const CLASSIC_TABLE_HELPERS = ["pgTable", "mysqlTable", "sqliteTable"];

/**
 * Schema helpers whose result carries the casing of its receiver
 * (`snakeCase.schema("auth")`, `pgSchema("auth")`)
 */
const SCHEMA_HELPERS = ["schema", "pgSchema", "mysqlSchema", "mysqlDatabase"];

/**
 * Drizzle bindings imported by a single source file
 *
 * - `helpers`: local names of helpers imported from `drizzle-orm*` modules
 *   (`import { snakeCase as sc } from "drizzle-orm/pg-core"` -> sc: snake_case)
 * - `namespaces`: namespace imports of `drizzle-orm*` modules
 *   (`import * as pg from "drizzle-orm/pg-core"` -> pg)
 *
 * Kept per file so that the same alias can be bound to different helpers in different files.
 */
interface FileBindings {
  helpers: Map<string, BindingCasing>;
  namespaces: Set<string>;
}

/**
 * Bindings visible from the file being parsed
 *
 * - `file`: import bindings of the file
 * - `schemaVariables`: schema variables declared in any parsed file
 *   (`export const auth = snakeCase.schema("auth")`), so that a table file can
 *   import them from another file
 */
interface CasingScope {
  file: FileBindings;
  schemaVariables: Map<string, BindingCasing>;
}

/**
 * Get all TypeScript files from a path (file or directory)
 */
function getTypeScriptFiles(sourcePath: string): string[] {
  const stat = statSync(sourcePath);

  if (stat.isFile()) {
    return sourcePath.endsWith(".ts") ? [sourcePath] : [];
  }

  if (stat.isDirectory()) {
    const files: string[] = [];
    const entries = readdirSync(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(sourcePath, entry.name);
      if (entry.isDirectory()) {
        if (isIgnoredDirectory(entry.name)) {
          continue;
        }
        files.push(...getTypeScriptFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  return [];
}

/**
 * Extract JSDoc comments from a Drizzle schema source file or directory
 *
 * Parses TypeScript source files and extracts:
 * - JSDoc comments on table definitions
 *   (e.g., pgTable, mysqlTable, sqliteTable, snakeCase.table, mySchema.table)
 * - JSDoc comments on column definitions within tables
 * - JSDoc comments on enum definitions (pgEnum) and their values
 *
 * Column comments are keyed by the database column name. When a column has no
 * explicit name (Drizzle v1 style, e.g., `authorId: integer()`), the property key is
 * converted using the casing of the table helper (`snakeCase.table` -> `author_id`),
 * matching what Drizzle does at runtime.
 *
 * @param sourcePath - Path to the TypeScript schema file or directory
 * @returns Extracted comments organized by table, column, and enum
 */
export function extractComments(sourcePath: string): SchemaComments {
  const comments: Required<SchemaComments> = { tables: {}, enums: {} };
  const files = getTypeScriptFiles(sourcePath);
  const schemaVariables = new Map<string, BindingCasing>();

  const scopes = files.map((filePath): [ts.SourceFile, CasingScope] => {
    const sourceCode = readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
    return [sourceFile, { file: collectImportBindings(sourceFile), schemaVariables }];
  });

  // First pass: collect schema variables across all files,
  // so that tables can resolve their casing regardless of file/declaration order
  for (const [sourceFile, scope] of scopes) {
    collectSchemaVariables(sourceFile, scope);
  }

  // Second pass: extract table and column comments
  for (const [sourceFile, scope] of scopes) {
    visitNode(sourceFile, sourceFile, comments, scope);
  }

  return comments;
}

/**
 * Check if a module specifier refers to Drizzle ORM
 * (`drizzle-orm`, `drizzle-orm/pg-core`, ...)
 */
function isDrizzleModule(moduleSpecifier: ts.Expression): boolean {
  return ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text.startsWith("drizzle-orm");
}

/**
 * Collect Drizzle helper bindings imported by a source file
 *
 * Only imports from `drizzle-orm*` modules are recorded, so that a `snakeCase`
 * imported from an unrelated library is not mistaken for the Drizzle helper.
 */
function collectImportBindings(sourceFile: ts.SourceFile): FileBindings {
  const bindings: FileBindings = { helpers: new Map(), namespaces: new Set() };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !isDrizzleModule(statement.moduleSpecifier)) {
      continue;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings) {
      continue;
    }
    if (ts.isNamespaceImport(namedBindings)) {
      bindings.namespaces.add(namedBindings.name.text);
    } else {
      for (const element of namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        const casing = DRIZZLE_HELPER_CASINGS.get(importedName);
        if (casing) {
          bindings.helpers.set(element.name.text, casing);
        }
      }
    }
  }

  return bindings;
}

/**
 * Record top-level schema variables created from a Drizzle binding
 *
 * - `const auth = snakeCase.schema("auth")` -> auth: snake_case
 * - `const auth = pgSchema("auth")` -> auth: none
 *
 * Only module-level statements are inspected: schema variables are declared there in practice.
 */
function collectSchemaVariables(sourceFile: ts.SourceFile, scope: CasingScope): void {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (
        ts.isIdentifier(declaration.name) &&
        initializer &&
        ts.isCallExpression(initializer) &&
        SCHEMA_HELPERS.includes(getCallExpressionName(initializer) ?? "")
      ) {
        const casing = resolveCasing(initializer, scope);
        if (casing) {
          scope.schemaVariables.set(declaration.name.text, casing);
        }
      }
    }
  }
}

/**
 * Recursively visit AST nodes to find table and column definitions
 */
function visitNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  comments: Required<SchemaComments>,
  scope: CasingScope,
): void {
  // Look for variable declarations that define tables
  if (ts.isVariableStatement(node)) {
    const jsDocComment = getJsDocComment(node, sourceFile);

    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        ts.isCallExpression(declaration.initializer)
      ) {
        const tableInfo = parseTableDefinition(
          declaration.initializer,
          sourceFile,
          jsDocComment,
          scope,
        );
        if (tableInfo) {
          comments.tables[tableInfo.tableName] = tableInfo.tableComment;
          continue;
        }

        const enumInfo = parseEnumDefinition(declaration.initializer, sourceFile, jsDocComment);
        if (enumInfo) {
          comments.enums[enumInfo.enumName] = enumInfo.enumComment;
        }
      }
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, sourceFile, comments, scope));
}

/**
 * Parse a table definition call expression
 * (e.g., pgTable("users", { ... }), snakeCase.table("users", { ... }))
 */
function parseTableDefinition(
  callExpr: ts.CallExpression,
  sourceFile: ts.SourceFile,
  tableJsDoc: string | undefined,
  scope: CasingScope,
): { tableName: string; tableComment: TableComment } | undefined {
  // Check if this is a table definition function
  if (!isTableDefinition(callExpr, scope)) {
    return undefined;
  }

  // Get table name from first argument
  const tableNameArg = callExpr.arguments[0];
  if (!tableNameArg || !ts.isStringLiteral(tableNameArg)) {
    return undefined;
  }
  const tableName = tableNameArg.text;

  // Casing applied to property keys of columns without an explicit name
  const casing = resolveCasing(callExpr.expression, scope);
  const casingFn = getCasingFn(casing === "none" ? undefined : casing);

  // Get column definitions from second argument
  const columnsArg = callExpr.arguments[1];
  const columnComments: Record<string, ColumnComment> = {};

  if (columnsArg && ts.isObjectLiteralExpression(columnsArg)) {
    for (const property of columnsArg.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        const columnName = extractColumnName(property.initializer, property.name.text, casingFn);
        const columnJsDoc = getJsDocComment(property, sourceFile);

        if (columnName && columnJsDoc) {
          columnComments[columnName] = { comment: columnJsDoc };
        }
      }
    }
  }

  return {
    tableName,
    tableComment: {
      comment: tableJsDoc,
      columns: columnComments,
    },
  };
}

/**
 * Parse an enum definition call expression
 *
 * Supports both the array form and the object form of pgEnum:
 * - pgEnum("status", ["active", "inactive"])
 * - pgEnum("status", { Active: "active", Inactive: "inactive" })
 * - mySchema.enum("status", [...]) (pgSchema().enum())
 *
 * Value comments are keyed by the database value (string literal), not the
 * TypeScript object key.
 */
function parseEnumDefinition(
  callExpr: ts.CallExpression,
  sourceFile: ts.SourceFile,
  enumJsDoc: string | undefined,
): { enumName: string; enumComment: EnumComment } | undefined {
  const funcName = getCallExpressionName(callExpr);

  if (!isEnumDefinitionFunction(funcName)) {
    return undefined;
  }

  // Get enum name from first argument
  const enumNameArg = callExpr.arguments[0];
  if (!enumNameArg || !ts.isStringLiteral(enumNameArg)) {
    return undefined;
  }
  const enumName = enumNameArg.text;

  // Get enum values from second argument
  const valuesArg = callExpr.arguments[1];
  const valueComments: Record<string, EnumValueComment> = {};

  if (valuesArg && ts.isArrayLiteralExpression(valuesArg)) {
    for (const element of valuesArg.elements) {
      if (ts.isStringLiteralLike(element)) {
        const valueJsDoc = getJsDocComment(element, sourceFile);
        if (valueJsDoc) {
          valueComments[element.text] = { comment: valueJsDoc };
        }
      }
    }
  } else if (valuesArg && ts.isObjectLiteralExpression(valuesArg)) {
    for (const property of valuesArg.properties) {
      if (ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) {
        const valueJsDoc = getJsDocComment(property, sourceFile);
        if (valueJsDoc) {
          valueComments[property.initializer.text] = { comment: valueJsDoc };
        }
      }
    }
  } else {
    return undefined;
  }

  return {
    enumName,
    enumComment: {
      comment: enumJsDoc,
      values: valueComments,
    },
  };
}

/**
 * Get the function name from a call expression
 */
function getCallExpressionName(callExpr: ts.CallExpression): string | undefined {
  if (ts.isIdentifier(callExpr.expression)) {
    return callExpr.expression.text;
  }
  if (ts.isPropertyAccessExpression(callExpr.expression)) {
    return callExpr.expression.name.text;
  }
  return undefined;
}

/**
 * Check if a call expression is a table definition
 *
 * - pgTable / mysqlTable / sqliteTable: classic table helpers, accepted by name
 * - table / withRLS: accepted only when the receiver resolves to a Drizzle binding
 *   (`snakeCase.table(...)`, `pgSchema("auth").table(...)`, `pgTable.withRLS(...)`),
 *   so that unrelated `.table()` calls are not mistaken for table definitions
 */
function isTableDefinition(callExpr: ts.CallExpression, scope: CasingScope): boolean {
  const funcName = getCallExpressionName(callExpr);
  if (!funcName) return false;
  if (CLASSIC_TABLE_HELPERS.includes(funcName)) return true;
  if (funcName === "table" || funcName === "withRLS") {
    return (
      ts.isPropertyAccessExpression(callExpr.expression) &&
      resolveCasing(callExpr.expression.expression, scope) !== undefined
    );
  }
  return false;
}

/**
 * Resolve the column casing from the callee of a table definition
 *
 * Walks the receiver chain of expressions such as:
 * - `snakeCase.table` -> snake_case
 * - `snakeCase.table.withRLS` -> snake_case
 * - `camelCase.schema("auth").table` -> camelCase
 * - `authSchema.table` (where `authSchema = snakeCase.schema("auth")`) -> snake_case
 * - `pg.snakeCase.table` (where `pg` is a namespace import) -> snake_case
 * - `pgTable.withRLS`, `pgSchema("auth").table` -> none (no casing conversion)
 * - anything not bound to a Drizzle helper -> undefined
 */
function resolveCasing(expr: ts.Expression, scope: CasingScope): BindingCasing | undefined {
  if (ts.isIdentifier(expr)) {
    return scope.file.helpers.get(expr.text) ?? scope.schemaVariables.get(expr.text);
  }
  if (ts.isPropertyAccessExpression(expr)) {
    // Helper accessed through a namespace import (`pg.snakeCase`)
    if (ts.isIdentifier(expr.expression) && scope.file.namespaces.has(expr.expression.text)) {
      return DRIZZLE_HELPER_CASINGS.get(expr.name.text);
    }
    // `.table`, `.withRLS`, `.schema` keep the casing of their receiver
    return resolveCasing(expr.expression, scope);
  }
  if (ts.isCallExpression(expr)) {
    return resolveCasing(expr.expression, scope);
  }
  return undefined;
}

/**
 * Check if a function name is an enum definition function
 *
 * `enum` covers the schema-scoped form: pgSchema("name").enum(...)
 */
function isEnumDefinitionFunction(funcName: string | undefined): boolean {
  if (!funcName) return false;
  return ["pgEnum", "enum"].includes(funcName);
}

/**
 * Extract the actual column name from a column definition
 *
 * - Explicit name: serial("id") -> "id", text("name") -> "name"
 * - No name (Drizzle v1 style): integer(), varchar({ length: 255 })
 *   -> property key converted with the table's casing (e.g., authorId -> author_id)
 *
 * @param expr - The column definition expression (including chained calls)
 * @param propertyKey - The property key of the column in the table definition
 * @param casingFn - Casing function to apply to the property key
 */
function extractColumnName(
  expr: ts.Expression,
  propertyKey: string,
  casingFn: (name: string) => string,
): string | undefined {
  // Handle chained calls like serial("id").primaryKey()
  let current = expr;

  while (ts.isCallExpression(current)) {
    if (ts.isPropertyAccessExpression(current.expression)) {
      // This is a method call like .primaryKey(), go deeper
      current = current.expression.expression;
    } else if (ts.isIdentifier(current.expression)) {
      // This is the base call like serial("id") or integer()
      const firstArg = current.arguments[0];
      if (!firstArg || ts.isObjectLiteralExpression(firstArg)) {
        // No explicit name: Drizzle derives the column name from the property key
        return casingFn(propertyKey);
      }
      if (ts.isStringLiteral(firstArg)) {
        return firstArg.text;
      }
      return undefined;
    } else {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Get JSDoc comment from a node
 */
function getJsDocComment(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const fullText = sourceFile.getFullText();
  const nodeStart = node.getFullStart();
  const leadingComments = ts.getLeadingCommentRanges(fullText, nodeStart);

  if (!leadingComments || leadingComments.length === 0) {
    return undefined;
  }

  // Find JSDoc comment (starts with /**)
  for (const comment of leadingComments) {
    const commentText = fullText.slice(comment.pos, comment.end);
    if (commentText.startsWith("/**")) {
      return parseJsDocComment(commentText);
    }
  }

  // Fall back to single-line comments
  for (const comment of leadingComments) {
    const commentText = fullText.slice(comment.pos, comment.end);
    if (commentText.startsWith("//")) {
      return commentText.slice(2).trim();
    }
  }

  return undefined;
}

/**
 * Parse JSDoc comment text to extract the description
 *
 * Preserves newlines in the output for proper formatting in DBML and Markdown.
 */
function parseJsDocComment(commentText: string): string {
  // Remove /** and */
  let text = commentText.slice(3, -2);

  // Split into lines and process
  const lines = text.split("\n").map((line) => {
    // Remove leading * and whitespace
    return line.replace(/^\s*\*\s?/, "").trim();
  });

  // Filter out @tags and empty lines at start/end
  const contentLines: string[] = [];
  for (const line of lines) {
    // Stop at first @tag
    if (line.startsWith("@")) {
      break;
    }
    contentLines.push(line);
  }

  // Remove trailing empty lines
  while (contentLines.length > 0 && contentLines[contentLines.length - 1] === "") {
    contentLines.pop();
  }

  // Remove leading empty lines
  while (contentLines.length > 0 && contentLines[0] === "") {
    contentLines.shift();
  }

  // Join with newlines to preserve formatting
  return contentLines.join("\n").trim();
}
