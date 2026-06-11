import type { ClientSocketEvent, ServerSocketEvent } from '../../server/src/contracts.js';
import type { Move } from '../../src/game/types.js';
import {
  GuestSeatOccupiedError,
  InvalidRoomPasswordError,
  InvalidTokenError,
  RoomNotFoundError,
  applyMatchMove,
  createRoomSnapshot,
  createRoomState,
  createShortCode,
  endRoomState,
  getRoomState,
  joinRoomState,
  isRoomExpired,
  postChatMessage,
  restartMatchState,
  setParticipantConnected,
  setParticipantDisconnected,
  storageKey,
  touchRoomState,
  type StoredRoomState,
} from './roomState.js';

export interface Env {
  ROOM_OBJECT: DurableObjectNamespace;
  CORS_ORIGINS?: string;
}

type SocketMembership = {
  roomId: string;
  shortCode: string;
  participantId: string;
  token: string;
};

function roomUnavailableEvent(): ServerSocketEvent {
  return {
    type: 'room.error',
    code: 'room-unavailable',
    message: 'This room has expired.',
  };
}

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function withCors(response: Response, origin: string | null, env: Env): Response {
  const headers = new Headers(response.headers);
  const allowedOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type,authorization');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function extractBearerToken(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

function parseRoomCode(pathname: string): string | null {
  const match = /^\/rooms\/([^/]+)(?:\/(join|end|restart|chat|move|ws))?$/.exec(pathname);
  return match?.[1]?.toUpperCase() ?? null;
}

function normalizeApiPathname(pathname: string): string {
  if (pathname === '/api') {
    return '/';
  }

  if (pathname.startsWith('/api/')) {
    return pathname.slice('/api'.length);
  }

  return pathname;
}

async function proxyToRoom(
  env: Env,
  shortCode: string,
  path: string,
  request: Request,
): Promise<Response> {
  const stub = env.ROOM_OBJECT.get(env.ROOM_OBJECT.idFromName(shortCode));
  return stub.fetch(`https://room.internal${path}`, request);
}

async function createUniqueRoom(env: Env, request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { nickname?: string; password?: string };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shortCode = createShortCode();
      const stub = env.ROOM_OBJECT.get(env.ROOM_OBJECT.idFromName(shortCode));
      let response: Response;
      try {
        response = await stub.fetch('https://room.internal/internal/create', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            shortCode,
          }),
        });
      } catch (error) {
        return jsonResponse(
          {
            error: 'room-create-failed',
            message: error instanceof Error ? error.message : 'Unable to create a room right now.',
          },
          { status: 500 },
        );
      }
      if (response.status !== 409) {
        return response;
      }
    }
    return jsonResponse(
      {
        error: 'room-create-failed',
        message: 'Unable to create a unique room right now.',
      },
      { status: 503 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        {
          error: 'invalid-request',
          message: 'Request body must be valid JSON.',
        },
        { status: 400 },
      );
    }

    return jsonResponse(
      {
        error: 'room-create-failed',
        message: error instanceof Error ? error.message : 'Unable to create a room right now.',
      },
      { status: 500 },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalizeApiPathname(url.pathname);
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), origin, env);
    }

    let response: Response;
    if (request.method === 'GET' && pathname === '/health') {
      response = jsonResponse({
        ok: true,
        service: 'xiangqi-online-server',
      });
      return withCors(response, origin, env);
    }

    if (request.method === 'POST' && pathname === '/rooms') {
      response = await createUniqueRoom(env, request);
      return withCors(response, origin, env);
    }

    const shortCode = parseRoomCode(pathname);
    if (!shortCode) {
      response = jsonResponse(
        {
          error: 'not-found',
          message: 'The requested route does not exist.',
        },
        { status: 404 },
      );
      return withCors(response, origin, env);
    }

    if (request.method === 'POST' && pathname.endsWith('/join')) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/internal/join',
        new Request(request.url, request),
      );
      return withCors(response, origin, env);
    }

        if (
          request.method === 'GET' &&
          /^\/rooms\/[^/]+$/.test(pathname)
        ) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/internal/room',
        new Request(request.url, request),
      );
      return withCors(response, origin, env);
    }

    if (request.method === 'POST' && pathname.endsWith('/end')) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/internal/end',
        new Request(request.url, request),
      );
      return withCors(response, origin, env);
    }

    if (request.method === 'POST' && pathname.endsWith('/restart')) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/internal/restart',
        new Request(request.url, request),
      );
      return withCors(response, origin, env);
    }

    if (request.method === 'POST' && pathname.endsWith('/chat')) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/internal/chat',
        new Request(request.url, request),
      );
      return withCors(response, origin, env);
    }

    if (request.method === 'POST' && pathname.endsWith('/move')) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/internal/move',
        new Request(request.url, request),
      );
      return withCors(response, origin, env);
    }

    if (pathname.endsWith('/ws')) {
      response = await proxyToRoom(
        env,
        shortCode,
        '/ws',
        new Request(request.url, request),
      );
      return response;
    }

    response = jsonResponse(
      {
        error: 'not-found',
        message: 'The requested route does not exist.',
      },
      { status: 404 },
    );
    return withCors(response, origin, env);
  },
};

export class RoomDurableObject {
  private readonly sockets = new Set<WebSocket>();
  private readonly memberships = new Map<WebSocket, SocketMembership>();
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
    for (const socket of this.state.getWebSockets()) {
      const membership = socket.deserializeAttachment();
      if (!isSocketMembership(membership)) {
        continue;
      }

      this.sockets.add(socket);
      this.memberships.set(socket, membership);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket' && url.pathname === '/ws') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client } as ResponseInit & {
        webSocket: WebSocket;
      });
    }

    try {
      if (request.method === 'POST' && url.pathname === '/internal/create') {
        return await this.handleCreate(request);
      }
      if (request.method === 'POST' && url.pathname === '/internal/join') {
        return await this.handleJoin(request);
      }
      if (request.method === 'GET' && url.pathname === '/internal/room') {
        return await this.handleGetRoom(request);
      }
      if (request.method === 'POST' && url.pathname === '/internal/end') {
        return await this.handleEndRoom(request);
      }
      if (request.method === 'POST' && url.pathname === '/internal/restart') {
        return await this.handleRestartMatch(request);
      }
      if (request.method === 'POST' && url.pathname === '/internal/chat') {
        return await this.handlePostChat(request);
      }
      if (request.method === 'POST' && url.pathname === '/internal/move') {
        return await this.handlePostMove(request);
      }
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        return jsonResponse(
          {
            error: 'room-not-found',
            message: 'The requested room does not exist.',
          },
          { status: 404 },
        );
      }
      if (error instanceof InvalidRoomPasswordError) {
        return jsonResponse(
          {
            error: 'invalid-room-password',
            message: error.message,
          },
          { status: 403 },
        );
      }
      if (error instanceof GuestSeatOccupiedError) {
        return jsonResponse(
          {
            error: 'guest-seat-occupied',
            message: error.message,
          },
          { status: 409 },
        );
      }
      if (error instanceof InvalidTokenError) {
        return jsonResponse(
          {
            error: 'invalid-token',
            message: error.message,
          },
          { status: 403 },
        );
      }
      throw error;
    }

    return jsonResponse(
      {
        error: 'not-found',
        message: 'The requested route does not exist.',
      },
      { status: 404 },
    );
  }

  async webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    let payload: unknown;
    try {
      payload =
        typeof rawMessage === 'string'
          ? JSON.parse(rawMessage)
          : JSON.parse(new TextDecoder().decode(rawMessage));
    } catch {
      this.send(socket, {
        type: 'room.error',
        message: 'Unable to parse the websocket message.',
      });
      return;
    }

    let event: ClientSocketEvent;
    try {
            event = parseClientSocketEvent(payload);
    } catch {
      this.send(socket, {
        type: 'room.error',
        message: 'The websocket event payload was invalid.',
      });
      return;
    }

    try {
      if (event.type === 'room.join') {
        await this.handleSocketJoin(socket, event);
        return;
      }

      const membership = this.memberships.get(socket);
      if (!membership) {
        this.send(socket, {
          type: 'room.error',
          message: 'Join the room before sending match events.',
        });
        return;
      }

      if (event.type === 'room.heartbeat') {
        const room = await this.requireAvailableRoom();
        await this.saveRoom(touchRoomState(room));
        return;
      }

      if (event.type === 'room.leave') {
        const room = await this.loadRoom();
        if (room) {
          await this.saveRoom(setParticipantDisconnected(room, membership.participantId));
        }
        this.memberships.delete(socket);
        this.sockets.delete(socket);
        socket.close();
        return;
      }

      if (event.type === 'room.seat.claim' || event.type === 'room.seat.release') {
        return;
      }

      if (event.type === 'room.chat.send') {
        const room = await this.requireAvailableRoom();
        const participant = room.presenceByToken[membership.token];
        if (!participant) {
          this.send(socket, {
            type: 'room.error',
            code: 'invalid-token',
            message: 'Join the room with a valid participant token before chatting.',
          });
          return;
        }

        const result = postChatMessage(room, participant.participantId, event.body);
        await this.saveRoom(result.room);
        this.broadcast({
          type: 'room.chat.posted',
          revision: result.room.room.revision,
          message: result.message,
        });
        return;
      }

      if (event.type === 'match.move') {
        const room = await this.requireAvailableRoom();
        const result = applyMatchMove(room, membership.participantId, event.revision, event.move);
        if (!result.accepted) {
          this.send(socket, {
            type: 'match.rejected',
            revision: result.expectedRevision ?? event.revision,
            reason: result.reason,
            ...(result.expectedRevision !== undefined
              ? {
                  expectedRevision: result.expectedRevision,
                }
              : {}),
            message: result.message,
          });
          return;
        }

        await this.saveRoom(result.room);
        this.broadcast({
          type: 'match.updated',
          revision: result.match.revision,
          match: result.match,
        });
      }
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        this.send(socket, roomUnavailableEvent());
        return;
      }

      if (error instanceof InvalidTokenError) {
        this.send(socket, {
          type: 'room.error',
          code: 'invalid-token',
          message: error.message,
        });
        return;
      }

      throw error;
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    await this.closeSocket(socket);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.closeSocket(socket);
  }

  private async handleCreate(request: Request): Promise<Response> {
    const existing = await this.loadRoom();
    if (existing) {
      return new Response(null, { status: 409 });
    }

    const payload = (await request.json()) as {
      nickname?: string;
      password?: string;
      shortCode?: string;
    };
    if (!payload.nickname?.trim()) {
      return jsonResponse(
        {
          error: 'invalid-request',
          message: 'Nickname is required.',
        },
        { status: 400 },
      );
    }

        const shortCode = payload.shortCode?.trim().toUpperCase() ?? createShortCode();
    const created = await createRoomState({
      shortCode: shortCode.toUpperCase(),
      nickname: payload.nickname,
      password: payload.password,
    });
    await this.saveRoom(created.room);

    return jsonResponse(
      {
        room: created.room.room,
        callerRole: 'host',
        callerToken: created.callerToken,
        passwordRequired: created.room.password !== null,
        snapshot: createRoomSnapshot(created.room),
      },
      { status: 201 },
    );
  }

  private async handleJoin(request: Request): Promise<Response> {
    const room = await this.requireRoom();
    const payload = (await request.json()) as { nickname?: string; password?: string };
    if (!payload.nickname?.trim()) {
      return jsonResponse(
        {
          error: 'invalid-request',
          message: 'Nickname is required.',
        },
        { status: 400 },
      );
    }

    const callerToken = extractBearerToken(request.headers.get('authorization'));
    const joined = await joinRoomState(room, {
      nickname: payload.nickname,
      password: payload.password,
      callerToken,
    });
    await this.saveRoom(joined.room);
    const snapshot = createRoomSnapshot(joined.room);
    this.broadcast({
      type: 'room.snapshot',
      revision: snapshot.room.revision,
      snapshot,
    });
    return jsonResponse({
      room: joined.room.room,
      callerRole: joined.callerRole,
      callerToken: joined.callerToken,
      passwordRequired: joined.room.password !== null,
      snapshot,
    });
  }

  private async handleGetRoom(request: Request): Promise<Response> {
    const room = await this.requireRoom();
    const payload = getRoomState(
      room,
      extractBearerToken(request.headers.get('authorization')),
    );
    return jsonResponse(payload);
  }

  private async handleEndRoom(request: Request): Promise<Response> {
    const room = await this.requireRoom();
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return jsonResponse(
        {
          error: 'missing-token',
          message: 'A room token is required to end this room.',
        },
        { status: 401 },
      );
    }

    const presence = room.presenceByToken[token];
    if (!presence || presence.role !== 'host') {
      return jsonResponse(
        {
          error: 'host-only',
          message: 'Only the host can end this room.',
        },
        { status: 403 },
      );
    }

    const nextRoom = endRoomState(room);
    await this.saveRoom(nextRoom);
    const snapshot = createRoomSnapshot(nextRoom);
    this.broadcast({
      type: 'room.snapshot',
      revision: snapshot.room.revision,
      snapshot,
    });

    return jsonResponse({
      room: nextRoom.room,
      callerRole: 'host',
      callerToken: token,
      passwordRequired: nextRoom.password !== null,
      snapshot,
    });
  }

  private async handleRestartMatch(request: Request): Promise<Response> {
    const room = await this.requireAvailableRoom();
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return jsonResponse(
        {
          error: 'missing-token',
          message: 'A room token is required to start another game.',
        },
        { status: 401 },
      );
    }

    const presence = room.presenceByToken[token];
    if (!presence || presence.role !== 'host') {
      return jsonResponse(
        {
          error: 'host-only',
          message: 'Only the host can start another game.',
        },
        { status: 403 },
      );
    }

    const nextRoom = restartMatchState(room);
    await this.saveRoom(nextRoom);
    const snapshot = createRoomSnapshot(nextRoom);
    this.broadcast({
      type: 'room.snapshot',
      revision: snapshot.room.revision,
      snapshot,
    });

    return jsonResponse({
      room: nextRoom.room,
      callerRole: 'host',
      callerToken: token,
      passwordRequired: nextRoom.password !== null,
      snapshot,
    });
  }

  private async handlePostChat(request: Request): Promise<Response> {
    const room = await this.requireAvailableRoom();
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return jsonResponse(
        {
          error: 'missing-token',
          message: 'A room token is required to chat in this room.',
        },
        { status: 401 },
      );
    }

    const participant = room.presenceByToken[token];
    if (!participant) {
      return jsonResponse(
        {
          error: 'invalid-token',
          message: 'Join the room with a valid participant token before chatting.',
        },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { body?: string };
    if (!payload.body?.trim()) {
      return jsonResponse(
        {
          error: 'invalid-request',
          message: 'Message body is required.',
        },
        { status: 400 },
      );
    }

    const result = postChatMessage(room, participant.participantId, payload.body);
    await this.saveRoom(result.room);
    const snapshot = createRoomSnapshot(result.room);
    this.broadcast({
      type: 'room.chat.posted',
      revision: result.room.room.revision,
      message: result.message,
    });

    return jsonResponse({
      room: result.room.room,
      callerRole: participant.role,
      callerToken: token,
      passwordRequired: result.room.password !== null,
      snapshot,
    });
  }

  private async handlePostMove(request: Request): Promise<Response> {
    const room = await this.requireAvailableRoom();
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return jsonResponse(
        {
          error: 'missing-token',
          message: 'A room token is required to submit a move.',
        },
        { status: 401 },
      );
    }

    const participant = room.presenceByToken[token];
    if (!participant) {
      return jsonResponse(
        {
          error: 'invalid-token',
          message: 'Join the room with a valid participant token before moving.',
        },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { revision?: number; move?: Move };
    if (typeof payload.revision !== 'number' || !payload.move) {
      return jsonResponse(
        {
          error: 'invalid-request',
          message: 'Move revision and payload are required.',
        },
        { status: 400 },
      );
    }

    const result = applyMatchMove(room, participant.participantId, payload.revision, payload.move);
    if (!result.accepted) {
      return jsonResponse(
        {
          error: 'match-rejected',
          message: result.message,
          reason: result.reason,
          expectedRevision: result.expectedRevision ?? null,
        },
        { status: 409 },
      );
    }

    await this.saveRoom(result.room);
    const snapshot = createRoomSnapshot(result.room);
    this.broadcast({
      type: 'match.updated',
      revision: result.match.revision,
      match: result.match,
    });

    return jsonResponse({
      room: result.room.room,
      callerRole: participant.role,
      callerToken: token,
      passwordRequired: result.room.password !== null,
      snapshot,
    });
  }

  private async handleSocketJoin(socket: WebSocket, event: ClientSocketEvent): Promise<void> {
    if (event.type !== 'room.join') {
      return;
    }

    const room = await this.requireAvailableRoom();
    const presence = room.presenceByToken[event.token];
    if (!presence) {
      this.send(socket, {
        type: 'room.error',
        code: 'invalid-token',
        message: 'The saved room token is invalid.',
      });
      return;
    }

    if (presence.roomId !== room.room.roomId || presence.shortCode !== room.room.shortCode) {
      this.send(socket, {
        type: 'room.error',
        code: 'invalid-token',
        message: 'The room token does not match this room.',
      });
      return;
    }

    const nextRoom = setParticipantConnected(room, presence.participantId);
    await this.saveRoom(nextRoom);
    const membership = {
      roomId: nextRoom.room.roomId,
      shortCode: nextRoom.room.shortCode,
      participantId: presence.participantId,
      token: event.token,
    } satisfies SocketMembership;
    socket.serializeAttachment(membership);
    this.memberships.set(socket, membership);
    this.sockets.add(socket);
    this.send(socket, {
      type: 'room.snapshot',
      revision: nextRoom.room.revision,
      snapshot: createRoomSnapshot(nextRoom),
    });
  }

  private async closeSocket(socket: WebSocket): Promise<void> {
    const membership = this.memberships.get(socket);
    this.memberships.delete(socket);
    this.sockets.delete(socket);
    if (!membership) {
      return;
    }

    const room = await this.loadRoom();
    if (!room) {
      return;
    }

    await this.saveRoom(setParticipantDisconnected(room, membership.participantId));
  }

  private send(socket: WebSocket, event: ServerSocketEvent): void {
    socket.send(JSON.stringify(event));
  }

  private broadcast(event: ServerSocketEvent): void {
    for (const socket of this.sockets) {
      this.send(socket, event);
    }
  }

  private async loadRoom(): Promise<StoredRoomState | null> {
    const stored = await this.state.storage.get<StoredRoomState>(storageKey());
    return stored ?? null;
  }

  private async requireRoom(): Promise<StoredRoomState> {
    const room = await this.loadRoom();
    if (!room) {
      throw new RoomNotFoundError();
    }
    return room;
  }

  private async requireAvailableRoom(): Promise<StoredRoomState> {
    const room = await this.requireRoom();
    if (isRoomExpired(room.room.lastActiveAt, room.room.status)) {
      throw new RoomNotFoundError();
    }

    return room;
  }

  private async saveRoom(room: StoredRoomState): Promise<void> {
    await this.state.storage.put(storageKey(), room);
  }
}
function parseClientSocketEvent(payload: unknown): ClientSocketEvent {
  if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
    throw new Error('invalid-event');
  }

  const event = payload as Record<string, unknown>;
  switch (event.type) {
    case 'room.join':
      if (
        typeof event.roomId === 'string' &&
        typeof event.shortCode === 'string' &&
        typeof event.displayName === 'string' &&
        typeof event.token === 'string'
      ) {
        return {
          type: 'room.join',
          roomId: event.roomId,
          shortCode: event.shortCode,
          displayName: event.displayName,
          token: event.token,
        };
      }
      break;
    case 'room.heartbeat':
      return { type: 'room.heartbeat' };
    case 'room.leave':
      return { type: 'room.leave' };
    case 'room.seat.claim':
      if (event.seat === 'red' || event.seat === 'black') {
        return {
          type: 'room.seat.claim',
          seat: event.seat,
        };
      }
      break;
    case 'room.seat.release':
      return { type: 'room.seat.release' };
    case 'room.chat.send':
      if (typeof event.body === 'string') {
        return {
          type: 'room.chat.send',
          body: event.body,
        };
      }
      break;
    case 'match.move':
      if (
        typeof event.revision === 'number' &&
        typeof event.move === 'object' &&
        event.move !== null
      ) {
        return {
          type: 'match.move',
          revision: event.revision,
          move: event.move as Move,
        };
      }
      break;
    default:
      break;
  }

  throw new Error('invalid-event');
}

function isSocketMembership(value: unknown): value is SocketMembership {
  return (
    typeof value === 'object' &&
    value !== null &&
    'roomId' in value &&
    typeof value.roomId === 'string' &&
    'shortCode' in value &&
    typeof value.shortCode === 'string' &&
    'participantId' in value &&
    typeof value.participantId === 'string' &&
    'token' in value &&
    typeof value.token === 'string'
  );
}
