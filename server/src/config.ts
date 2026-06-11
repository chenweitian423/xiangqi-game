import { hash } from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';

import { shortCodeAlphabet } from './contracts.js';

export const serverConfigSchema = z.object({
  databaseUrl: z.string().min(1).default('postgres://localhost:5432/xiangqi'),
  bcryptSaltRounds: z.coerce.number().int().min(4).max(31).default(10),
  shortCodeLength: z.coerce.number().int().min(4).max(12).default(6),
  host: z.string().min(1).default('0.0.0.0'),
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  corsOrigins: z.array(z.string().min(1)).default([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function resolveConfig(
  overrides: Partial<ServerConfig> = {},
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  return serverConfigSchema.parse({
    databaseUrl: overrides.databaseUrl ?? env.DATABASE_URL,
    bcryptSaltRounds: overrides.bcryptSaltRounds ?? env.BCRYPT_SALT_ROUNDS,
    shortCodeLength: overrides.shortCodeLength ?? env.SHORT_CODE_LENGTH,
    host: overrides.host ?? env.HOST,
    port: overrides.port ?? env.PORT,
    corsOrigins: overrides.corsOrigins ?? parseCorsOrigins(env.CORS_ORIGINS),
  });
}

export function createShortCodeGenerator(length: number): () => string {
  return customAlphabet(shortCodeAlphabet, length);
}

export function hashRoomSecret(secret: string, saltRounds: number): Promise<string> {
  return hash(secret, saltRounds);
}

function parseCorsOrigins(value: string | undefined): string[] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : undefined;
}
