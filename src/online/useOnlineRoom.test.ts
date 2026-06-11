import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitialGameState } from '../game/initialState';
import { useOnlineRoom } from './hooks/useOnlineRoom';
import type { ClientSocketEvent, RoomSnapshot, ServerSocketEvent } from './types';

type MockSocket = {
  sent: ClientSocketEvent[];
  emit: (event: ServerSocketEvent) => void;
  close: () => void;
};

function createSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    room: {
      roomId: 'room-42',
      shortCode: 'ABCD12',
      revision: 3,
      status: 'active',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:05:00.000Z',
      expiresAt: '2026-05-27T10:05:00.000Z',
      lastActiveAt: '2026-05-20T10:05:00.000Z',
      activeMatchId: 'match-42',
    },
    participants: [
      {
        participantId: 'participant-red',
        roomId: 'room-42',
        displayName: 'Red',
        role: 'host',
        seat: 'red',
        status: 'connected',
        joinedAt: '2026-05-20T10:00:00.000Z',
        leftAt: null,
      },
      {
        participantId: 'participant-black',
        roomId: 'room-42',
        displayName: 'Black',
        role: 'guest',
        seat: 'black',
        status: 'connected',
        joinedAt: '2026-05-20T10:01:00.000Z',
        leftAt: null,
      },
    ],
    seats: [
      { seat: 'red', status: 'occupied', participantId: 'participant-red' },
      { seat: 'black', status: 'occupied', participantId: 'participant-black' },
    ],
    messages: [],
    match: {
      matchId: 'match-42',
      roomId: 'room-42',
      revision: 3,
      state: createInitialGameState(),
      redParticipantId: 'participant-red',
      blackParticipantId: 'participant-black',
      winner: null,
    },
    ...overrides,
  };
}

function createSocketPair() {
  let listener: ((event: ServerSocketEvent) => void) | null = null;

  const socket: MockSocket = {
    sent: [],
    emit(event) {
      listener?.(event);
    },
    close: vi.fn(),
  };

  return {
    socket,
    connect: vi.fn(() => ({
      send(event: ClientSocketEvent) {
        socket.sent.push(event);
      },
      subscribe(next: (event: ServerSocketEvent) => void) {
        listener = next;
        return () => {
          listener = null;
        };
      },
      close: socket.close,
    })),
  };
}

describe('useOnlineRoom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from the initial room snapshot', async () => {
    const { socket, connect } = createSocketPair();
    const snapshot = createSnapshot();

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        participantId: 'participant-red',
        token: 'token-red',
        connect,
      }),
    );

    act(() => {
      socket.emit({
        type: 'room.snapshot',
        revision: snapshot.room.revision,
        snapshot,
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.match.matchId).toBe('match-42');
    });
    expect(result.current.connectionState).toBe('connected');
    expect(socket.sent[0]).toEqual({
      type: 'room.join',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      displayName: 'Red',
      token: 'token-red',
    });
  });

  it('applies a live match.updated event', async () => {
    const { socket, connect } = createSocketPair();
    const snapshot = createSnapshot();

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        participantId: 'participant-red',
        token: 'token-red',
        connect,
      }),
    );

    act(() => {
      socket.emit({
        type: 'room.snapshot',
        revision: snapshot.room.revision,
        snapshot,
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot).not.toBeNull();
    });

    const updatedSnapshot = createSnapshot({
      match: {
        ...snapshot.match,
        revision: snapshot.match.revision + 1,
        state: {
          ...snapshot.match.state,
          currentSide: 'black',
        },
      },
    });

    act(() => {
      socket.emit({
        type: 'match.updated',
        revision: updatedSnapshot.match.revision,
        match: updatedSnapshot.match,
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.match.revision).toBe(snapshot.match.revision + 1);
    });
    expect(result.current.snapshot?.match.state.currentSide).toBe('black');
  });

  it('appends incoming chat events and sends outgoing chat messages', async () => {
    const { socket, connect } = createSocketPair();
    const snapshot = createSnapshot({
      messages: [
        {
          messageId: 'message-1',
          roomId: 'room-42',
          participantId: 'participant-red',
          body: 'Opening hello',
          status: 'sent',
          createdAt: '2026-05-20T10:00:10.000Z',
        },
      ],
    });

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'River Watcher',
        participantId: 'participant-spectator',
        token: 'token-spectator',
        connect,
      }),
    );

    act(() => {
      socket.emit({
        type: 'room.snapshot',
        revision: snapshot.room.revision,
        snapshot,
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.messages).toHaveLength(1);
    });

    act(() => {
      socket.emit({
        type: 'room.chat.posted',
        revision: 4,
        message: {
          messageId: 'message-2',
          roomId: 'room-42',
          participantId: 'participant-black',
          body: 'Reply from the table',
          status: 'sent',
          createdAt: '2026-05-20T10:00:20.000Z',
        },
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.messages).toHaveLength(2);
    });
    expect(result.current.snapshot?.room.revision).toBe(4);
    expect(result.current.snapshot?.messages[1]?.body).toBe('Reply from the table');

    act(() => {
      result.current.sendChatMessage('  Watching closely  ');
    });

    expect(socket.sent.at(-1)).toEqual({
      type: 'room.chat.send',
      body: 'Watching closely',
    });
  });

  it('triggers a resync when match.rejected arrives', async () => {
    const { socket, connect } = createSocketPair();
    const snapshot = createSnapshot();

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        participantId: 'participant-red',
        token: 'token-red',
        connect,
      }),
    );

    act(() => {
      socket.emit({
        type: 'room.snapshot',
        revision: snapshot.room.revision,
        snapshot,
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.match.revision).toBe(3);
    });

    act(() => {
      socket.emit({
        type: 'match.rejected',
        revision: 4,
        reason: 'stale_revision',
        expectedRevision: 4,
        message: 'Your move was based on an old board state.',
      });
    });

    await waitFor(() => {
      expect(result.current.needsResync).toBe(true);
    });
    expect(result.current.error).toBe('Your move was based on an old board state.');

    await waitFor(() => {
      expect(socket.sent).toHaveLength(2);
    });
    expect(socket.sent[1]).toEqual({
      type: 'room.join',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      displayName: 'Red',
      token: 'token-red',
    });

    const refreshedSnapshot = createSnapshot({
      room: {
        ...snapshot.room,
        revision: 4,
        updatedAt: '2026-05-20T10:06:00.000Z',
      },
      match: {
        ...snapshot.match,
        revision: 4,
      },
    });

    act(() => {
      socket.emit({
        type: 'room.snapshot',
        revision: refreshedSnapshot.room.revision,
        snapshot: refreshedSnapshot,
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.match.revision).toBe(4);
    });
    expect(result.current.needsResync).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not open a websocket join until the required room token is present', () => {
    const { connect } = createSocketPair();

    renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        enabled: true,
        token: undefined,
        connect,
      }),
    );

    expect(connect).not.toHaveBeenCalled();
  });

  it('disconnects instead of sending another join when the room token disappears', async () => {
    const { socket, connect } = createSocketPair();

    const { rerender } = renderHook(
      ({ token }: { token?: string }) =>
        useOnlineRoom({
          roomId: 'room-42',
          shortCode: 'ABCD12',
          displayName: 'Red',
          participantId: 'participant-red',
          token,
          connect,
        }),
      {
        initialProps: { token: 'token-red' },
      },
    );

    await waitFor(() => {
      expect(connect).toHaveBeenCalledTimes(1);
    });
    expect(socket.sent).toHaveLength(1);

    rerender({ token: undefined });

    await waitFor(() => {
      expect(connect).toHaveBeenCalledTimes(1);
    });
    expect(socket.sent).toHaveLength(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it('shows reconnecting before the first restored snapshot arrives', async () => {
    const { connect } = createSocketPair();

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        participantId: 'participant-red',
        token: 'token-red',
        connect,
      }),
    );

    await waitFor(() => {
      expect(connect).toHaveBeenCalledTimes(1);
    });

    expect(result.current.connectionState).toBe('reconnecting');
  });

  it('marks the room as expired when the server reports unavailability', async () => {
    const { socket, connect } = createSocketPair();

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        participantId: 'participant-red',
        token: 'token-red',
        connect,
      }),
    );

    act(() => {
      socket.emit({
        type: 'room.error',
        code: 'room-unavailable',
        message: 'This room has expired.',
      });
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('roomExpired');
    });
    expect(result.current.error).toBe('This room has expired.');
  });

  it('marks the room as ended when the authoritative snapshot is finished', async () => {
    const { socket, connect } = createSocketPair();
    const snapshot = createSnapshot({
      room: {
        roomId: 'room-42',
        shortCode: 'ABCD12',
        revision: 5,
        status: 'finished',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:10:00.000Z',
        expiresAt: '2026-05-27T10:10:00.000Z',
        lastActiveAt: '2026-05-20T10:10:00.000Z',
        activeMatchId: 'match-42',
      },
      match: {
        ...createSnapshot().match,
        revision: 5,
        winner: 'red',
        state: {
          ...createSnapshot().match.state,
          gameOver: {
            winner: 'red',
            reason: 'checkmate',
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useOnlineRoom({
        roomId: 'room-42',
        shortCode: 'ABCD12',
        displayName: 'Red',
        participantId: 'participant-red',
        token: 'token-red',
        connect,
      }),
    );

    act(() => {
      socket.emit({
        type: 'room.snapshot',
        revision: snapshot.room.revision,
        snapshot,
      });
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('roomEnded');
    });
    expect(result.current.snapshot?.room.status).toBe('finished');
  });
});
