# Design Doc: Markdown Documentation Mode (tbls-like format)

**Author:** Claude
**Created:** 2026-01-12
**Status:** Proposal

---

## 1. 概要 (Summary)

`drizzle-docs-generator` に tbls のようなMarkdown形式でデータベースドキュメントを生成するモードを追加する。現在のDBML出力に加え、人間が読みやすいMarkdown形式のドキュメント（ER図はMermaid形式）を生成できるようにする。

---

## 2. 背景と目的 (Background & Goals)

### 2.1 背景

現在の `drizzle-docs-generator` は DBML 形式のみを出力する。DBML は [dbdiagram.io](https://dbdiagram.io) などのツールで ER 図を可視化するのに適しているが、以下の課題がある：

- **可読性**: DBML は専用ツールなしでは読みにくい
- **ドキュメント統合**: プロジェクトの README や Wiki に直接埋め込みにくい
- **CI/CD 連携**: GitHub Pages や MkDocs などで直接ホスティングできない

[tbls](https://github.com/k1LoW/tbls) は、データベースから直接 Markdown ドキュメントを生成する人気ツールだが、Drizzle ORM のスキーマ定義（TypeScript）からは生成できない。

### 2.2 目的

- **Goal 1**: Drizzle スキーマから tbls 互換の Markdown ドキュメントを生成
- **Goal 2**: ER 図を Mermaid 形式で埋め込み、GitHub での直接レンダリングを可能に
- **Goal 3**: 既存のアーキテクチャを活かし、最小限の変更で実装

### 2.3 非目的 (Non-Goals)

- データベース接続からの直接生成（tbls の領域）
- HTML/PDF 形式での出力
- tbls の全機能（Viewpoints, Linting など）の再現

---

## 3. 設計方針の比較 (Design Alternatives)

### 方針 A: OutputFormatter 抽象化（推奨）

既存の `BaseGenerator` の出力部分を抽象化し、`OutputFormatter` インターフェースを導入する。

```
                    ┌─────────────────────┐
                    │   BaseGenerator     │
                    │   (既存ロジック)     │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  IntermediateSchema │
                    │  (中間表現)          │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │  DbmlFormatter  │ │ MarkdownFormatter│ │ (Future: JSON)  │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

**実装イメージ:**

```typescript
// src/formatter/types.ts
interface IntermediateSchema {
  tables: TableDef[];
  relations: RelationDef[];
  enums?: EnumDef[];
}

interface OutputFormatter {
  format(schema: IntermediateSchema): string | FileOutput[];
}

// src/formatter/markdown.ts
class MarkdownFormatter implements OutputFormatter {
  format(schema: IntermediateSchema): FileOutput[] {
    return [
      { path: 'README.md', content: this.generateIndex(schema) },
      ...schema.tables.map(t => ({
        path: `${t.name}.md`,
        content: this.generateTableDoc(t)
      }))
    ];
  }
}
```

| メリット | デメリット |
|---------|-----------|
| 既存コードへの影響が最小 | 中間表現の設計が必要 |
| 新しい出力形式の追加が容易 | 一時的にコード量が増加 |
| テストが書きやすい | Generator と Formatter の責務分離が必要 |
| 関心の分離が明確 | |

---

### 方針 B: 新しい Generator サブクラス

DB 方言ごとの Generator（`PgGenerator`, `MySqlGenerator`）と同様に、出力形式ごとの Generator を作成する。

```
    ┌─────────────────┐
    │  BaseGenerator  │
    └────────┬────────┘
             │
    ┌────────┼────────┬────────────────┐
    ▼        ▼        ▼                ▼
┌────────┐┌────────┐┌────────┐   ┌──────────────┐
│   Pg   ││ MySql  ││ SQLite │   │MarkdownPg   │
│Generator││Generator││Generator│   │Generator    │
└────────┘└────────┘└────────┘   └──────────────┘
                                  ┌──────────────┐
                                  │MarkdownMySql│
                                  │Generator    │
                                  └──────────────┘
```

| メリット | デメリット |
|---------|-----------|
| 既存パターンとの一貫性 | クラス数が爆発（3 DB × 2 形式 = 6 クラス） |
| 理解しやすい | コードの重複が発生 |
| | DB 追加時に Markdown 版も作成が必要 |
| | 保守コストが高い |

---

### 方針 C: Builder パターンの拡張

`DbmlBuilder` を抽象化し、`MarkdownBuilder` を追加する。

```typescript
interface DocumentBuilder {
  line(content: string): this;
  table(name: string, columns: Column[]): this;
  build(): string;
}

class DbmlBuilder implements DocumentBuilder { ... }
class MarkdownBuilder implements DocumentBuilder { ... }
```

| メリット | デメリット |
|---------|-----------|
| 変更箇所が限定的 | DBML と Markdown の構造が異なりすぎる |
| | 無理な抽象化になりがち |
| | 複数ファイル出力に対応しにくい |

---

## 4. 推奨方針 (Recommended Approach)

**方針 A: OutputFormatter 抽象化** を推奨する。

### 理由

1. **拡張性**: 将来的に JSON Schema, OpenAPI, PlantUML などの形式追加が容易
2. **保守性**: DB 方言と出力形式が直交するため、組み合わせ爆発を防げる
3. **テスト容易性**: 中間表現をテストすれば、各 Formatter を独立してテスト可能
4. **関心の分離**: スキーマ解析（Generator）と出力生成（Formatter）の責務が明確

---

## 5. 詳細設計 (Detailed Design)

### 5.1 中間表現 (IntermediateSchema)

```typescript
// src/types.ts に追加

interface TableDefinition {
  name: string;
  schema?: string;
  comment?: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  primaryKey: boolean;
  unique: boolean;
  comment?: string;
}

interface RelationDefinition {
  name?: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  onDelete?: string;
  onUpdate?: string;
}

interface EnumDefinition {
  name: string;
  values: string[];
}

interface IntermediateSchema {
  databaseType: 'postgresql' | 'mysql' | 'sqlite';
  tables: TableDefinition[];
  relations: RelationDefinition[];
  enums: EnumDefinition[];
}
```

### 5.2 Formatter インターフェース

```typescript
// src/formatter/types.ts

interface FileOutput {
  path: string;
  content: string;
}

interface FormatterOptions {
  /** 出力ディレクトリ */
  outDir?: string;
  /** ER図を含めるか */
  includeErDiagram?: boolean;
  /** Mermaid形式（デフォルト）かSVGか */
  erFormat?: 'mermaid' | 'svg';
}

interface OutputFormatter {
  /** 単一ファイル出力 */
  format(schema: IntermediateSchema): string;
  /** 複数ファイル出力（Markdown用） */
  formatMultiple?(schema: IntermediateSchema): FileOutput[];
}
```

### 5.3 MarkdownFormatter 実装

```typescript
// src/formatter/markdown.ts

export class MarkdownFormatter implements OutputFormatter {
  constructor(private options: FormatterOptions = {}) {}

  formatMultiple(schema: IntermediateSchema): FileOutput[] {
    const files: FileOutput[] = [];

    // 1. インデックスファイル（README.md）
    files.push({
      path: 'README.md',
      content: this.generateIndex(schema)
    });

    // 2. 各テーブルのドキュメント
    for (const table of schema.tables) {
      files.push({
        path: `${table.name}.md`,
        content: this.generateTableDoc(table, schema)
      });
    }

    return files;
  }

  format(schema: IntermediateSchema): string {
    // 単一ファイル出力（全テーブルを1ファイルに）
    return this.generateIndex(schema, { includeTables: true });
  }

  private generateIndex(schema: IntermediateSchema): string {
    // README.md の生成
  }

  private generateTableDoc(table: TableDefinition, schema: IntermediateSchema): string {
    // 各テーブルドキュメントの生成
  }

  private generateMermaidErDiagram(schema: IntermediateSchema): string {
    // Mermaid ER図の生成
  }
}
```

### 5.4 出力例

#### README.md

```markdown
# Database Schema

## Tables

| Name | Columns | Comment | Type |
|------|---------|---------|------|
| [users](users.md) | 5 | ユーザーテーブル | TABLE |
| [posts](posts.md) | 6 | 投稿テーブル | TABLE |
| [comments](comments.md) | 5 | コメントテーブル | TABLE |

## ER Diagram

\`\`\`mermaid
erDiagram
    users ||--o{ posts : "has many"
    users ||--o{ comments : "has many"
    posts ||--o{ comments : "has many"

    users {
        int id PK
        varchar username
        varchar email
        timestamp created_at
    }

    posts {
        int id PK
        int user_id FK
        varchar title
        text content
        timestamp created_at
    }
\`\`\`

---

> Generated by [drizzle-docs-generator](https://github.com/rikeda71/drizzle-docs-generator)
```

#### users.md

```markdown
# users

ユーザーテーブル

## Columns

| Name | Type | Nullable | Default | Comment |
|------|------|----------|---------|---------|
| id | serial | NO | | ユーザーID |
| username | varchar(255) | NO | | ユーザー名 |
| email | varchar(255) | NO | | メールアドレス |
| created_at | timestamp | NO | now() | 作成日時 |
| updated_at | timestamp | YES | | 更新日時 |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| users_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| users_email_unique | UNIQUE | UNIQUE (email) |

## Indexes

| Name | Definition |
|------|------------|
| users_email_idx | CREATE INDEX users_email_idx ON users (email) |

## Relations

### Referenced by

| Table | Column | Relation |
|-------|--------|----------|
| [posts](posts.md) | user_id | Many-to-One |
| [comments](comments.md) | user_id | Many-to-One |

## ER Diagram

\`\`\`mermaid
erDiagram
    users ||--o{ posts : "user_id"
    users ||--o{ comments : "user_id"

    users {
        int id PK
        varchar username
        varchar email
        timestamp created_at
        timestamp updated_at
    }
\`\`\`

---

[< Back to index](README.md)

> Generated by [drizzle-docs-generator](https://github.com/rikeda71/drizzle-docs-generator)
```

### 5.5 CLI インターフェース

```bash
# DBML形式（既存、デフォルト）
drizzle-docs generate ./schema.ts -o schema.dbml

# Markdown形式（新規）
drizzle-docs generate ./schema.ts --format markdown -o ./docs

# Markdown形式（単一ファイル）
drizzle-docs generate ./schema.ts --format markdown --single-file -o schema.md

# ER図なし
drizzle-docs generate ./schema.ts --format markdown --no-er-diagram -o ./docs
```

**新しいCLIオプション:**

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--format, -f` | 出力形式 (`dbml` \| `markdown`) | `dbml` |
| `--single-file` | Markdown を単一ファイルに出力 | `false` |
| `--no-er-diagram` | ER図を含めない | `false` |

### 5.6 ディレクトリ構造の変更

```
src/
├── types.ts              # IntermediateSchema を追加
├── parser/               # 変更なし
├── generator/
│   ├── common.ts         # toIntermediateSchema() メソッドを追加
│   ├── pg.ts             # 変更なし
│   ├── mysql.ts          # 変更なし
│   ├── sqlite.ts         # 変更なし
│   └── index.ts          # 変更なし
├── formatter/            # 新規ディレクトリ
│   ├── types.ts          # OutputFormatter インターフェース
│   ├── dbml.ts           # DbmlFormatter（既存 DbmlBuilder をラップ）
│   ├── markdown.ts       # MarkdownFormatter（新規）
│   ├── mermaid.ts        # MermaidErDiagramGenerator（新規）
│   └── index.ts          # 公開 API
└── cli/
    └── index.ts          # --format オプションを追加
```

---

## 6. 実装計画 (Implementation Plan)

### Phase 1: 基盤整備

1. `IntermediateSchema` 型を定義
2. `BaseGenerator.toIntermediateSchema()` メソッドを実装
3. 既存の `DbmlBuilder` を `DbmlFormatter` にラップ

### Phase 2: Markdown Formatter 実装

4. `MarkdownFormatter` を実装
5. `MermaidErDiagramGenerator` を実装
6. 単体テストを追加

### Phase 3: CLI 統合

7. CLI に `--format` オプションを追加
8. 複数ファイル出力のサポート
9. 統合テストを追加

### Phase 4: ドキュメント・リリース

10. README にMarkdown形式の説明を追加
11. サンプル出力を追加
12. リリース

---

## 7. テスト計画 (Testing Plan)

### 7.1 単体テスト

- `IntermediateSchema` への変換テスト
- `MarkdownFormatter` の各メソッドテスト
- `MermaidErDiagramGenerator` のテスト

### 7.2 統合テスト

- PostgreSQL/MySQL/SQLite スキーマからの Markdown 生成
- 複数ファイル出力の検証
- Watch モードでの動作確認

### 7.3 スナップショットテスト

- 期待される Markdown 出力のスナップショット比較

---

## 8. 今後の展望 (Future Work)

- **カスタムテンプレート**: tbls のようなテンプレートカスタマイズ機能
- **JSON Schema 出力**: API ドキュメント生成との連携
- **PlantUML 形式**: Mermaid 以外の図形式サポート
- **差分検出**: 前回生成からの変更点ハイライト

---

## 9. 参考資料 (References)

- [tbls - GitHub](https://github.com/k1LoW/tbls)
- [Mermaid ER Diagram Syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)
- [DBML Specification](https://dbml.dbdiagram.io/docs/)

---

## Appendix: 方針比較サマリ

| 観点 | 方針 A (Formatter) | 方針 B (Generator) | 方針 C (Builder) |
|------|-------------------|-------------------|-----------------|
| 拡張性 | ◎ 高い | △ 低い | ○ 中程度 |
| 保守性 | ◎ 高い | × 低い | ○ 中程度 |
| 実装コスト | ○ 中程度 | × 高い | ◎ 低い |
| 既存コードへの影響 | ○ 中程度 | ◎ 最小 | △ 大きい |
| テスト容易性 | ◎ 高い | ○ 中程度 | △ 低い |
| **総合評価** | **◎ 推奨** | △ 非推奨 | ○ 次点 |
