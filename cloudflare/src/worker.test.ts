import { describe, expect, it } from 'vitest';

import type { ClientSocketEvent, ServerSocketEvent } from '../../server/src/contracts';
import { createRoomState, storageKey, type StoredRoomState } from './roomState';
import worker, { RoomDurableObject } from './worker';

type FakeSocket = {
  sent: string[];
  closed: boolean;
  attachment: unknown;
  send: (payload: string) => void;
  close: () => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
};

function createFakeSocket(attachment: unknown = null): FakeSocket {
  return {
    sent: [],
    closed: false,
    attachment,
    send(payload) {
      this.sent.push(payload);
    },
    close() {
      this.closed = true;
    },
    serializeAttachment(value) {
      this.attachment = value;
    },
    deserializeAttachment() {
      return this.attachment;
    },
  };
}

function createFakeState(room: StoredRoomState | null, sockets: FakeSocket[] = []) {
  const store = new Map<string, StoredRoomState>();
  if (room) {
    store.set(storageKey(), room);
  }

  const durableSockets = [...sockets];

  return {
    storage: {
      async get<T>(key: string): Promise<T | undefined> {
        return store.get(key) as T | undefined;
      },
      async put<T>(key: string, value: T): Promise<void> {
        store.set(key, value as StoredRoomState);
      },
      async delete(key: string): Promise<boolean> {
        return store.delete(key);
      },
    },
    acceptWebSocket(socket: WebSocket): void {
      durableSockets.push(socket as unknown as FakeSocket);
    },
    getWebSockets(): WebSocket[] {
      return durableSockets as unknown as WebSocket[];
    },
    async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
    id: {
      toString() {
        return 'durable-object-id';
      },
    },
  };
}

function parseEvents(socket: FakeSocket): ServerSocketEvent[] {
  return socket.sent.map((payload) => JSON.parse(payload) as ServerSocketEvent);
}

async function createHostRoom(now: string) {
  return createRoomState({
    shortCode: 'ABCD12',
    nickname: 'Host Player',
    now: () => now,
    randomId: (prefix) => `${prefix}-1`,
    randomToken: () => 'host-token',
  });
}

describe('RoomDurableObject', () => {
  it('routes API-prefixed room creation requests to the durable object', async () => {
    const requests: Request[] = [];
    const env = {
      CORS_ORIGINS: 'https://xiangqi.example.com',
      ROOM_OBJECT: {
        idFromName(name: string) {
          return name;
        },
        get() {
          return {
            async fetch(input: RequestInfo | URL, init?: RequestInit) {
              const request = input instanceof Request ? input : new Request(input, init);
              requests.push(request);
              return new Response(
                JSON.stringify({
                  room: {
                    shortCode: 'ABCD12',
                  },
                }),
                {
                  status: 200,
                  headers: {
                    'content-type': 'application/json',
                  },
                },
              );
            },
          };
        },
      },
    };

    const response = await worker.fetch(
      new Request('https://xiangqi.example.com/api/rooms', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://xiangqi.example.com',
        },
        body: JSON.stringify({
          nickname: 'Host Player',
        }),
      }),
      env as unknown as Parameters<typeof worker.fetch>[1],
    );

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/internal/create');
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://xiangqi.example.com',
    );
  });

  it('broadcasts an active room snapshot to connected players when a guest joins over HTTP', async () => {
    const created = await createHostRoom('2099-05-21T10:00:00.000Z');
    const hostSocket = createFakeSocket();
    const state = createFakeState(created.room);
    const roomObject = new RoomDurableObject(state as unknown as DurableObjectState);

    await roomObject.webSocketMessage(
      hostSocket as unknown as WebSocket,
      JSON.stringify({
        type: 'room.join',
        roomId: created.room.room.roomId,
        shortCode: created.room.room.shortCode,
        displayName: 'Host Player',
        token: created.callerToken,
      } satisfies ClientSocketEvent),
    );

    hostSocket.sent = [];

    const response = await roomObject.fetch(
      new Request('https://room.internal/internal/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          nickname: 'Guest Player',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(parseEvents(hostSocket)).toContainEqual(
      expect.objectContaining({
        type: 'room.snapshot',
        snapshot: expect.objectContaining({
          room: expect.objectContaining({
            status: 'active',
          }),
          participants: expect.arrayContaining([
            expect.objectContaining({ displayName: 'Host Player', seat: 'red' }),
            expect.objectContaining({ displayName: 'Guest Player', seat: 'black' }),
          ]),
        }),
      }),
    );
  });

  it('restores persisted websocket membership after a durable object restart', async () => {
    const created = await createHostRoom('2099-05-21T10:00:00.000Z');
    const participantId = created.room.participants[0]?.participantId;
    expect(participantId).toBe('participant-1');

    const socket = createFakeSocket({
      roomId: created.room.room.roomId,
      shortCode: created.room.room.shortCode,
      participantId,
      token: created.callerToken,
    });
    const state = createFakeState(created.room, [socket]);
    const roomObject = new RoomDurableObject(state as unknown as DurableObjectState);

    await roomObject.webSocketMessage(
      socket as unknown as WebSocket,
      JSON.stringify({
        type: 'room.chat.send',
        body: 'Still connected',
      } satisfies ClientSocketEvent),
    );

    expect(parseEvents(socket)).toContainEqual(
      expect.objectContaining({
        type: 'room.chat.posted',
      }),
    );
  });

  it('reports room-unavailable for expired websocket heartbeats', async () => {
    const created = await createHostRoom('2000-01-01T00:00:00.000Z');
    const socket = createFakeSocket({
      roomId: created.room.room.roomId,
      shortCode: created.room.room.shortCode,
      participantId: created.room.participants[0]?.participantId,
      token: created.callerToken,
    });
    const state = createFakeState(created.room, [socket]);
    const roomObject = new RoomDurableObject(state as unknown as DurableObjectState);

    await roomObject.webSocketMessage(
      socket as unknown as WebSocket,
      JSON.stringify({ type: 'room.heartbeat' } satisfies ClientSocketEvent),
    );

    expect(parseEvents(socket)).toContainEqual({
      type: 'room.error',
      code: 'room-unavailable',
      message: 'This room has expired.',
    });
  });

  it('reports room-unavailable when joining a missing room over websocket', async () => {
    const socket = createFakeSocket();
    const state = createFakeState(null);
    const roomObject = new RoomDurableObject(state as unknown as DurableObjectState);

    await roomObject.webSocketMessage(
      socket as unknown as WebSocket,
      JSON.stringify({
        type: 'room.join',
        roomId: 'room-1',
        shortCode: 'ABCD12',
        displayName: 'Host Player',
        token: 'host-token',
      } satisfies ClientSocketEvent),
    );

    expect(parseEvents(socket)).toContainEqual({
      type: 'room.error',
      code: 'room-unavailable',
      message: 'This room has expired.',
    });
  });

  it('accepts seat protocol messages without treating them as invalid payloads', async () => {
    const socket = createFakeSocket();
    const state = createFakeState(null);
    const roomObject = new RoomDurableObject(state as unknown as DurableObjectState);

    await roomObject.webSocketMessage(
      socket as unknown as WebSocket,
      JSON.stringify({
        type: 'room.seat.release',
      } satisfies ClientSocketEvent),
    );

    expect(parseEvents(socket)).toContainEqual({
      type: 'room.error',
      message: 'Join the room before sending match events.',
    });
  });
});
