import { describe, expect, it } from 'vitest';

import { createChatService } from './chatService.js';

describe('chatService', () => {
  it('stores room-scoped messages in created order', () => {
    const service = createChatService({
      now: () => '2026-05-20T10:00:00.000Z',
    });

    const firstMessage = service.postMessage({
      roomId: 'room-42',
      participantId: 'participant-host',
      body: 'Host says hello',
    });
    const secondMessage = service.postMessage({
      roomId: 'room-42',
      participantId: 'participant-guest',
      body: 'Guest replies',
    });
    service.postMessage({
      roomId: 'room-99',
      participantId: 'participant-other',
      body: 'Other room message',
    });

    expect(firstMessage.body).toBe('Host says hello');
    expect(secondMessage.body).toBe('Guest replies');
    expect(service.listMessages('room-42')).toEqual([firstMessage, secondMessage]);
  });

  it('allows spectator messages with no seat assignment', () => {
    const service = createChatService({
      now: () => '2026-05-20T10:00:00.000Z',
    });

    const message = service.postMessage({
      roomId: 'room-42',
      participantId: 'participant-spectator',
      body: 'Watching from the sidelines',
    });

    expect(message.participantId).toBe('participant-spectator');
    expect(service.listMessages('room-42')).toEqual([message]);
  });

  it('returns copies so callers cannot mutate stored room history', () => {
    const service = createChatService({
      now: () => '2026-05-20T10:00:00.000Z',
    });

    const message = service.postMessage({
      roomId: 'room-42',
      participantId: 'participant-host',
      body: 'Original body',
    });

    message.body = 'Changed by caller';
    const listedMessages = service.listMessages('room-42');
    listedMessages[0]!.body = 'Changed in list copy';

    expect(service.listMessages('room-42')).toEqual([
      expect.objectContaining({
        body: 'Original body',
      }),
    ]);
  });
});
