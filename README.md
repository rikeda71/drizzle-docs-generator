# drizzle-docs-generator

[![npm version](https://badge.fury.io/js/drizzle-docs-generator.svg)](https://www.npmjs.com/package/drizzle-docs-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

CLI tool to generate DBML from Drizzle ORM schemas. Extracts JSDoc comments and outputs them as Note clauses.

[日本語版READMEはこちら](./README.ja.md)

## Install

```bash
npm install -g drizzle-docs-generator
# or
pnpm add -g drizzle-docs-generator
```

## Usage

```bash
# Basic
drizzle-docs generate ./src/db/schema.ts -d postgresql

# Output to file
drizzle-docs generate ./src/db/schema.ts -d postgresql -o schema.dbml

# Use relations() definitions
drizzle-docs generate ./src/db/schema.ts -d postgresql -r

# Watch mode
drizzle-docs generate ./src/db/schema.ts -d postgresql -w
```

### Options

| Option                    | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `-o, --output <file>`     | Output file path                                    |
| `-d, --dialect <dialect>` | Database: `postgresql` (default), `mysql`, `sqlite` |
| `-r, --relational`        | Generate refs from relations() definitions          |
| `-w, --watch`             | Regenerate on file changes                          |

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

↓

```dbml
Table users {
  id serial [pk, increment, note: 'User ID']
  name text [not null, note: 'User name']

  Note: 'Users table'
}
```

## API

```typescript
import { pgGenerate } from "drizzle-docs-generator";
import * as schema from "./schema";

const dbml = pgGenerate({
  schema,
  source: "./schema.ts",
  relational: false,
  out: "./output.dbml", // optional
});
```

`mysqlGenerate`, `sqliteGenerate` are also available.

## Requirements

- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)

## License

MIT
