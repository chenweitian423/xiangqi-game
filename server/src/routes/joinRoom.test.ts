import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildServer } from '../index.js';

describe('room join and lookup routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('joins a room by short code', async () => {
    const createdRoom = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
      },
    });

    const createPayload = createdRoom.json();
    const response = await app.inject({
      method: 'POST',
      url: `/rooms/${createPayload.room.shortCode}/join`,
      payload: {
        nickname: 'Guest Player',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      room: {
        roomId: createPayload.room.roomId,
        shortCode: createPayload.room.shortCode,
      },
      callerRole: 'guest',
      callerToken: expect.any(String),
      passwordRequired: false,
      snapshot: {
        participants: [
          expect.objectContaining({ displayName: 'Host Player', role: 'host' }),
          expect.objectContaining({ displayName: 'Guest Player', role: 'guest' }),
        ],
      },
    });
  });

  it('rejects a join with the wrong password', async () => {
    const createdRoom = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
        password: 'correct-horse',
      },
    });

    const createPayload = createdRoom.json();
    const response = await app.inject({
      method: 'POST',
      url: `/rooms/${createPayload.room.shortCode}/join`,
      payload: {
        nickname: 'Guest Player',
        password: 'wrong-horse',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'invalid-room-password',
      message: 'The room password is incorrect.',
    });
  });

  it('allows token-based rejoin to the same room', async () => {
    const createdRoom = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
      },
    });

    const createdPayload = createdRoom.json();
    const joinedRoom = await app.inject({
      method: 'POST',
      url: `/rooms/${createdPayload.room.shortCode}/join`,
      payload: {
        nickname: 'Guest Player',
      },
    });

    const joinedPayload = joinedRoom.json();
    const response = await app.inject({
      method: 'POST',
      url: `/rooms/${createdPayload.room.shortCode}/join`,
      headers: {
        authorization: `Bearer ${joinedPayload.callerToken}`,
      },
      payload: {
        nickname: 'Guest Player Renamed',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      room: {
        roomId: createdPayload.room.roomId,
        shortCode: createdPayload.room.shortCode,
      },
      callerRole: 'guest',
      passwordRequired: false,
      snapshot: {
        participants: expect.arrayContaining([
          expect.objectContaining({ displayName: 'Guest Player', role: 'guest' }),
        ]),
      },
    });
  });

  it('rejects a second guest join without prior identity proof once the guest seat is occupied', async () => {
    const createdRoom = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
      },
    });

    const createdPayload = createdRoom.json();
    await app.inject({
      method: 'POST',
      url: `/rooms/${createdPayload.room.shortCode}/join`,
      payload: {
        nickname: 'Guest Player',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/rooms/${createdPayload.room.shortCode}/join`,
      payload: {
        nickname: 'Late Guest',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'guest-seat-occupied',
      message: 'The guest seat is already occupied. Rejoin with your saved room token.',
    });
  });

  it('does not expose protected room participants to unauthenticated callers', async () => {
    const createdRoom = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        nickname: 'Host Player',
        password: 'correct-horse',
      },
    });

    const createdPayload = createdRoom.json();
    const response = await app.inject({
      method: 'GET',
      url: `/rooms/${createdPayload.room.shortCode}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      room: {
        roomId: createdPayload.room.roomId,
        shortCode: createdPayload.room.shortCode,
      },
      callerRole: null,
      passwordRequired: true,
    });
    expect(response.json()).not.toHaveProperty('snapshot');
  });
});
