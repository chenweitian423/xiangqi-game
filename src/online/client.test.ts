import { describe, expect, it } from 'vitest';

import { resolveOnlineClientOptions, resolveRoomSocketPath } from './client';

describe('resolveOnlineClientOptions', () => {
  it('uses same-origin defaults when no online deployment overrides are present', () => {
    expect(resolveOnlineClientOptions({})).toEqual({
      baseUrl: '/api',
      socketUrl: '/ws',
    });
  });

  it('derives a websocket URL from an absolute API base URL', () => {
    expect(
      resolveOnlineClientOptions({
        VITE_ONLINE_API_BASE_URL: 'https://xiangqi-online.onrender.com',
      }),
    ).toEqual({
      baseUrl: 'https://xiangqi-online.onrender.com',
      socketUrl: 'wss://xiangqi-online.onrender.com/ws',
    });
  });

  it('keeps explicit websocket overrides untouched', () => {
    expect(
      resolveOnlineClientOptions({
        VITE_ONLINE_API_BASE_URL: 'https://xiangqi-online.onrender.com/api',
        VITE_ONLINE_WS_URL: 'wss://xiangqi-online.onrender.com/realtime/room',
      }),
    ).toEqual({
      baseUrl: 'https://xiangqi-online.onrender.com/api',
      socketUrl: 'wss://xiangqi-online.onrender.com/realtime/room',
    });
  });

  it('derives a room-specific websocket path from the configured socket url', () => {
    expect(resolveRoomSocketPath('/ws', 'abcd12')).toBe('/rooms/ABCD12/ws');
    expect(
      resolveRoomSocketPath('wss://xiangqi-online.example.workers.dev/ws', 'abcd12'),
    ).toBe('wss://xiangqi-online.example.workers.dev/rooms/ABCD12/ws');
  });
});
