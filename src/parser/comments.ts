import * as ts from "typescript";
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
 * - JSDoc comments on table definitions (e.g., pgTable, mysqlTable, sqliteTable)
 * - JSDoc comments on column definitions within tables
 *
 * @param sourcePath - Path to the TypeScript schema file or directory
 * @returns Extracted comments organized by table and column
 */
export function extractComments(sourcePath: string): SchemaComments {
  const comments: SchemaComments = { tables: {} };
  const files = getTypeScriptFiles(sourcePath);

  for (const filePath of files) {
    const sourceCode = readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

    // Visit all nodes in the source file
    visitNode(sourceFile, sourceFile, comments);
  }

  return comments;
}

/**
 * Recursively visit AST nodes to find table and column definitions
 */
function visitNode(node: ts.Node, sourceFile: ts.SourceFile, comments: SchemaComments): void {
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
          declaration.name.text,
          declaration.initializer,
          sourceFile,
          jsDocComment,
        );
        if (tableInfo) {
          comments.tables[tableInfo.tableName] = tableInfo.tableComment;
        }
      }
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, sourceFile, comments));
}

/**
 * Parse a table definition call expression (e.g., pgTable("users", { ... }))
 */
function parseTableDefinition(
  _variableName: string,
  callExpr: ts.CallExpression,
  sourceFile: ts.SourceFile,
  tableJsDoc: string | undefined,
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

  // Get column definitions from second argument
  const columnsArg = callExpr.arguments[1];
  const columnComments: Record<string, ColumnComment> = {};

  if (columnsArg && ts.isObjectLiteralExpression(columnsArg)) {
    for (const property of columnsArg.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        const columnName = extractColumnName(property.initializer);
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
 */
function isTableDefinitionFunction(funcName: string | undefined): boolean {
  if (!funcName) return false;
  return ["pgTable", "mysqlTable", "sqliteTable"].includes(funcName);
}

/**
 * Extract the actual column name from a column definition
 * e.g., serial("id") -> "id", text("name") -> "name"
 */
function extractColumnName(expr: ts.Expression): string | undefined {
  // Handle chained calls like serial("id").primaryKey()
  let current = expr;

  while (ts.isCallExpression(current)) {
    if (ts.isPropertyAccessExpression(current.expression)) {
      // This is a method call like .primaryKey(), go deeper
      current = current.expression.expression;
    } else if (ts.isIdentifier(current.expression)) {
      // This is the base call like serial("id")
      const firstArg = current.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg)) {
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
