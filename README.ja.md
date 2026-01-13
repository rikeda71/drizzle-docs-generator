# drizzle-docs-generator

[![NPM](https://nodei.co/npm/drizzle-docs-generator.svg?style=shields&data=v,d&color=brightgreen)](https://nodei.co/npm/drizzle-docs-generator/)

Drizzle ORM スキーマから DBML と Markdown ドキュメントを生成する CLI。JSDoc コメントを Note 句として出力できる。

**機能:**

- **ディレクトリインポート対応**: ディレクトリ内のすべてのスキーマファイルを自動インポート
- **拡張子不要**: 拡張子なしのインポートに対応 (例: `import { users } from './users'`)
- **JSDoc コメント**: 自動的に DBML の Note 句に変換
- **リレーション対応**: `relations()` または `defineRelations()` から参照を生成
- **Watch モード**: ファイル変更時に自動再生成
- **複数の出力形式**: Markdown (デフォルト) および ER 図付き DBML

[English README](./README.md)

## インストール

### ローカルインストール（推奨）

```bash
# 開発依存関係としてインストール
npm install --save-dev drizzle-docs-generator
# or
pnpm add -D drizzle-docs-generator

# npx で実行
npx drizzle-docs generate ./src/db/schema.ts -d postgresql
```

### グローバルインストール

```bash
npm install -g drizzle-docs-generator
# or
pnpm add -g drizzle-docs-generator

drizzle-docs generate ./src/db/schema.ts -d postgresql
```

## 使い方

### Markdown 出力 (デフォルト)

```bash
# Markdown 出力 (ER 図付き複数ファイル)
drizzle-docs generate ./src/db/schema.ts -d postgresql -o ./docs

# Markdown 出力 (単一ファイル)
drizzle-docs generate ./src/db/schema.ts -d postgresql --single-file -o schema.md

# ER 図なしの Markdown
drizzle-docs generate ./src/db/schema.ts -d postgresql --no-er-diagram -o ./docs
```

### DBML 出力

```bash
# 基本 - 単一ファイル
drizzle-docs generate ./src/db/schema.ts -d postgresql -f dbml

# ディレクトリ - ディレクトリ内のすべてのスキーマファイルをインポート
drizzle-docs generate ./src/db/schema/ -d postgresql -f dbml

# ファイル出力
drizzle-docs generate ./src/db/schema.ts -d postgresql -f dbml -o schema.dbml

# watch モード
drizzle-docs generate ./src/db/schema.ts -d postgresql -f dbml -w
```

### オプション

| オプション                | 説明                                                  |
| ------------------------- | ----------------------------------------------------- |
| `-o, --output <path>`     | 出力ファイルまたはディレクトリパス                    |
| `-d, --dialect <dialect>` | DB 種別: `postgresql` (デフォルト), `mysql`, `sqlite` |
| `-f, --format <format>`   | 出力形式: `markdown` (デフォルト), `dbml`             |
| `-w, --watch`             | ファイル変更時に自動再生成                            |
| `--single-file`           | Markdown を単一ファイルで出力 (markdown のみ)         |
| `--no-er-diagram`         | ER 図を Markdown 出力から除外                         |
| `--force`                 | 確認なしで既存ファイルを上書き                        |

### リレーション検出

リレーションはスキーマから**自動検出**されます：

- **v1 API** (`defineRelations()`): スキーマオブジェクトから実行時に検出
- **v0 API** (`relations()`): ソースファイルを解析して検出

設定不要 - リレーション定義があれば使用し、なければ外部キー制約にフォールバックします。

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

### DBML 出力

```dbml
Table users {
  id serial [pk, increment, note: 'ユーザーID']
  name text [not null, note: 'ユーザー名']

  Note: 'ユーザーテーブル'
}
```

### Markdown 出力

```markdown
# users

ユーザーテーブル

## Columns

| Name | Type   | Nullable | Default | Comment    |
| ---- | ------ | -------- | ------- | ---------- |
| id   | serial | No       |         | ユーザーID |
| name | text   | No       |         | ユーザー名 |
```

詳細なサンプル出力は [examples/](./examples/) を参照してください。

## License

MIT
