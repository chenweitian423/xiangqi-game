import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildServer } from '../index.js';

describe('POST /rooms', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a room without a password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      room: {
        roomId: expect.any(String),
        shortCode: expect.stringMatching(/^[A-Z2-9]+$/),
        status: 'waiting',
      },
      callerRole: 'host',
      callerToken: expect.any(String),
      passwordRequired: false,
      snapshot: {
        room: {
          status: 'waiting',
        },
        participants: [
          expect.objectContaining({
            displayName: 'Host Player',
            role: 'host',
            status: 'connected',
          }),
        ],
      },
    });
  });

  it('creates a room with a password and does not echo the plaintext secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
        password: 'river-horse',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      callerRole: 'host',
      passwordRequired: true,
    });
    expect(response.json()).not.toHaveProperty('password');
    expect(response.json()).not.toHaveProperty('passwordHash');
  });
});
