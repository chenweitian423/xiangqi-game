import { describe, expect, it } from 'vitest';

import { applyMatchMove, createRoomSnapshot, createRoomState, joinRoomState } from './roomState';

describe('cloudflare room state', () => {
  it('creates a host room and starts the match when the guest joins', async () => {
    const created = await createRoomState({
      shortCode: 'ABCD12',
      nickname: 'Host Player',
      password: 'secret',
      now: () => '2026-05-21T10:00:00.000Z',
      randomId: (prefix) => `${prefix}-1`,
      randomToken: () => 'host-token',
    });

    expect(created.room.room.status).toBe('waiting');
    expect(created.callerToken).toBe('host-token');
    expect(created.room.password).not.toBeNull();

    const joined = await joinRoomState(created.room, {
      nickname: 'Guest Player',
      password: 'secret',
      now: () => '2026-05-21T10:05:00.000Z',
      randomId: (prefix) => `${prefix}-2`,
      randomToken: () => 'guest-token',
    });

    expect(joined.room.room.status).toBe('active');
    expect(joined.room.match?.redParticipantId).toBe('participant-1');
    expect(joined.room.match?.blackParticipantId).toBe('participant-2');
    expect(joined.callerToken).toBe('guest-token');
    expect(createRoomSnapshot(joined.room).match?.matchId).toBe('match-2');
  });

  it('rejects stale revisions for authoritative moves', async () => {
    const created = await createRoomState({
      shortCode: 'ABCD12',
      nickname: 'Host Player',
      now: () => '2026-05-21T10:00:00.000Z',
      randomId: (prefix) => `${prefix}-1`,
      randomToken: () => 'host-token',
    });
    const joined = await joinRoomState(created.room, {
      nickname: 'Guest Player',
      now: () => '2026-05-21T10:05:00.000Z',
      randomId: (prefix) => `${prefix}-2`,
      randomToken: () => 'guest-token',
    });

    const move = joined.room.match?.state.moveHistory[0];
    expect(move).toBeUndefined();

    const result = applyMatchMove(
      joined.room,
      'participant-1',
      4,
      {
        id: 'fake',
        pieceId: 'red-rook-1',
        from: { row: 9, col: 0 },
        to: { row: 8, col: 0 },
      },
      '2026-05-21T10:06:00.000Z',
    );

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason).toBe('stale_revision');
      expect(result.expectedRevision).toBe(0);
    }
  });
});
