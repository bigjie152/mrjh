import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Real SQLite with a small D1 test adapter; batches use transactions, including rollback.
export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(directory).filter((file) => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
  const prepare = (sql: string, values: any[] = []) => {
    const execute = () => {
      const statement = sqlite.prepare(sql);
      statement.setAllowBareNamedParameters(true);
      // D1 accepts positional bindings for SQLite's numbered ?1 parameters.
      const parameters = Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
      if (statement.columns().length) return { success: true, results: statement.all(parameters), meta: { changes: 0 } };
      const info = statement.run(parameters);
      return { success: true, results: [], meta: { changes: Number(info.changes) } };
    };
    return { bind: (...args: any[]) => prepare(sql, args), run: async () => execute(), all: async () => execute(), first: async () => execute().results[0] ?? null, execute };
  };
  const db = {
    prepare,
    batch: async (statements: ReturnType<typeof prepare>[]) => {
      sqlite.exec('BEGIN');
      try { const results = statements.map((statement) => statement.execute()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { db, sqlite, close: () => sqlite.close() };
}
