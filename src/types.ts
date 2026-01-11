export interface Column {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  notNull?: boolean;
  default?: string;
  comment?: string;
}

export interface Relation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
}

export interface Table {
  name: string;
  columns: Column[];
  comment?: string;
}

export interface ParsedSchema {
  tables: Table[];
  relations: Relation[];
}
