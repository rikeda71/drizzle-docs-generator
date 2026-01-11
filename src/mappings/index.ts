// Drizzle column type to DBML type mappings

export const postgresTypeMap: Record<string, string> = {
  serial: "serial",
  bigserial: "bigserial",
  smallserial: "smallserial",
  integer: "integer",
  smallint: "smallint",
  bigint: "bigint",
  boolean: "boolean",
  text: "text",
  varchar: "varchar",
  char: "char",
  numeric: "numeric",
  decimal: "decimal",
  real: "real",
  doublePrecision: "double precision",
  json: "json",
  jsonb: "jsonb",
  timestamp: "timestamp",
  timestamptz: "timestamptz",
  date: "date",
  time: "time",
  interval: "interval",
  uuid: "uuid",
};

export const mysqlTypeMap: Record<string, string> = {
  serial: "serial",
  int: "int",
  tinyint: "tinyint",
  smallint: "smallint",
  mediumint: "mediumint",
  bigint: "bigint",
  float: "float",
  double: "double",
  decimal: "decimal",
  boolean: "boolean",
  varchar: "varchar",
  char: "char",
  text: "text",
  tinytext: "tinytext",
  mediumtext: "mediumtext",
  longtext: "longtext",
  json: "json",
  datetime: "datetime",
  timestamp: "timestamp",
  date: "date",
  time: "time",
};

export const sqliteTypeMap: Record<string, string> = {
  integer: "integer",
  real: "real",
  text: "text",
  blob: "blob",
};

export function mapDrizzleType(
  drizzleType: string,
  dialect: "postgresql" | "mysql" | "sqlite" = "postgresql",
): string {
  const typeMap =
    dialect === "postgresql" ? postgresTypeMap : dialect === "mysql" ? mysqlTypeMap : sqliteTypeMap;

  return typeMap[drizzleType] ?? drizzleType;
}
