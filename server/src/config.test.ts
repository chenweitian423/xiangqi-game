import { describe, expect, it } from 'vitest';

import { resolveConfig } from './config.js';

describe('resolveConfig', () => {
  it('parses host, port, and CORS origins from environment variables', () => {
    expect(
      resolveConfig(
        {},
        {
          DATABASE_URL: 'postgres://xiangqi:test@localhost:5432/xiangqi',
          PORT: '4010',
          HOST: '::',
          CORS_ORIGINS: 'https://xiangqi.example.com, https://xiangqi-game.vercel.app ',
        },
      ),
    ).toMatchObject({
      databaseUrl: 'postgres://xiangqi:test@localhost:5432/xiangqi',
      port: 4010,
      host: '::',
      corsOrigins: ['https://xiangqi.example.com', 'https://xiangqi-game.vercel.app'],
    });
  });
});
