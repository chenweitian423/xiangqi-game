import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Pool } from 'pg';

import type { ServerConfig } from './config.js';

export const schemaFileUrl = new URL('./schema.sql', import.meta.url);

function resolveServerWorkspacePath(...segments: string[]): string {
  const cwd = process.cwd();
  const serverRoot = basename(cwd).toLowerCase() === 'server' ? cwd : join(cwd, 'server');
  return join(serverRoot, ...segments);
}

export type Database = {
  close: () => Promise<void>;
  pool: Pool;
  query: Pool['query'];
};

export function createDb(config: Pick<ServerConfig, 'databaseUrl'>): Database {
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });

  return {
    pool,
    query: pool.query.bind(pool),
    close: async () => {
      await pool.end();
    },
  };
}

export async function loadSchemaSql(): Promise<string> {
  return readFile(resolveServerWorkspacePath('src', 'schema.sql'), 'utf8');
}
