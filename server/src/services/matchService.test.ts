import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../../../src/game/initialState.js';
import { generateLegalMoves } from '../../../src/game/legality.js';
import type { Move } from '../../../src/game/types.js';
import { createMatchService } from './matchService.js';

function firstLegalMove(state = createInitialGameState()): Move {
  const [move] = generateLegalMoves(state, 'red-pawn-3');

  if (!move) {
    throw new Error('Expected a legal move for red-pawn-3');
  }

  return move;
}

describe('matchService', () => {
  it('accepts a legal move and increments the revision', () => {
    const service = createMatchService();
    const createdMatch = service.ensureMatch({
      roomId: 'room-42',
      redParticipantId: 'participant-red',
      blackParticipantId: 'participant-black',
    });

    const move = firstLegalMove(createdMatch.state);
    const result = service.applyMove({
      roomId: 'room-42',
      participantId: 'participant-red',
      revision: createdMatch.revision,
      move,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      throw new Error('Expected move to be accepted');
    }

    expect(result.match.revision).toBe(createdMatch.revision + 1);
    expect(result.match.state.currentSide).toBe('black');
    expect(result.match.state.lastMove).toEqual(move);
  });

  it('rejects stale revisions', () => {
    const service = createMatchService();
    const createdMatch = service.ensureMatch({
      roomId: 'room-42',
      redParticipantId: 'participant-red',
      blackParticipantId: 'participant-black',
    });
    const move = firstLegalMove(createdMatch.state);

    service.applyMove({
      roomId: 'room-42',
      participantId: 'participant-red',
      revision: createdMatch.revision,
      move,
    });

    const staleAttempt = service.applyMove({
      roomId: 'room-42',
      participantId: 'participant-red',
      revision: createdMatch.revision,
      move,
    });

    expect(staleAttempt).toMatchObject({
      accepted: false,
      reason: 'stale_revision',
      expectedRevision: createdMatch.revision + 1,
    });
  });

  it('rejects spectator moves', () => {
    const service = createMatchService();
    const createdMatch = service.ensureMatch({
      roomId: 'room-42',
      redParticipantId: 'participant-red',
      blackParticipantId: 'participant-black',
    });
    const move = firstLegalMove(createdMatch.state);

    const result = service.applyMove({
      roomId: 'room-42',
      participantId: 'participant-spectator',
      revision: createdMatch.revision,
      move,
    });

    expect(result).toMatchObject({
      accepted: false,
      reason: 'spectator',
    });
  });

  it('rejects out-of-turn moves', () => {
    const service = createMatchService();
    const createdMatch = service.ensureMatch({
      roomId: 'room-42',
      redParticipantId: 'participant-red',
      blackParticipantId: 'participant-black',
    });
    const move = firstLegalMove(createdMatch.state);

    const result = service.applyMove({
      roomId: 'room-42',
      participantId: 'participant-black',
      revision: createdMatch.revision,
      move,
    });

    expect(result).toMatchObject({
      accepted: false,
      reason: 'out_of_turn',
    });
  });
});
