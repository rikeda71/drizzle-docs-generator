# CLAUDE.md

Claude Code 向けの開発ガイド。

## 概要

**drizzle-docs-generator** - Drizzle ORM スキーマから DBML を生成する CLI。JSDoc コメントを Note 句として出力できる。

詳細は [README.md](./README.md) / [README.ja.md](./README.ja.md) を参照。

## パッケージマネージャ

**pnpm** を使用（v10.24.0）。npm/yarn は使わないこと。

## コマンド

```bash
pnpm install          # 依存関係インストール
pnpm build            # ビルド
pnpm test             # ユニットテスト (watch mode)
pnpm test:run         # ユニットテスト (1回)
pnpm test:integration # 統合テスト (要ビルド)
pnpm dev              # ビルド (watch mode)
pnpm format           # フォーマット (oxfmt)
pnpm lint             # リント (oxlint)
pnpm typecheck        # 型チェック
```

## コミット前に必ず実行

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test:run
```

## アーキテクチャ

### src/parser/

- `comments.ts`: TypeScript Compiler API で JSDoc コメントを抽出
- `relations.ts`: relations() 定義を抽出
- `index.ts`: 公開 API

### src/generator/

- `common.ts`: 基底クラス、DBML ビルダー
- `pg.ts`, `mysql.ts`, `sqlite.ts`: 各 DB 用ジェネレータ
- `index.ts`: 公開 API

### src/cli/

- `index.ts`: Commander.js で実装した CLI

## 依存関係

- `typescript`: AST パース
- `commander`: CLI フレームワーク
- `drizzle-orm`: Drizzle ORM v1 beta

## メモ

- ライセンス: MIT
- Node.js >= 24
- Drizzle ORM v1 beta (1.0.0-beta.10+)
- `gh` コマンド使用時は `--repo rikeda71/drizzle-docs-generator` オプションを付けること
