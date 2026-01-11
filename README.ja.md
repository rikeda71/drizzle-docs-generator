# drizzle-docs-generator

[![npm version](https://badge.fury.io/js/drizzle-docs-generator.svg)](https://www.npmjs.com/package/drizzle-docs-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Drizzle ORM スキーマから DBML を生成する CLI。JSDoc コメントを Note 句として出力できる。

[English README](./README.md)

## インストール

```bash
npm install -g drizzle-docs-generator
# or
pnpm add -g drizzle-docs-generator
```

## 使い方

```bash
# 基本
drizzle-docs generate ./src/db/schema.ts -d postgresql

# ファイル出力
drizzle-docs generate ./src/db/schema.ts -d postgresql -o schema.dbml

# relations() を使う
drizzle-docs generate ./src/db/schema.ts -d postgresql -r

# watch モード
drizzle-docs generate ./src/db/schema.ts -d postgresql -w
```

### オプション

| オプション                | 説明                                               |
| ------------------------- | -------------------------------------------------- |
| `-o, --output <file>`     | 出力ファイルパス                                   |
| `-d, --dialect <dialect>` | DB 種別: `postgresql` (default), `mysql`, `sqlite` |
| `-r, --relational`        | relations() 定義からリファレンスを生成             |
| `-w, --watch`             | ファイル変更時に自動再生成                         |

## 例

```typescript
/** ユーザーテーブル */
export const users = pgTable("users", {
  /** ユーザーID */
  id: serial("id").primaryKey(),
  /** ユーザー名 */
  name: text("name").notNull(),
});
```

↓

```dbml
Table users {
  id serial [pk, increment]
  name text [not null]

  Note: 'ユーザーテーブル'
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

`mysqlGenerate`, `sqliteGenerate` も同様。

## 動作環境

- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)

## License

MIT
