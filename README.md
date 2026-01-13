# drizzle-docs-generator

[![NPM](https://nodei.co/npm/drizzle-docs-generator.svg?style=shields&data=v,d&color=brightgreen)](https://nodei.co/npm/drizzle-docs-generator/)

CLI tool to generate DBML and Markdown documentation from Drizzle ORM schemas. Extracts JSDoc comments and outputs them as Note clauses.

**Features:**

- **Directory Import Support**: Import all schema files from a directory
- **No File Extension Required**: Works with extensionless imports (e.g., `import { users } from './users'`)
- **JSDoc Comments**: Automatically extracts and converts to DBML Notes
- **Relations Support**: Generate refs from `relations()` or `defineRelations()`
- **Watch Mode**: Auto-regenerate on file changes
- **Multiple Output Formats**: Markdown (default) and DBML with ER diagrams

[日本語版READMEはこちら](./README.ja.md)

## Install

### Local Install (recommended)

```bash
# As a dev dependency
npm install --save-dev drizzle-docs-generator
# or
pnpm add -D drizzle-docs-generator

# Then use with npx
npx drizzle-docs generate ./src/db/schema.ts -d postgresql
```

### Global Install

```bash
npm install -g drizzle-docs-generator
# or
pnpm add -g drizzle-docs-generator

drizzle-docs generate ./src/db/schema.ts -d postgresql
```

## Usage

### Basic Usage

```bash
# Markdown output (default)
drizzle-docs generate ./src/db/schema.ts -d postgresql -o ./docs

# DBML output
drizzle-docs generate ./src/db/schema.ts -d postgresql -f dbml -o schema.dbml
```

### Output Format Options

#### Markdown Format (Default)

The default output format is **Markdown**, which generates multiple files with an ER diagram.

**Options specific to Markdown format:**

| Option              | Description                                    |
| ------------------- | ---------------------------------------------- |
| `--single-file`     | Output as a single file instead of multiple    |
| `--no-er-diagram`   | Exclude ER diagram from output                 |

**Examples:**

```bash
# Multiple files with ER diagram (default)
drizzle-docs generate ./src/db/schema.ts -d postgresql -o ./docs

# Single file Markdown
drizzle-docs generate ./src/db/schema.ts -d postgresql --single-file -o schema.md

# Multiple files without ER diagram
drizzle-docs generate ./src/db/schema.ts -d postgresql --no-er-diagram -o ./docs
```

#### DBML Format

Use the `-f dbml` or `--format dbml` option to generate DBML format.

**Examples:**

```bash
# Output to file
drizzle-docs generate ./src/db/schema.ts -d postgresql -f dbml -o schema.dbml

# Directory - import all schema files from directory
drizzle-docs generate ./src/db/schema/ -d postgresql -f dbml -o schema.dbml

# Watch mode
drizzle-docs generate ./src/db/schema.ts -d postgresql -f dbml -w
```

#### Common Options

| Option                    | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `-o, --output <path>`     | Output file or directory path                       |
| `-d, --dialect <dialect>` | Database: `postgresql` (default), `mysql`, `sqlite` |
| `-f, --format <format>`   | Output format: `markdown` (default), `dbml`         |
| `-w, --watch`             | Regenerate on file changes                          |
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

## License

MIT
