import { describe, expect, it } from 'vitest';
import { buildServer } from './index.js';

describe('buildServer', () => {
  it('creates a testable Fastify app with health and websocket scaffolding', async () => {
    const app = await buildServer({
      config: {
        databaseUrl: 'postgres://xiangqi:test@localhost:5432/xiangqi',
        bcryptSaltRounds: 10,
        shortCodeLength: 6,
        corsOrigins: ['https://xiangqi.example.com'],
      },
    });

    const healthResponse = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({
      ok: true,
      service: 'xiangqi-online-server',
    });

    expect(app.websocketServer).toBeDefined();
    expect(app.hasDecorator('db')).toBe(true);
    expect(app.config.databaseUrl).toContain('postgres://');
    expect(app.config.shortCodeLength).toBe(6);

    const corsResponse = await app.inject({
      method: 'OPTIONS',
      url: '/rooms',
      headers: {
        origin: 'https://xiangqi.example.com',
      },
    });

    expect(corsResponse.statusCode).toBe(204);
    expect(corsResponse.headers['access-control-allow-origin']).toBe(
      'https://xiangqi.example.com',
    );
    expect(corsResponse.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
    expect(corsResponse.headers['access-control-allow-headers']).toBe(
      'content-type,authorization',
    );

    await app.close();
  });
});
