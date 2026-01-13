# drizzle-docs-generator

[![npm version](https://badge.fury.io/js/drizzle-docs-generator.svg)](https://www.npmjs.com/package/drizzle-docs-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

CLI tool to generate DBML and Markdown documentation from Drizzle ORM schemas. Extracts JSDoc comments and outputs them as Note clauses.

**Features:**

- **Directory Import Support**: Import all schema files from a directory
- **No File Extension Required**: Works with extensionless imports (e.g., `import { users } from './users'`)
- **JSDoc Comments**: Automatically extracts and converts to DBML Notes
- **Relations Support**: Generate refs from `relations()` or `defineRelations()`
- **Watch Mode**: Auto-regenerate on file changes
- **Multiple Output Formats**: DBML (default) and Markdown with ER diagrams

[日本語版READMEはこちら](./README.ja.md)

## Install

### Global Install (recommended for CLI usage)

```bash
npm install -g drizzle-docs-generator
# or
pnpm add -g drizzle-docs-generator
```

### Local Install or npx (one-off usage)

```bash
# Local install in your project
npm install drizzle-docs-generator
# or
pnpm add drizzle-docs-generator

# Run directly without installing
npx drizzle-docs-generator generate ./src/db/schema.ts -d postgresql
```

## Usage

### DBML Output (Default)

```bash
# Basic - single file
drizzle-docs generate ./src/db/schema.ts -d postgresql

# Directory - import all schema files from directory
drizzle-docs generate ./src/db/schema/ -d postgresql

# Output to file
drizzle-docs generate ./src/db/schema.ts -d postgresql -o schema.dbml

# Watch mode
drizzle-docs generate ./src/db/schema.ts -d postgresql -w
```

### Markdown Output

```bash
# Markdown output (multiple files with ER diagram)
drizzle-docs generate ./src/db/schema.ts -d postgresql -f markdown -o ./docs

# Markdown output (single file)
drizzle-docs generate ./src/db/schema.ts -d postgresql -f markdown --single-file -o schema.md

# Markdown without ER diagram
drizzle-docs generate ./src/db/schema.ts -d postgresql -f markdown --no-er-diagram -o ./docs
```

### Options

| Option                    | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `-o, --output <path>`     | Output file or directory path                       |
| `-d, --dialect <dialect>` | Database: `postgresql` (default), `mysql`, `sqlite` |
| `-f, --format <format>`   | Output format: `dbml` (default), `markdown`         |
| `-w, --watch`             | Regenerate on file changes                          |
| `--single-file`           | Output Markdown as a single file (markdown only)    |
| `--no-er-diagram`         | Exclude ER diagram from Markdown output             |
| `--force`                 | Overwrite existing files without confirmation       |

### Relation Detection

Relations are **automatically detected** from your schema:

- **v1 API** (`defineRelations()`): Detected from schema objects at runtime
- **v0 API** (`relations()`): Detected by parsing source files

No configuration needed - the tool will use relation definitions when present, or fall back to foreign key constraints.

## Example

```typescript
/** Users table */
export const users = pgTable("users", {
  /** User ID */
  id: serial("id").primaryKey(),
  /** User name */
  name: text("name").notNull(),
});
```

### DBML Output

```dbml
Table users {
  id serial [pk, increment, note: 'User ID']
  name text [not null, note: 'User name']

  Note: 'Users table'
}
```

### Markdown Output

```markdown
# users

Users table

## Columns

| Name | Type   | Nullable | Default | Comment   |
| ---- | ------ | -------- | ------- | --------- |
| id   | serial | No       |         | User ID   |
| name | text   | No       |         | User name |
```

See [examples/](./examples/) for more detailed output samples.

## API

```typescript
import { pgGenerate } from "drizzle-docs-generator";
import * as schema from "./schema";

const dbml = pgGenerate({
  schema,
  source: "./schema.ts", // for JSDoc comments and v0 relations() detection
  out: "./output.dbml", // optional
});
```

`mysqlGenerate`, `sqliteGenerate` are also available.

## Requirements

- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)
- ES Modules (ESM): Your project must use ESM (`"type": "module"` in package.json)

## How It Works

This tool uses [tsx](https://github.com/privatenumber/tsx) to load your schema files, which means:

✅ **Extensionless imports work**: `import { users } from './users'`
✅ **TypeScript files are loaded directly**: No need to compile first
✅ **Directory imports**: Load all schema files from a directory automatically

Your schema files can use standard TypeScript module resolution without worrying about file extensions.

## License

MIT
