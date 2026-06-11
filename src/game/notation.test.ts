import { describe, expect, it } from 'vitest';
import type { Move } from './types';
import { formatMove } from './notation';

describe('formatMove', () => {
  it('formats a red cannon horizontal move in compact notation', () => {
    const move: Move = {
      id: 'red-cannon:7,1-7,4',
      pieceId: 'red-cannon-1',
      pieceType: 'cannon',
      side: 'red',
      from: { row: 7, col: 1 },
      to: { row: 7, col: 4 },
    };

    expect(formatMove(move)).toBe('炮八平五');
  });

  it('formats a red pawn forward move using distance', () => {
    const move: Move = {
      id: 'red-pawn:6,0-5,0',
      pieceId: 'red-pawn-1',
      pieceType: 'pawn',
      side: 'red',
      from: { row: 6, col: 0 },
      to: { row: 5, col: 0 },
    };

    expect(formatMove(move)).toBe('兵九进一');
  });

  it('formats a black horse move using destination file', () => {
    const move: Move = {
      id: 'black-horse:0,1-2,2',
      pieceId: 'black-horse-1',
      pieceType: 'horse',
      side: 'black',
      from: { row: 0, col: 1 },
      to: { row: 2, col: 2 },
    };

    expect(formatMove(move)).toBe('马二进三');
  });
});
