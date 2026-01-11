# drizzle-docs-generator

[![npm version](https://badge.fury.io/js/drizzle-docs-generator.svg)](https://www.npmjs.com/package/drizzle-docs-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Drizzle ORM のスキーマ定義から DBML (Database Markup Language) ファイルを生成する CLI ツール。

[English README is here](./README.md)

## なぜ drizzle-docs-generator なのか?

Drizzle Kit は `drizzle-kit push --dbml` による DBML 生成をネイティブサポートしていますが、**コメントが出力に含まれません**。このツールは以下の機能を追加することで、その機能を拡張します:

- **スキーマソースファイルから JSDoc コメントを抽出**
- **DBML の Note 句に変換** してドキュメントを充実化
- **relations() 定義のサポート** によるリファレンス生成
- **ウォッチモード** による自動再生成

## インストール

```bash
npm install -g drizzle-docs-generator
```

または pnpm を使用:

```bash
pnpm add -g drizzle-docs-generator
```

## 使用方法

### 基本的な使い方

```bash
# PostgreSQL スキーマの DBML を生成
drizzle-docs generate ./src/db/schema.ts -d postgresql

# ファイルに出力
drizzle-docs generate ./src/db/schema.ts -d postgresql -o schema.dbml

# relations() 定義を使用してリファレンスを生成
drizzle-docs generate ./src/db/schema.ts -d postgresql -r

# ウォッチモード (ファイル変更時に自動再生成)
drizzle-docs generate ./src/db/schema.ts -d postgresql -w
```

### コマンドオプション

```
Usage: drizzle-docs generate [options] <schema>

Drizzle スキーマファイルから DBML を生成

引数:
  schema                    Drizzle スキーマファイルのパス

オプション:
  -o, --output <file>       出力ファイルパス
  -d, --dialect <dialect>   データベースダイアレクト (postgresql, mysql, sqlite) (デフォルト: "postgresql")
  -r, --relational          外部キーの代わりに relations() 定義を使用
  -w, --watch               ファイル変更を監視して自動再生成
  -h, --help                コマンドのヘルプを表示
```

## サポートしているデータベース

- **PostgreSQL**
- **MySQL**
- **SQLite**

## 機能一覧

- ✅ Drizzle ORM スキーマから DBML を生成
- ✅ JSDoc コメントを抽出して DBML Note 句に変換
- ✅ relations() 定義をサポートしてリファレンスを生成
- ✅ ウォッチモードによる自動再生成
- ✅ 主要なデータベースダイアレクトをすべてサポート (PostgreSQL, MySQL, SQLite)
- ✅ ビルドツールに統合できるプログラマティック API

## JSDoc コメントの書き方

Drizzle スキーマに JSDoc コメントを追加すると、生成される DBML に含まれます:

```typescript
/** ユーザーテーブル */
export const users = pgTable("users", {
  /** ユーザーID */
  id: serial("id").primaryKey(),
  /** ユーザー名 */
  name: text("name").notNull(),
  /** メールアドレス */
  email: text("email").notNull().unique(),
});

/** 投稿テーブル */
export const posts = pgTable("posts", {
  /** 投稿ID */
  id: serial("id").primaryKey(),
  /** 投稿タイトル */
  title: text("title").notNull(),
  /** 投稿内容 */
  content: text("content"),
  /** 著者のユーザーID */
  userId: integer("user_id").references(() => users.id),
});
```

### 生成される DBML の例

```dbml
Table users {
  id serial [pk, increment]
  name text [not null]
  email text [not null, unique]

  Note: 'ユーザーテーブル'
}

Table posts {
  id serial [pk, increment]
  title text [not null]
  content text
  user_id integer

  Note: '投稿テーブル'
}

Ref: posts.user_id > users.id
```

## プログラマティック API

Node.js プロジェクトで drizzle-docs-generator をプログラムから使用することもできます:

```typescript
import { pgGenerate } from "drizzle-docs-generator";
import * as schema from "./schema";

const dbml = pgGenerate({
  schema,
  source: "./schema.ts", // コメント抽出用のソースファイルパス
  relational: false, // relations() 定義を使用
});

console.log(dbml);
```

### API 関数

#### PostgreSQL

```typescript
import { pgGenerate } from "drizzle-docs-generator";

const dbml = pgGenerate({
  schema: schemaObject,
  source: "./path/to/schema.ts",
  out: "./output.dbml", // オプション: ファイルに書き込み
  relational: false, // オプション: relations() 定義を使用
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

### コメントのみを抽出

ソースファイルからコメントのみを抽出する場合:

```typescript
import { extractComments } from "drizzle-docs-generator";

const comments = extractComments("./path/to/schema.ts");

console.log(comments);
// {
//   tables: {
//     users: { comment: 'ユーザーテーブル', columns: { id: 'ユーザーID', ... } },
//     ...
//   }
// }
```

## API の型定義

```typescript
interface GenerateOptions {
  schema: Record<string, unknown>; // Drizzle スキーマモジュール
  source?: string; // コメント抽出用のソースファイルパス
  out?: string; // 出力ファイルパス (オプション)
  relational?: boolean; // relations() 定義を使用
}

interface SchemaComments {
  tables: Record<string, TableComment>;
}

interface TableComment {
  comment?: string;
  columns: Record<string, string>;
}
```

## 動作環境

- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)

## ライセンス

ISC

## コントリビューション

コントリビューションを歓迎します! お気軽に Pull Request を送信してください。

## リンク

- [npm パッケージ](https://www.npmjs.com/package/drizzle-docs-generator)
- [GitHub リポジトリ](https://github.com/rikeda71/drizzle-docs-generator)
- [Issue トラッカー](https://github.com/rikeda71/drizzle-docs-generator/issues)
