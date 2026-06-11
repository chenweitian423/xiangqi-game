import { describe, expect, it } from 'vitest';

import { createPresenceService } from './presenceService.js';
import { createRoomService, RoomNotFoundError } from './roomService.js';

function createService(now = '2026-05-20T10:00:00.000Z') {
  let currentNow = now;

  const service = createRoomService({
    shortCodeLength: 6,
    bcryptSaltRounds: 1,
    presenceService: createPresenceService({
      now: () => currentNow,
    }),
    now: () => currentNow,
  });

  return {
    service,
    setNow(nextNow: string) {
      currentNow = nextNow;
    },
  };
}

describe('roomService', () => {
  it('expires waiting rooms after 24 hours without meaningful activity', async () => {
    const { service, setNow } = createService();
    const created = await service.createRoom({
      nickname: 'Host Player',
    });

    setNow('2026-05-21T10:00:00.001Z');

    expect(() => service.getRoom(created.room.shortCode, created.callerToken)).toThrow(
      RoomNotFoundError,
    );
  });

  it('keeps active rooms available for up to 7 days since the last meaningful activity', async () => {
    const { service, setNow } = createService();
    const created = await service.createRoom({
      nickname: 'Host Player',
    });

    setNow('2026-05-20T11:00:00.000Z');
    const joined = await service.joinRoom({
      shortCode: created.room.shortCode,
      nickname: 'Guest Player',
    });

    setNow('2026-05-27T10:59:59.999Z');
    expect(service.getRoom(created.room.shortCode, joined.callerToken).room.status).toBe('active');

    setNow('2026-05-27T11:00:00.001Z');
    expect(() => service.getRoom(created.room.shortCode, joined.callerToken)).toThrow(
      RoomNotFoundError,
    );
  });

  it('reissues a valid token that restores the caller role for reconnects', async () => {
    const { service } = createService();
    const created = await service.createRoom({
      nickname: 'Host Player',
    });
    const joined = await service.joinRoom({
      shortCode: created.room.shortCode,
      nickname: 'Guest Player',
    });

    const rejoined = await service.joinRoom({
      shortCode: created.room.shortCode,
      nickname: 'Guest Player Renamed',
      callerToken: joined.callerToken,
    });

    expect(rejoined.callerRole).toBe('guest');
    expect(rejoined.callerToken).toEqual(expect.any(String));
    expect(rejoined.callerToken).not.toBe(joined.callerToken);
    expect(service.getRoom(created.room.shortCode, rejoined.callerToken).callerRole).toBe('guest');
  });

  it('treats an expired room as unavailable for reconnect attempts', async () => {
    const { service, setNow } = createService();
    const created = await service.createRoom({
      nickname: 'Host Player',
    });

    setNow('2026-05-21T10:00:00.001Z');

    await expect(
      service.joinRoom({
        shortCode: created.room.shortCode,
        nickname: 'Host Player',
        callerToken: created.callerToken,
      }),
    ).rejects.toThrow(RoomNotFoundError);
  });
});
