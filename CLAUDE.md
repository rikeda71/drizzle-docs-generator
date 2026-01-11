# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**drizzle-docs-generator** - A CLI tool that generates DBML (Database Markup Language) files from Drizzle ORM schema definitions.

For detailed user documentation, see:

- [README.md](./README.md) - English documentation
- [README.ja.md](./README.ja.md) - Japanese documentation

### Key Features

- Parse Drizzle ORM schema files written in TypeScript
- Generate DBML format output for database documentation
- Extract JSDoc comments from source code and include as DBML Note clauses
- Support relations() definitions for generating references
- Watch mode for automatic regeneration
- Support for PostgreSQL, MySQL, and SQLite

### Why This Tool Exists

While Drizzle Kit provides `drizzle-kit push --dbml` for DBML generation, it doesn't include comments in the output. This tool extends that functionality by parsing JSDoc comments from source code and converting them to DBML Note clauses.

### Technical Approach

- **AST Parsing**: Use TypeScript Compiler API to parse Drizzle schema files
- **Comment Extraction**: Extract JSDoc comments from table and column definitions
- **Schema Analysis**: Extract table definitions, columns, relationships from Drizzle schema objects
- **DBML Generation**: Transform parsed schema into valid DBML format with Note clauses
- **CLI Interface**: Provide command-line interface with watch mode support

## Package Manager

This project uses **pnpm** (v10.24.0) as specified in `package.json`. Always use `pnpm` commands instead of `npm` or `yarn`.

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm build                # Build the project
pnpm test                 # Run tests in watch mode
pnpm test:run             # Run tests once
pnpm dev                  # Build in watch mode
pnpm format               # Format code with oxfmt
pnpm lint                 # Run linter with oxlint
pnpm typecheck            # Run TypeScript type checking
```

## Before Committing

**Always run the following commands before committing changes:**

```bash
pnpm format               # Format code
pnpm lint                 # Check for lint errors
pnpm typecheck            # Check for type errors
pnpm test:run             # Run tests
```

This ensures CI will pass.

## Architecture

### Core Components

1. **Schema Parser** (`src/parser/`)
   - `comments.ts`: Extract JSDoc comments from TypeScript source files using TS Compiler API
   - `relations.ts`: Extract relations() definitions from source files
   - `index.ts`: Public API for comment extraction

2. **DBML Generator** (`src/generator/`)
   - `common.ts`: Base generator class and DBML builder utilities
   - `pg.ts`: PostgreSQL-specific DBML generator
   - `mysql.ts`: MySQL-specific DBML generator
   - `sqlite.ts`: SQLite-specific DBML generator
   - `index.ts`: Public API for DBML generation

3. **CLI Interface** (`src/cli/`)
   - `index.ts`: CLI implementation using Commander.js
   - Supports file input/output, watch mode, dialect selection
   - Dynamic import with cache busting for watch mode

### Key Dependencies

- `typescript`: TypeScript Compiler API for AST parsing
- `commander`: CLI framework for command-line argument parsing
- `drizzle-orm`: Drizzle ORM v1 beta types and runtime
- Node.js built-in modules (`fs`, `path`, `url`) for file operations

## DBML Format Reference

DBML supports:

- Table definitions with columns
- Column types, constraints, and default values
- Primary keys and indexes
- Foreign key relationships
- Table and column comments (Note clause)

Example DBML output:

```dbml
Table users {
  id integer [primary key]
  name varchar
  email varchar [unique, not null]

  Note: 'User accounts table'
}
```

## CLI Usage

### Basic Usage

```bash
# Generate DBML for PostgreSQL schema
drizzle-docs generate ./src/db/schema.ts -d postgresql

# Output to a file
drizzle-docs generate ./src/db/schema.ts -d postgresql -o schema.dbml

# Use relations() definitions for references
drizzle-docs generate ./src/db/schema.ts -d postgresql -r

# Watch mode (auto-regenerate on file changes)
drizzle-docs generate ./src/db/schema.ts -d postgresql -w
```

### Supported Dialects

- `postgresql` (default)
- `mysql`
- `sqlite`

## API Usage

### Generate DBML

```typescript
import { pgGenerate, mysqlGenerate, sqliteGenerate } from "drizzle-docs-generator";
import * as schema from "./schema";

const dbml = pgGenerate({
  schema,
  source: "./schema.ts", // For comment extraction
  relational: false, // Use relations() definitions
  out: "./output.dbml", // Optional: write to file
});
```

### Extract Comments

```typescript
import { extractComments } from "drizzle-docs-generator";

const comments = extractComments("./path/to/schema.ts");
// Returns: { tables: { [tableName]: { comment?: string, columns: { [col]: string } } } }
```

## Notes

- The project uses ISC license
- Requires Node.js >= 24
- Requires Drizzle ORM v1 beta (1.0.0-beta.10+)
- Drizzle natively supports `drizzle-kit push --dbml`, but it doesn't include comments
- This tool extends that functionality by parsing JSDoc comments from source code
- Use `gh` for viewing PRs, creating issues, etc.
  - :warning: Always use `gh` with `--repo rikeda71/drizzle-docs-generator` option
