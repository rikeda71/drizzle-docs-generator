# CLAUDE.md

Development guide for Claude Code.

## Overview

**drizzle-docs-generator** - CLI tool to generate DBML and Markdown documentation from Drizzle ORM schemas. Extracts JSDoc comments and outputs them as Note clauses.

See [README.md](./README.md) / [README.ja.md](./README.ja.md) for details.

## Package Manager

Use **pnpm** (v10.24.0). Do not use npm/yarn.

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build
pnpm test             # Unit tests (watch mode)
pnpm test:run         # Unit tests (single run)
pnpm test:integration # Integration tests (requires build)
pnpm dev              # Build (watch mode)
pnpm format           # Format (oxfmt)
pnpm lint             # Lint (oxlint)
pnpm typecheck        # Type check
```

## Before Committing

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test:run
```

## Architecture

### src/parser/

- `comments.ts`: Extracts JSDoc comments using TypeScript Compiler API
- `relations.ts`: Extracts relations() definitions
- `index.ts`: Public API

### src/generator/

- `common.ts`: Base class, DBML builder
- `pg.ts`, `mysql.ts`, `sqlite.ts`: DB-specific generators
- `index.ts`: Public API

### src/formatter/

- `markdown.ts`: Markdown format output
- `mermaid.ts`: Mermaid ER diagram generator
- `dbml.ts`: DBML format output
- `dbml-builder.ts`: DBML string builder
- `index.ts`: Public API

### src/cli/

- `index.ts`: CLI implemented with Commander.js

## Dependencies

- `typescript`: AST parsing
- `commander`: CLI framework
- `drizzle-orm`: Drizzle ORM v1 beta

## Type Guidelines

### Boolean vs Union Types

- Use `boolean` **only** when the value will permanently be `true` or `false` with no possibility of additional states
- Prefer **union types** for values that might have more than two states in the future
- Example: Use `"enabled" | "disabled"` instead of `boolean` if a third state like `"pending"` could be added later

## Notes

- License: MIT
- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)
- When using `gh` command, add `--repo rikeda71/drizzle-docs-generator` option
