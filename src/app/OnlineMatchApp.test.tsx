import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialGameState } from '../game/initialState';
import OnlineMatchApp from './OnlineMatchApp';

type MockSocketEvent =
  | {
      type: 'room.snapshot';
      revision: number;
      snapshot: ReturnType<typeof restoredSnapshot>;
    }
  | {
      type: 'room.chat.posted';
      revision: number;
      message: {
        messageId: string;
        roomId: string;
        participantId: string | null;
        body: string;
        status: 'sent';
        createdAt: string;
      };
    };

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event?: MessageEvent) => void>>();

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    });
  }

  addEventListener(type: string, listener: (event?: MessageEvent) => void) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.emit('close');
  }

  serverSend(event: MockSocketEvent) {
    this.emit('message', { data: JSON.stringify(event) } as MessageEvent);
  }

  private emit(type: string, event?: MessageEvent) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function restoredSnapshot() {
  return {
    room: {
      roomId: 'room-42',
      shortCode: 'ABCD12',
      revision: 3,
      status: 'active' as const,
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:01:00.000Z',
      expiresAt: '2026-05-27T00:01:00.000Z',
      lastActiveAt: '2026-05-20T00:01:00.000Z',
      activeMatchId: 'match-42',
    },
    participants: [
      {
        participantId: 'participant-host',
        roomId: 'room-42',
        displayName: 'Host Player',
        role: 'host' as const,
        seat: 'red' as const,
        status: 'connected' as const,
        joinedAt: '2026-05-20T00:00:00.000Z',
        leftAt: null,
      },
      {
        participantId: 'participant-guest',
        roomId: 'room-42',
        displayName: 'Guest Player',
        role: 'guest' as const,
        seat: 'black' as const,
        status: 'connected' as const,
        joinedAt: '2026-05-20T00:00:30.000Z',
        leftAt: null,
      },
    ],
    seats: [
      { seat: 'red' as const, status: 'occupied' as const, participantId: 'participant-host' },
      { seat: 'black' as const, status: 'occupied' as const, participantId: 'participant-guest' },
    ] as const,
    messages: [],
    match: {
      matchId: 'match-42',
      roomId: 'room-42',
      revision: 3,
      state: createInitialGameState(),
      redParticipantId: 'participant-host',
      blackParticipantId: 'participant-guest',
      winner: null,
    },
  };
}

describe('OnlineMatchApp', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('restores and uses a stored session token for room HTTP lookup', async () => {
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        hostToken: null,
        sessionToken: 'guest-token-123',
        role: 'guest',
      }),
    );

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 1,
            status: 'waiting',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
            expiresAt: '2026-05-21T00:00:00.000Z',
            lastActiveAt: '2026-05-20T00:00:00.000Z',
            activeMatchId: null,
          },
          callerRole: 'guest',
          passwordRequired: false,
          snapshot: {
            room: {
              roomId: 'room-42',
              shortCode: 'ABCD12',
              revision: 1,
              status: 'waiting',
              createdAt: '2026-05-20T00:00:00.000Z',
              updatedAt: '2026-05-20T00:00:00.000Z',
              expiresAt: '2026-05-21T00:00:00.000Z',
              lastActiveAt: '2026-05-20T00:00:00.000Z',
              activeMatchId: null,
            },
            participants: [],
            seats: [
              { seat: 'red', status: 'occupied', participantId: 'participant-host' },
              { seat: 'black', status: 'occupied', participantId: 'participant-guest' },
            ],
            messages: [],
          },
        }),
        { status: 200 },
      ),
    );

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rooms/ABCD12', {
        headers: {
          authorization: 'Bearer guest-token-123',
        },
      });
    });
  });

  it('restores a saved session into a live websocket-backed room state', async () => {
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        token: 'guest-token-123',
        role: 'guest',
      }),
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 3,
            status: 'active',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:01:00.000Z',
            expiresAt: '2026-05-27T00:01:00.000Z',
            lastActiveAt: '2026-05-20T00:01:00.000Z',
            activeMatchId: 'match-42',
          },
          callerRole: 'guest',
          callerToken: 'guest-token-123',
          passwordRequired: false,
          snapshot: restoredSnapshot(),
        }),
        { status: 200 },
      ),
    );

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    await waitFor(() => {
      expect(MockWebSocket.instances[0]?.sent).toHaveLength(1);
    });

    expect(JSON.parse(MockWebSocket.instances[0].sent[0])).toEqual({
      type: 'room.join',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      displayName: 'Guest Player',
      token: 'guest-token-123',
    });

    MockWebSocket.instances[0].serverSend({
      type: 'room.snapshot',
      revision: 3,
      snapshot: restoredSnapshot(),
    });

    expect(await screen.findByRole('heading', { name: '等待对手' })).toBeInTheDocument();
    expect(screen.getAllByText('房间号：ABCD12').length).toBeGreaterThan(0);
    expect(screen.getByText('状态：进行中')).toBeInTheDocument();
    expect(screen.getByText('连接：已连接')).toBeInTheDocument();
    const seatsRegion = screen.getByRole('region', { name: '座位信息' });
    expect(seatsRegion).toBeInTheDocument();
    expect(within(seatsRegion).getByText('Host Player')).toBeInTheDocument();
    expect(within(seatsRegion).getByText('Guest Player')).toBeInTheDocument();
    expect(screen.getByText('暂无观战成员')).toBeInTheDocument();
    expect(screen.getAllByRole('button')[0]).toBeDisabled();
  });

  it('prefills the join form when opened from a shared room link', () => {
    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    expect(document.querySelector<HTMLInputElement>('input[name="roomCode"]')).toHaveValue('ABCD12');
  });

  it('does not imply password protection on unrelated join failures', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'room-not-found',
          message: 'The requested room does not exist.',
        }),
        { status: 404 },
      ),
    );

    render(<OnlineMatchApp kind="online" />);

    await user.click(screen.getByRole('button', { name: '加入房间' }));
    const joinRoomPanel = screen.getByRole('region', { name: '加入房间' });
    await user.type(within(joinRoomPanel).getByLabelText('房间号'), 'ABCD12');
    await user.type(within(joinRoomPanel).getByLabelText('昵称'), 'Guest Player');
    await user.click(within(joinRoomPanel).getByRole('button', { name: '加入房间' }));

    await waitFor(() => {
      expect(screen.getAllByText('The requested room does not exist.').length).toBeGreaterThan(0);
    });
    expect(within(joinRoomPanel).getByLabelText('房间密码')).not.toHaveAccessibleDescription(
      '这个房间开启了密码保护，请先输入密码。',
    );
  });

  it('uses the saved room token when rejoining an occupied guest seat', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        token: 'guest-token-123',
        role: 'guest',
      }),
    );

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/rooms/ABCD12/join') {
        return new Response(
          JSON.stringify({
            room: {
              roomId: 'room-42',
              shortCode: 'ABCD12',
              revision: 2,
              status: 'waiting',
              createdAt: '2026-05-20T00:00:00.000Z',
              updatedAt: '2026-05-20T00:01:00.000Z',
              expiresAt: '2026-05-21T00:01:00.000Z',
              lastActiveAt: '2026-05-20T00:01:00.000Z',
              activeMatchId: null,
            },
            callerRole: 'guest',
            callerToken: 'guest-token-456',
            passwordRequired: false,
            snapshot: {
              room: {
                roomId: 'room-42',
                shortCode: 'ABCD12',
                revision: 2,
                status: 'waiting',
                createdAt: '2026-05-20T00:00:00.000Z',
                updatedAt: '2026-05-20T00:01:00.000Z',
                expiresAt: '2026-05-21T00:01:00.000Z',
                lastActiveAt: '2026-05-20T00:01:00.000Z',
                activeMatchId: null,
              },
              participants: [],
              seats: [
                { seat: 'red', status: 'occupied', participantId: 'participant-host' },
                { seat: 'black', status: 'occupied', participantId: 'participant-guest' },
              ],
              messages: [],
            },
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 1,
            status: 'waiting',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
            expiresAt: '2026-05-21T00:00:00.000Z',
            lastActiveAt: '2026-05-20T00:00:00.000Z',
            activeMatchId: null,
          },
          callerRole: 'guest',
          passwordRequired: false,
        }),
        { status: 200 },
      );
    });

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    const joinRoomPanel = screen.getByRole('region', { name: '加入房间' });
    await user.type(within(joinRoomPanel).getByLabelText('昵称'), 'Guest Player');
    await user.click(within(joinRoomPanel).getByRole('button', { name: '加入房间' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rooms/ABCD12/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer guest-token-123',
        },
        body: JSON.stringify({
          nickname: 'Guest Player',
          password: undefined,
        }),
      });
    });
  });

  it('enters a newly created waiting room immediately and updates the url', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/online');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 1,
            status: 'waiting',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
            expiresAt: '2026-05-21T00:00:00.000Z',
            lastActiveAt: '2026-05-20T00:00:00.000Z',
            activeMatchId: null,
          },
          callerRole: 'host',
          callerToken: 'host-token-123',
          passwordRequired: false,
          snapshot: {
            room: {
              roomId: 'room-42',
              shortCode: 'ABCD12',
              revision: 1,
              status: 'waiting',
              createdAt: '2026-05-20T00:00:00.000Z',
              updatedAt: '2026-05-20T00:00:00.000Z',
              expiresAt: '2026-05-21T00:00:00.000Z',
              lastActiveAt: '2026-05-20T00:00:00.000Z',
              activeMatchId: null,
            },
            participants: [
              {
                participantId: 'participant-host',
                roomId: 'room-42',
                displayName: 'Host Player',
                role: 'host',
                seat: 'red',
                status: 'connected',
                joinedAt: '2026-05-20T00:00:00.000Z',
                leftAt: null,
              },
            ],
            seats: [
              { seat: 'red', status: 'occupied', participantId: 'participant-host' },
              { seat: 'black', status: 'open', participantId: null },
            ],
            messages: [],
            match: null,
          },
        }),
        { status: 201 },
      ),
    );

    render(<OnlineMatchApp kind="online" />);

    const createRoomPanel = screen.getByRole('region', { name: '创建房间' });
    await user.type(within(createRoomPanel).getByLabelText('昵称'), 'Host Player');
    await user.click(within(createRoomPanel).getByRole('button', { name: '创建房间' }));

    expect(await screen.findByRole('region', { name: '联机房间' })).not.toBeNull();
    expect(screen.getAllByText('房间号：ABCD12').length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: '创建房间' })).toBeNull();
    expect(window.location.pathname).toBe('/online/ABCD12');

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    await waitFor(() => {
      expect(MockWebSocket.instances[0]?.sent).toHaveLength(1);
    });

    expect(JSON.parse(MockWebSocket.instances[0].sent[0])).toEqual({
      type: 'room.join',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      displayName: 'Host Player',
      token: 'host-token-123',
    });
  });

  it('polls the host waiting room until the guest joins and the match becomes active', async () => {
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        token: 'host-token-123',
        role: 'host',
        displayName: 'Host Player',
      }),
    );

    const waitingSnapshot = {
      room: {
        roomId: 'room-42',
        shortCode: 'ABCD12',
        revision: 1,
        status: 'waiting' as const,
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:00:00.000Z',
        expiresAt: '2026-05-21T00:00:00.000Z',
        lastActiveAt: '2026-05-20T00:00:00.000Z',
        activeMatchId: null,
      },
      participants: [
        {
          participantId: 'participant-host',
          roomId: 'room-42',
          displayName: 'Host Player',
          role: 'host' as const,
          seat: 'red' as const,
          status: 'connected' as const,
          joinedAt: '2026-05-20T00:00:00.000Z',
          leftAt: null,
        },
      ],
      seats: [
        { seat: 'red' as const, status: 'occupied' as const, participantId: 'participant-host' },
        { seat: 'black' as const, status: 'open' as const, participantId: null },
      ],
      messages: [],
      match: null,
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            room: waitingSnapshot.room,
            callerRole: 'host',
            callerToken: 'host-token-123',
            passwordRequired: false,
            snapshot: waitingSnapshot,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            room: waitingSnapshot.room,
            callerRole: 'host',
            callerToken: 'host-token-123',
            passwordRequired: false,
            snapshot: waitingSnapshot,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            room: restoredSnapshot().room,
            callerRole: 'host',
            callerToken: 'host-token-123',
            passwordRequired: false,
            snapshot: restoredSnapshot(),
          }),
          { status: 200 },
        ),
      );

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    expect(await screen.findByText('等待第二位玩家加入房间。')).toBeInTheDocument();

    await new Promise((resolve) => window.setTimeout(resolve, 1600));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rooms/ABCD12', {
        headers: {
          authorization: 'Bearer host-token-123',
        },
      });
    });

    await new Promise((resolve) => window.setTimeout(resolve, 1600));

    expect(await screen.findByText('状态：进行中')).toBeInTheDocument();
    expect(screen.queryByText('等待第二位玩家加入房间。')).toBeNull();
  });

  it('shows room header status and spectator read-only copy for spectators', async () => {
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        token: 'spectator-token-123',
        role: 'guest',
        displayName: 'River Watcher',
      }),
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 3,
            status: 'active',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:01:00.000Z',
            expiresAt: '2026-05-27T00:01:00.000Z',
            lastActiveAt: '2026-05-20T00:01:00.000Z',
            activeMatchId: 'match-42',
          },
          callerRole: 'guest',
          callerToken: 'spectator-token-123',
          passwordRequired: false,
          snapshot: {
            ...restoredSnapshot(),
            participants: [
              ...restoredSnapshot().participants,
              {
                participantId: 'participant-spectator',
                roomId: 'room-42',
                displayName: 'River Watcher',
                role: 'guest',
                seat: null,
                status: 'connected',
                joinedAt: '2026-05-20T00:03:00.000Z',
                leftAt: null,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    MockWebSocket.instances[0].serverSend({
      type: 'room.snapshot',
      revision: 3,
      snapshot: {
        ...restoredSnapshot(),
        participants: [
          ...restoredSnapshot().participants,
          {
            participantId: 'participant-spectator',
            roomId: 'room-42',
            displayName: 'River Watcher',
            role: 'guest',
            seat: null,
            status: 'connected',
            joinedAt: '2026-05-20T00:03:00.000Z',
            leftAt: null,
          },
        ],
      },
    });

    expect(await screen.findByRole('heading', { name: '正在观战' })).toBeInTheDocument();
    expect(screen.getAllByText('房间号：ABCD12').length).toBeGreaterThan(0);
    expect(screen.getByText('状态：进行中')).toBeInTheDocument();
    expect(screen.getByText('连接：已连接')).toBeInTheDocument();
    expect(screen.getByText('观战席可实时看棋，但不能落子。')).toBeInTheDocument();
    expect(screen.getByText('River Watcher')).toBeInTheDocument();
    expect(screen.getByText('观战成员 1 人')).toBeInTheDocument();
  });

  it('shows incoming chat history in order and lets spectators send messages', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        token: 'spectator-token-123',
        role: 'guest',
        displayName: 'River Watcher',
      }),
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 3,
            status: 'active',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:01:00.000Z',
            expiresAt: '2026-05-27T00:01:00.000Z',
            lastActiveAt: '2026-05-20T00:01:00.000Z',
            activeMatchId: 'match-42',
          },
          callerRole: 'guest',
          callerToken: 'spectator-token-123',
          passwordRequired: false,
          snapshot: {
            ...restoredSnapshot(),
            participants: [
              ...restoredSnapshot().participants,
              {
                participantId: 'participant-spectator',
                roomId: 'room-42',
                displayName: 'River Watcher',
                role: 'guest',
                seat: null,
                status: 'connected',
                joinedAt: '2026-05-20T00:03:00.000Z',
                leftAt: null,
              },
            ],
            messages: [
              {
                messageId: 'message-1',
                roomId: 'room-42',
                participantId: 'participant-host',
                body: 'Welcome to the room',
                status: 'sent',
                createdAt: '2026-05-20T00:01:10.000Z',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    MockWebSocket.instances[0].serverSend({
      type: 'room.snapshot',
      revision: 3,
      snapshot: {
        ...restoredSnapshot(),
        participants: [
          ...restoredSnapshot().participants,
          {
            participantId: 'participant-spectator',
            roomId: 'room-42',
            displayName: 'River Watcher',
            role: 'guest',
            seat: null,
            status: 'connected',
            joinedAt: '2026-05-20T00:03:00.000Z',
            leftAt: null,
          },
        ],
        messages: [
          {
            messageId: 'message-1',
            roomId: 'room-42',
            participantId: 'participant-host',
            body: 'Welcome to the room',
            status: 'sent',
            createdAt: '2026-05-20T00:01:10.000Z',
          },
        ],
      },
    });

    expect(await screen.findByText('Welcome to the room')).toBeInTheDocument();

    MockWebSocket.instances[0].serverSend({
      type: 'room.chat.posted',
      revision: 4,
      message: {
        messageId: 'message-2',
        roomId: 'room-42',
        participantId: 'participant-guest',
        body: 'Good luck both',
        status: 'sent',
        createdAt: '2026-05-20T00:01:40.000Z',
      },
    });

    expect(await screen.findByText('Good luck both')).toBeInTheDocument();

    const chatRegion = screen.getByRole('region', { name: '房间聊天' });
    const items = within(chatRegion).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Welcome to the room');
    expect(items[1]).toHaveTextContent('Good luck both');

    await user.type(within(chatRegion).getByLabelText('发送消息'), 'Watching closely');
    await user.click(within(chatRegion).getByRole('button', { name: '发送' }));

    expect(JSON.parse(MockWebSocket.instances[0].sent.at(-1) ?? '{}')).toEqual({
      type: 'room.chat.send',
      body: 'Watching closely',
    });
  });
  it('shows ended rooms as read-only and keeps chat readable', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      'xiangqi-online-room:ABCD12',
      JSON.stringify({
        code: 'ABCD12',
        token: 'host-token-123',
        role: 'host',
        displayName: 'Host Player',
      }),
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            roomId: 'room-42',
            shortCode: 'ABCD12',
            revision: 5,
            status: 'finished',
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:05:00.000Z',
            expiresAt: '2026-05-27T00:05:00.000Z',
            lastActiveAt: '2026-05-20T00:05:00.000Z',
            activeMatchId: 'match-42',
          },
          callerRole: 'host',
          callerToken: 'host-token-123',
          passwordRequired: false,
          snapshot: {
            ...restoredSnapshot(),
            room: {
              ...restoredSnapshot().room,
              revision: 5,
              status: 'finished',
            },
            messages: [
              {
                messageId: 'message-1',
                roomId: 'room-42',
                participantId: 'participant-host',
                body: 'Thanks for playing',
                status: 'sent',
                createdAt: '2026-05-20T00:04:50.000Z',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    render(<OnlineMatchApp kind="online" roomId="ABCD12" />);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    MockWebSocket.instances[0].serverSend({
      type: 'room.snapshot',
      revision: 5,
      snapshot: {
        ...restoredSnapshot(),
        room: {
          ...restoredSnapshot().room,
          revision: 5,
          status: 'finished',
        },
        messages: [
          {
            messageId: 'message-1',
            roomId: 'room-42',
            participantId: 'participant-host',
            body: 'Thanks for playing',
            status: 'sent',
            createdAt: '2026-05-20T00:04:50.000Z',
          },
        ],
      },
    });

    expect(await screen.findByText('Thanks for playing')).toBeInTheDocument();
    expect(screen.getByText('状态：已结束')).toBeInTheDocument();
    expect(screen.getByText('连接：房间结束')).toBeInTheDocument();
    expect(screen.getByLabelText('发送消息')).toBeEnabled();
    expect(screen.getByRole('button', { name: '返回创建房间' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '返回创建房间' }));

    expect(screen.getByRole('region', { name: '创建房间' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/online');
  });
});
