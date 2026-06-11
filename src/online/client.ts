import type { Role, Room, RoomSnapshot } from './types';
import type { ClientSocketEvent, ServerSocketEvent } from './types';
import type { Move } from '../game/types';

export type RoomSessionResponse = {
  room: Room;
  callerRole: Role | null;
  callerToken?: string;
  passwordRequired: boolean;
  snapshot?: RoomSnapshot;
};

export type CreateRoomRequest = {
  nickname: string;
  password?: string;
};

export type JoinRoomRequest = {
  code: string;
  nickname: string;
  password?: string;
  callerToken?: string;
};

export type EndRoomRequest = {
  code: string;
  callerToken: string;
};

export type RestartRoomRequest = {
  code: string;
  callerToken: string;
};

export type SendRoomChatRequest = {
  code: string;
  callerToken: string;
  body: string;
};

export type SubmitRoomMoveRequest = {
  code: string;
  callerToken: string;
  revision: number;
  move: Move;
};

export type RoomSocketConnection = {
  send: (event: ClientSocketEvent) => void;
  subscribe: (listener: (event: ServerSocketEvent) => void) => () => void;
  close: () => void;
  socket?: WebSocket;
};

export type ConnectRoomSocket = (socketPath?: string) => RoomSocketConnection;

export type OnlineClientOptions = {
  baseUrl?: string;
  socketUrl?: string;
};

type OnlineRuntimeEnv = {
  readonly VITE_ONLINE_API_BASE_URL?: string;
  readonly VITE_ONLINE_WS_URL?: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? payload.message
        : 'Request failed.';
    throw new Error(message ?? 'Request failed.');
  }

  return payload as T;
}

function normalizeOptionalValue(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function deriveSocketUrl(baseUrl: string): string {
  if (!/^https?:\/\//.test(baseUrl)) {
    return '/ws';
  }

  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/api\/?$/, '/ws');
  if (!url.pathname.endsWith('/ws')) {
    url.pathname = '/ws';
  }
  return url.toString();
}

export function resolveRoomSocketPath(socketUrl: string, shortCode: string): string {
  const normalizedShortCode = encodeURIComponent(shortCode.trim().toUpperCase());
  if (
    socketUrl.startsWith('ws://') ||
    socketUrl.startsWith('wss://') ||
    socketUrl.startsWith('http://') ||
    socketUrl.startsWith('https://')
  ) {
    const url = new URL(socketUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
    url.pathname = `/rooms/${normalizedShortCode}/ws`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  return `/rooms/${normalizedShortCode}/ws`;
}

export function resolveOnlineClientOptions(
  env: OnlineRuntimeEnv = import.meta.env,
): Required<OnlineClientOptions> {
  const baseUrl = normalizeOptionalValue(env.VITE_ONLINE_API_BASE_URL) ?? '/api';
  const socketUrl = normalizeOptionalValue(env.VITE_ONLINE_WS_URL) ?? deriveSocketUrl(baseUrl);

  return {
    baseUrl,
    socketUrl,
  };
}

export function createOnlineClient(options: OnlineClientOptions = resolveOnlineClientOptions()) {
  const baseUrl = options.baseUrl ?? '/api';
  const defaultSocketUrl = options.socketUrl ?? '/ws';

  function resolveSocketUrl(socketPath = defaultSocketUrl): string {
    if (socketPath.startsWith('ws://') || socketPath.startsWith('wss://')) {
      return socketPath;
    }

    if (typeof window === 'undefined') {
      return socketPath;
    }

    const url = new URL(socketPath, window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  }

  return {
    async createRoom(request: CreateRoomRequest): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    async joinRoom(request: JoinRoomRequest): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(request.code)}/join`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(request.callerToken
            ? {
                authorization: `Bearer ${request.callerToken}`,
              }
            : {}),
        },
        body: JSON.stringify({
          nickname: request.nickname,
          password: request.password,
        }),
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    async getRoom(code: string, callerToken?: string): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(code)}`, {
        headers: callerToken
          ? {
              authorization: `Bearer ${callerToken}`,
            }
          : undefined,
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    async endRoom(request: EndRoomRequest): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(request.code)}/end`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${request.callerToken}`,
        },
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    async restartRoom(request: RestartRoomRequest): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(request.code)}/restart`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${request.callerToken}`,
        },
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    async sendRoomChat(request: SendRoomChatRequest): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(request.code)}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${request.callerToken}`,
        },
        body: JSON.stringify({
          body: request.body,
        }),
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    async submitRoomMove(request: SubmitRoomMoveRequest): Promise<RoomSessionResponse> {
      const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(request.code)}/move`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${request.callerToken}`,
        },
        body: JSON.stringify({
          revision: request.revision,
          move: request.move,
        }),
      });

      return parseResponse<RoomSessionResponse>(response);
    },

    connectRoomSocket(socketPath = defaultSocketUrl): RoomSocketConnection {
      const listeners = new Set<(event: ServerSocketEvent) => void>();
      const queue: string[] = [];
      const socket = new WebSocket(resolveSocketUrl(socketPath));

      socket.addEventListener('open', () => {
        while (queue.length > 0) {
          const nextPayload = queue.shift();
          if (nextPayload !== undefined) {
            socket.send(nextPayload);
          }
        }
      });

      socket.addEventListener('message', (event) => {
        const payload = JSON.parse(String(event.data)) as ServerSocketEvent;
        for (const listener of listeners) {
          listener(payload);
        }
      });

      return {
        socket,
        send(event: ClientSocketEvent) {
          const payload = JSON.stringify(event);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
            return;
          }

          queue.push(payload);
        },
        subscribe(listener: (event: ServerSocketEvent) => void) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        close() {
          socket.close();
        },
      };
    },
  };
}

export type OnlineClient = ReturnType<typeof createOnlineClient>;
