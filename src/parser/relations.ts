import * as ts from "typescript";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Parsed relation from relations() definition
 */
export interface ParsedRelation {
  /** Name of the source table (the first argument of relations()) */
  sourceTable: string;
  /** Name of the target table (the first argument of one()/many()) */
  targetTable: string;
  /** Relation type: "one" or "many" */
  type: "one" | "many";
  /** Source column names (from fields array) */
  fields: string[];
  /** Target column names (from references array) */
  references: string[];
}

/**
 * All extracted relations from a schema file
 */
export interface SchemaRelations {
  relations: ParsedRelation[];
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
 * Extract relations from a Drizzle schema source file or directory using AST parsing
 *
 * Parses TypeScript source files and extracts:
 * - relations() function calls
 * - one() and many() relation definitions within them
 * - fields and references arrays for generating DBML Refs
 *
 * @param sourcePath - Path to the TypeScript schema file or directory
 * @returns Extracted relations
 */
export function extractRelations(sourcePath: string): SchemaRelations {
  const result: SchemaRelations = { relations: [] };
  const files = getTypeScriptFiles(sourcePath);

  for (const filePath of files) {
    const sourceCode = readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

    // Visit all nodes to find relations() calls
    visitNode(sourceFile, sourceFile, result);
  }

  return result;
}

/**
 * Recursively visit AST nodes to find relations() definitions
 */
function visitNode(node: ts.Node, sourceFile: ts.SourceFile, result: SchemaRelations): void {
  // Look for variable declarations that define relations
  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      if (declaration.initializer && ts.isCallExpression(declaration.initializer)) {
        const parsedRelations = parseRelationsDefinition(declaration.initializer, sourceFile);
        if (parsedRelations) {
          result.relations.push(...parsedRelations);
        }
      }
    }
  }

  // Also check for direct call expressions (e.g., export const x = relations(...))
  if (ts.isExportAssignment(node) && ts.isCallExpression(node.expression)) {
    const parsedRelations = parseRelationsDefinition(node.expression, sourceFile);
    if (parsedRelations) {
      result.relations.push(...parsedRelations);
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, sourceFile, result));
}

/**
 * Parse a relations() call expression
 *
 * Example:
 * relations(posts, ({ one }) => ({
 *   author: one(users, {
 *     fields: [posts.authorId],
 *     references: [users.id],
 *   }),
 * }))
 */
function parseRelationsDefinition(
  callExpr: ts.CallExpression,
  sourceFile: ts.SourceFile,
): ParsedRelation[] | undefined {
  const funcName = getCallExpressionName(callExpr);

  if (funcName !== "relations") {
    return undefined;
  }

  // Get source table from first argument
  const sourceTableArg = callExpr.arguments[0];
  if (!sourceTableArg) {
    return undefined;
  }
  const sourceTable = extractIdentifierName(sourceTableArg);
  if (!sourceTable) {
    return undefined;
  }

  // Get the callback function (second argument)
  const callbackArg = callExpr.arguments[1];
  if (!callbackArg || !ts.isArrowFunction(callbackArg)) {
    return undefined;
  }

  // Parse the callback body for one()/many() calls
  return parseRelationsCallback(sourceTable, callbackArg, sourceFile);
}

/**
 * Parse the callback function inside relations()
 */
function parseRelationsCallback(
  sourceTable: string,
  callback: ts.ArrowFunction,
  sourceFile: ts.SourceFile,
): ParsedRelation[] {
  const relations: ParsedRelation[] = [];

  // The callback body should be an object literal or parenthesized expression containing object literal
  let body = callback.body;

  // Unwrap parenthesized expression: ({ ... })
  if (ts.isParenthesizedExpression(body)) {
    body = body.expression;
  }

  if (!ts.isObjectLiteralExpression(body)) {
    return relations;
  }

  // Iterate over object properties to find one()/many() calls
  for (const property of body.properties) {
    if (ts.isPropertyAssignment(property) && ts.isCallExpression(property.initializer)) {
      const relation = parseRelationCall(sourceTable, property.initializer, sourceFile);
      if (relation) {
        relations.push(relation);
      }
    }
  }

  return relations;
}

/**
 * Parse a one() or many() call expression
 */
function parseRelationCall(
  sourceTable: string,
  callExpr: ts.CallExpression,
  _sourceFile: ts.SourceFile,
): ParsedRelation | undefined {
  const funcName = getCallExpressionName(callExpr);

  if (funcName !== "one" && funcName !== "many") {
    return undefined;
  }

  // Get target table from first argument
  const targetTableArg = callExpr.arguments[0];
  if (!targetTableArg) {
    return undefined;
  }
  const targetTable = extractIdentifierName(targetTableArg);
  if (!targetTable) {
    return undefined;
  }

  // For many(), there might not be a config object (no fields/references)
  // In that case, the relation is only useful if there's a corresponding one() on the other side
  const configArg = callExpr.arguments[1];

  let fields: string[] = [];
  let references: string[] = [];

  if (configArg && ts.isObjectLiteralExpression(configArg)) {
    // Parse fields and references from config object
    for (const property of configArg.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        const propName = property.name.text;

        if (propName === "fields" && ts.isArrayLiteralExpression(property.initializer)) {
          fields = extractColumnNames(property.initializer);
        } else if (propName === "references" && ts.isArrayLiteralExpression(property.initializer)) {
          references = extractColumnNames(property.initializer);
        }
      }
    }
  }

  return {
    sourceTable,
    targetTable,
    type: funcName,
    fields,
    references,
  };
}

/**
 * Extract column names from an array literal like [posts.authorId, posts.title]
 */
function extractColumnNames(arrayLiteral: ts.ArrayLiteralExpression): string[] {
  const names: string[] = [];

  for (const element of arrayLiteral.elements) {
    // Handle property access like: posts.authorId
    if (ts.isPropertyAccessExpression(element)) {
      names.push(element.name.text);
    }
    // Handle identifier (less common)
    else if (ts.isIdentifier(element)) {
      names.push(element.text);
    }
  }

  return names;
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
 * Extract identifier name from an expression
 */
function extractIdentifierName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  return undefined;
}
