export interface Db {
  exec(sql: string): void;
  run(sql: string, params?: readonly (string | number | null)[]): void;
  all<T>(sql: string, params?: readonly (string | number | null)[]): T[];
  get<T>(sql: string, params?: readonly (string | number | null)[]): T | undefined;
}
