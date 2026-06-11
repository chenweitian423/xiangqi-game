import { nanoid } from 'nanoid';

import { applyMove } from '../../../src/game/applyMove.js';
import { createInitialGameState } from '../../../src/game/initialState.js';
import { generateLegalMoves, getCheckSide, getWinner } from '../../../src/game/legality.js';
import type { GameState, Move, Side } from '../../../src/game/types.js';
import type { MatchRejectedReason, RoomMatch } from '../contracts.js';

type StoredMatch = RoomMatch;

type EnsureMatchInput = {
  roomId: string;
  redParticipantId: string;
  blackParticipantId: string;
};

type ApplyMoveInput = {
  roomId: string;
  participantId: string;
  revision: number;
  move: Move;
};

type AcceptedMoveResult = {
  accepted: true;
  match: RoomMatch;
};

type RejectedMoveResult = {
  accepted: false;
  reason: MatchRejectedReason;
  expectedRevision?: number;
  message: string;
};

export type MatchMoveResult = AcceptedMoveResult | RejectedMoveResult;

function hasKing(state: GameState, side: Side): boolean {
  return state.board.flat().some((piece) => piece?.side === side && piece.type === 'king');
}

function finalizeState(state: GameState): GameState {
  const winner = getWinner(state);
  const loser = winner ? (winner === 'red' ? 'black' : 'red') : null;

  return {
    ...state,
    check: getCheckSide(state),
    gameOver: winner
      ? {
          winner,
          reason: loser && hasKing(state, loser) ? 'no-legal-moves' : 'king-captured',
        }
      : null,
  };
}

function cloneMatch(match: StoredMatch): RoomMatch {
  return {
    ...match,
    state: {
      ...match.state,
      board: match.state.board.map((row) => row.map((piece) => (piece ? { ...piece, position: { ...piece.position } } : null))),
      moveHistory: match.state.moveHistory.map((move) => ({
        ...move,
        from: { ...move.from },
        to: { ...move.to },
        ...(move.captured ? { captured: { ...move.captured, position: { ...move.captured.position } } } : {}),
      })),
      captured: {
        red: match.state.captured.red.map((piece) => ({ ...piece, position: { ...piece.position } })),
        black: match.state.captured.black.map((piece) => ({ ...piece, position: { ...piece.position } })),
      },
      lastMove: match.state.lastMove
        ? {
            ...match.state.lastMove,
            from: { ...match.state.lastMove.from },
            to: { ...match.state.lastMove.to },
            ...(match.state.lastMove.captured
              ? {
                  captured: {
                    ...match.state.lastMove.captured,
                    position: { ...match.state.lastMove.captured.position },
                  },
                }
              : {}),
          }
        : null,
      legalTargets: match.state.legalTargets.map((position) => ({ ...position })),
      gameOver: match.state.gameOver ? { ...match.state.gameOver } : null,
    },
  };
}

export function createMatchService() {
  const matchesByRoomId = new Map<string, StoredMatch>();

  return {
    ensureMatch(input: EnsureMatchInput): RoomMatch {
      const existing = matchesByRoomId.get(input.roomId);
      if (existing) {
        return cloneMatch(existing);
      }

      const match: StoredMatch = {
        matchId: `match_${nanoid(10)}`,
        roomId: input.roomId,
        revision: 0,
        state: createInitialGameState(),
        redParticipantId: input.redParticipantId,
        blackParticipantId: input.blackParticipantId,
        winner: null,
      };

      matchesByRoomId.set(input.roomId, match);
      return cloneMatch(match);
    },

    getMatch(roomId: string): RoomMatch | null {
      const match = matchesByRoomId.get(roomId);
      return match ? cloneMatch(match) : null;
    },

    applyMove(input: ApplyMoveInput): MatchMoveResult {
      const storedMatch = matchesByRoomId.get(input.roomId);

      if (!storedMatch) {
        return {
          accepted: false,
          reason: 'match_not_ready',
          message: 'The match is not ready yet.',
        };
      }

      if (input.revision !== storedMatch.revision) {
        return {
          accepted: false,
          reason: 'stale_revision',
          expectedRevision: storedMatch.revision,
          message: 'Your move was based on an old board state.',
        };
      }

      const participantSide =
        input.participantId === storedMatch.redParticipantId
          ? 'red'
          : input.participantId === storedMatch.blackParticipantId
            ? 'black'
            : null;

      if (participantSide === null) {
        return {
          accepted: false,
          reason: 'spectator',
          message: 'Spectators cannot submit moves.',
        };
      }

      if (storedMatch.state.currentSide !== participantSide) {
        return {
          accepted: false,
          reason: 'out_of_turn',
          message: 'It is not your turn.',
        };
      }

      const legalMove = generateLegalMoves(storedMatch.state, input.move.pieceId).find(
        (candidate) =>
          candidate.id === input.move.id ||
          (candidate.from.row === input.move.from.row &&
            candidate.from.col === input.move.from.col &&
            candidate.to.row === input.move.to.row &&
            candidate.to.col === input.move.to.col &&
            candidate.pieceId === input.move.pieceId),
      );

      if (!legalMove) {
        return {
          accepted: false,
          reason: 'illegal_move',
          expectedRevision: storedMatch.revision,
          message: 'That move is not legal in the current position.',
        };
      }

      const nextState = finalizeState(applyMove(storedMatch.state, legalMove));
      const nextMatch: StoredMatch = {
        ...storedMatch,
        revision: storedMatch.revision + 1,
        state: nextState,
        winner: nextState.gameOver?.winner ?? null,
      };

      matchesByRoomId.set(input.roomId, nextMatch);

      return {
        accepted: true,
        match: cloneMatch(nextMatch),
      };
    },
  };
}

export type MatchService = ReturnType<typeof createMatchService>;
