import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildServer } from '../index.js';

describe('POST /rooms/:shortCode/end', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows the host to end the room', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
      },
    });
    const createdRoom = createResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: `/rooms/${createdRoom.room.shortCode}/end`,
      headers: {
        authorization: `Bearer ${createdRoom.callerToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      room: {
        shortCode: createdRoom.room.shortCode,
        status: 'finished',
      },
      snapshot: {
        room: {
          status: 'finished',
        },
      },
    });
  });

  it('rejects non-host callers', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
      },
    });
    const createdRoom = createResponse.json();

    const joinResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${createdRoom.room.shortCode}/join`,
      payload: {
        nickname: 'Guest Player',
      },
    });
    const joinedRoom = joinResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: `/rooms/${createdRoom.room.shortCode}/end`,
      headers: {
        authorization: `Bearer ${joinedRoom.callerToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: 'host-only',
      message: 'Only the host can end this room.',
    });
  });
});
