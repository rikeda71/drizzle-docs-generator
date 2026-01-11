# drizzle-docs-generator

[![npm version](https://badge.fury.io/js/drizzle-docs-generator.svg)](https://www.npmjs.com/package/drizzle-docs-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Drizzle ORM スキーマから DBML を生成する CLI。JSDoc コメントを Note 句として出力できる。

**✨ 機能:**

- 📁 **ディレクトリインポート対応**: ディレクトリ内のすべてのスキーマファイルを自動インポート
- 🔄 **拡張子不要**: 拡張子なしのインポートに対応 (例: `import { users } from './users'`)
- 📝 **JSDoc コメント**: 自動的に DBML の Note 句に変換
- 🔗 **リレーション対応**: `relations()` または `defineRelations()` から参照を生成
- 👀 **Watch モード**: ファイル変更時に自動再生成

[English README](./README.md)

## インストール

```bash
npm install -g drizzle-docs-generator
# or
pnpm add -g drizzle-docs-generator
```

## 使い方

```bash
# 基本 - 単一ファイル
drizzle-docs generate ./src/db/schema.ts -d postgresql

# ディレクトリ - ディレクトリ内のすべてのスキーマファイルをインポート
drizzle-docs generate ./src/db/schema/ -d postgresql

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
  id serial [pk, increment, note: 'ユーザーID']
  name text [not null, note: 'ユーザー名']

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
- ES Modules (ESM): プロジェクトで ESM を使用していること (`package.json` に `"type": "module"`)

## 仕組み

このツールは [tsx](https://github.com/privatenumber/tsx) を使用してスキーマファイルを読み込むため:

✅ **拡張子なしのインポートが動作**: `import { users } from './users'`
✅ **TypeScript ファイルを直接読み込み**: コンパイル不要
✅ **ディレクトリインポート**: ディレクトリ内のすべてのスキーマファイルを自動読み込み

スキーマファイルでは、ファイル拡張子を気にせず標準的な TypeScript のモジュール解決を使用できます。

## License

MIT
