import * as ts from "typescript";
import { getCasingFn, type Casing } from "drizzle-orm/casing";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
 * All extracted comments from a schema file
 */
export interface SchemaComments {
  tables: Record<string, TableComment>;
}

/**
 * Column casing associated with an identifier, shared across all parsed files.
 *
 * Holds import aliases of the Drizzle v1 casing helpers
 * (e.g., `import { snakeCase as sc }`) and schema variables created from them
 * (e.g., `const auth = snakeCase.schema("auth")`).
 */
type CasingByIdentifier = Map<string, Casing>;

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
 *
 * Column comments are keyed by the database column name. When a column has no
 * explicit name (Drizzle v1 style, e.g., `authorId: integer()`), the property key is
 * converted using the casing of the table helper (`snakeCase.table` -> `author_id`),
 * matching what Drizzle does at runtime.
 *
 * @param sourcePath - Path to the TypeScript schema file or directory
 * @returns Extracted comments organized by table and column
 */
export function extractComments(sourcePath: string): SchemaComments {
  const comments: SchemaComments = { tables: {} };
  const files = getTypeScriptFiles(sourcePath);
  const casingByIdentifier: CasingByIdentifier = new Map();

  const sourceFiles = files.map((filePath) => {
    const sourceCode = readFileSync(filePath, "utf-8");
    return ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
  });

  // First pass: collect casing helper aliases and schema variables across all files,
  // so that tables can resolve their casing regardless of file/declaration order
  for (const sourceFile of sourceFiles) {
    collectCasingIdentifiers(sourceFile, casingByIdentifier);
  }

  // Second pass: extract table and column comments
  for (const sourceFile of sourceFiles) {
    visitNode(sourceFile, sourceFile, comments, casingByIdentifier);
  }

  return comments;
}

/**
 * Record top-level identifiers that carry a column casing
 *
 * - `import { snakeCase as sc } from "drizzle-orm/pg-core"` -> sc: snake_case
 * - `const auth = snakeCase.schema("auth")` -> auth: snake_case
 *
 * Only module-level statements are inspected: imports are always top-level and
 * schema variables are declared there in practice.
 */
function collectCasingIdentifiers(
  sourceFile: ts.SourceFile,
  casingByIdentifier: CasingByIdentifier,
): void {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const namedBindings = statement.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          const importedName = element.propertyName?.text ?? element.name.text;
          const casing = getCasingFromHelperName(importedName);
          if (casing) {
            casingByIdentifier.set(element.name.text, casing);
          }
        }
      }
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (
          ts.isIdentifier(declaration.name) &&
          initializer &&
          ts.isCallExpression(initializer) &&
          getCallExpressionName(initializer) === "schema"
        ) {
          const casing = resolveCasing(initializer, casingByIdentifier);
          if (casing) {
            casingByIdentifier.set(declaration.name.text, casing);
          }
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
  comments: SchemaComments,
  casingByIdentifier: CasingByIdentifier,
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
          casingByIdentifier,
        );
        if (tableInfo) {
          comments.tables[tableInfo.tableName] = tableInfo.tableComment;
        }
      }
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, sourceFile, comments, casingByIdentifier));
}

/**
 * Parse a table definition call expression
 * (e.g., pgTable("users", { ... }), snakeCase.table("users", { ... }))
 */
function parseTableDefinition(
  callExpr: ts.CallExpression,
  sourceFile: ts.SourceFile,
  tableJsDoc: string | undefined,
  casingByIdentifier: CasingByIdentifier,
): { tableName: string; tableComment: TableComment } | undefined {
  const funcName = getCallExpressionName(callExpr);

  // Check if this is a table definition function
  if (!isTableDefinitionFunction(funcName)) {
    return undefined;
  }

  // Get table name from first argument
  const tableNameArg = callExpr.arguments[0];
  if (!tableNameArg || !ts.isStringLiteral(tableNameArg)) {
    return undefined;
  }
  const tableName = tableNameArg.text;

  // Casing applied to property keys of columns without an explicit name
  const casingFn = getCasingFn(resolveCasing(callExpr.expression, casingByIdentifier));

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
 * Check if a function name is a table definition function
 *
 * - pgTable / mysqlTable / sqliteTable: classic table helpers
 * - table: Drizzle v1 casing helpers (`snakeCase.table(...)`) and
 *   schema helpers (`pgSchema("auth").table(...)`)
 * - withRLS: PostgreSQL RLS variant (`pgTable.withRLS(...)`)
 */
function isTableDefinitionFunction(funcName: string | undefined): boolean {
  if (!funcName) return false;
  return ["pgTable", "mysqlTable", "sqliteTable", "table", "withRLS"].includes(funcName);
}

/**
 * Map a Drizzle v1 casing helper name to its casing
 */
function getCasingFromHelperName(name: string): Casing | undefined {
  if (name === "snakeCase") return "snake_case";
  if (name === "camelCase") return "camelCase";
  return undefined;
}

/**
 * Resolve the column casing from the callee of a table definition
 *
 * Walks the receiver chain of expressions such as:
 * - `snakeCase.table` -> snake_case
 * - `snakeCase.table.withRLS` -> snake_case
 * - `camelCase.schema("auth").table` -> camelCase
 * - `authSchema.table` (where `authSchema = snakeCase.schema("auth")`) -> snake_case
 * - `pgTable`, `pgSchema("auth").table` -> undefined (no casing conversion)
 */
function resolveCasing(
  expr: ts.Expression,
  casingByIdentifier: CasingByIdentifier,
): Casing | undefined {
  if (ts.isIdentifier(expr)) {
    return getCasingFromHelperName(expr.text) ?? casingByIdentifier.get(expr.text);
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return (
      getCasingFromHelperName(expr.name.text) ?? resolveCasing(expr.expression, casingByIdentifier)
    );
  }
  if (ts.isCallExpression(expr)) {
    return resolveCasing(expr.expression, casingByIdentifier);
  }
  return undefined;
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
