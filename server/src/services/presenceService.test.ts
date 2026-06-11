import { describe, expect, it } from 'vitest';

import { createPresenceService } from './presenceService.js';

describe('presenceService', () => {
  it('reissues the active token while preserving the stored role record', () => {
    const service = createPresenceService();

    const firstToken = service.issueToken({
      participantId: 'participant-guest',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      role: 'guest',
    });

    const nextToken = service.issueToken({
      participantId: 'participant-guest',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      role: 'guest',
    });

    expect(nextToken).not.toBe(firstToken);
    expect(service.getRecord(firstToken)).toBeNull();
    expect(service.getRecord(nextToken)).toMatchObject({
      participantId: 'participant-guest',
      roomId: 'room-42',
      shortCode: 'ABCD12',
      role: 'guest',
    });
  });
});
