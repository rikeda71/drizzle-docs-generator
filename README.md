# drizzle-docs-generator

[![npm version](https://badge.fury.io/js/drizzle-docs-generator.svg)](https://www.npmjs.com/package/drizzle-docs-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A CLI tool that generates DBML (Database Markup Language) files from Drizzle ORM schema definitions.

[日本語版READMEはこちら](./README.ja.md)

## Why drizzle-docs-generator?

While Drizzle Kit provides native `drizzle-kit push --dbml` support for DBML generation, it **doesn't include comments** in the output. This tool extends that functionality by:

- **Extracting JSDoc comments** from your schema source files
- **Converting them to DBML Note clauses** for better documentation
- **Supporting relations() definitions** for generating references
- **Providing a watch mode** for automatic regeneration

## Installation

```bash
npm install -g drizzle-docs-generator
```

Or using pnpm:

```bash
pnpm add -g drizzle-docs-generator
```

## Usage

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

### Command Options

```
Usage: drizzle-docs generate [options] <schema>

Generate DBML from Drizzle schema files

Arguments:
  schema                    Path to Drizzle schema file

Options:
  -o, --output <file>       Output file path
  -d, --dialect <dialect>   Database dialect (postgresql, mysql, sqlite) (default: "postgresql")
  -r, --relational          Use relations() definitions instead of foreign keys
  -w, --watch               Watch for file changes and regenerate
  -h, --help                Display help for command
```

## Supported Databases

- **PostgreSQL**
- **MySQL**
- **SQLite**

## Features

- ✅ DBML generation from Drizzle ORM schemas
- ✅ JSDoc comment extraction and conversion to DBML Note clauses
- ✅ Relations() definition support for generating references
- ✅ Watch mode for automatic regeneration
- ✅ Support for all major database dialects (PostgreSQL, MySQL, SQLite)
- ✅ Programmatic API for integration into your build tools

## Writing JSDoc Comments

Add JSDoc comments to your Drizzle schema to include them in the generated DBML:

```typescript
/** Users table */
export const users = pgTable("users", {
  /** User ID */
  id: serial("id").primaryKey(),
  /** User name */
  name: text("name").notNull(),
  /** Email address */
  email: text("email").notNull().unique(),
});

/** Posts table */
export const posts = pgTable("posts", {
  /** Post ID */
  id: serial("id").primaryKey(),
  /** Post title */
  title: text("title").notNull(),
  /** Post content */
  content: text("content"),
  /** Author user ID */
  userId: integer("user_id").references(() => users.id),
});
```

### Generated DBML Output

```dbml
Table users {
  id serial [pk, increment]
  name text [not null]
  email text [not null, unique]

  Note: 'Users table'
}

Table posts {
  id serial [pk, increment]
  title text [not null]
  content text
  user_id integer

  Note: 'Posts table'
}

Ref: posts.user_id > users.id
```

## Programmatic API

You can also use drizzle-docs-generator programmatically in your Node.js projects:

```typescript
import { pgGenerate } from "drizzle-docs-generator";
import * as schema from "./schema";

const dbml = pgGenerate({
  schema,
  source: "./schema.ts", // Source file path for comment extraction
  relational: false, // Use relations() definitions
});

console.log(dbml);
```

### API Functions

#### PostgreSQL

```typescript
import { pgGenerate } from "drizzle-docs-generator";

const dbml = pgGenerate({
  schema: schemaObject,
  source: "./path/to/schema.ts",
  out: "./output.dbml", // Optional: write to file
  relational: false, // Optional: use relations() definitions
});
```

#### MySQL

```typescript
import { mysqlGenerate } from "drizzle-docs-generator";

const dbml = mysqlGenerate({
  schema: schemaObject,
  source: "./path/to/schema.ts",
  out: "./output.dbml",
  relational: false,
});
```

#### SQLite

```typescript
import { sqliteGenerate } from "drizzle-docs-generator";

const dbml = sqliteGenerate({
  schema: schemaObject,
  source: "./path/to/schema.ts",
  out: "./output.dbml",
  relational: false,
});
```

### Extract Comments Only

If you only need to extract comments from source files:

```typescript
import { extractComments } from "drizzle-docs-generator";

const comments = extractComments("./path/to/schema.ts");

console.log(comments);
// {
//   tables: {
//     users: { comment: 'Users table', columns: { id: 'User ID', ... } },
//     ...
//   }
// }
```

## API Types

```typescript
interface GenerateOptions {
  schema: Record<string, unknown>; // Drizzle schema module
  source?: string; // Source file path for comment extraction
  out?: string; // Output file path (optional)
  relational?: boolean; // Use relations() definitions
}

interface SchemaComments {
  tables: Record<string, TableComment>;
}

interface TableComment {
  comment?: string;
  columns: Record<string, string>;
}
```

## Requirements

- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [npm package](https://www.npmjs.com/package/drizzle-docs-generator)
- [GitHub repository](https://github.com/rikeda71/drizzle-docs-generator)
- [Issue tracker](https://github.com/rikeda71/drizzle-docs-generator/issues)
