# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**drizzle-docs-generator** - A CLI tool that generates DBML (Database Markup Language) files from Drizzle ORM schema definitions.

### Key Features

- Parse Drizzle ORM schema files written in TypeScript
- Generate DBML format output for database documentation
- Use AST (Abstract Syntax Tree) parsing to extract schema information
- Support comment clauses in DBML output (not natively supported by Drizzle)

### Technical Approach

- **AST Parsing**: Use TypeScript Compiler API or @babel/parser to parse Drizzle schema files
- **Schema Analysis**: Extract table definitions, columns, relationships, and comments from the AST
- **DBML Generation**: Transform parsed schema into valid DBML format
- **CLI Interface**: Provide command-line interface for easy usage

## Package Manager

This project uses **pnpm** (v10.24.0) as specified in `package.json`. Always use `pnpm` commands instead of `npm` or `yarn`.

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm build                # Build the project (when configured)
pnpm test                 # Run tests (when configured)
pnpm dev                  # Run in development mode (when configured)
pnpm format               # Format code with oxfmt
pnpm lint                 # Run linter
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

### Core Components (To Be Implemented)

1. **Schema Parser** (`src/parser/`)
   - Read Drizzle schema files (.ts)
   - Parse TypeScript code into AST
   - Extract schema definitions (tables, columns, relations)
   - Handle JSDoc comments for additional metadata

2. **DBML Generator** (`src/generator/`)
   - Transform parsed schema into DBML format
   - Generate table definitions with columns and types
   - Include relationships (foreign keys, references)
   - Add comment clauses from JSDoc or inline comments

3. **CLI Interface** (`src/cli/`)
   - Parse command-line arguments
   - Handle file input/output
   - Provide error messages and usage help

4. **Type Mappings** (`src/mappings/`)
   - Map Drizzle column types to DBML types
   - Handle database-specific types (PostgreSQL, MySQL, SQLite)

### Key Dependencies (Planned)

- TypeScript Compiler API (`typescript`) for AST parsing
- CLI framework (e.g., `commander`, `yargs`)
- File system operations (`fs-extra` or Node.js `fs/promises`)
- Drizzle ORM types for reference

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

## Notes

- The project uses ISC license
- Drizzle natively supports `drizzle-kit push` with `--dbml` flag, but it doesn't include comments
- This tool extends that functionality by parsing comments from source code
- use `gh` for view PR, create Issue, etc...
  - :warning: use `gh` with `--repo rikeda71/drizzle-docs-generator` option
