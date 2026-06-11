import { describe, expect, it } from 'vitest';
import { createInitialGameState, placePieces } from '../game/initialState';
import { evaluatePosition } from './evaluate';
import type { GameState, Piece } from '../game/types';

function piece(id: string, side: Piece['side'], type: Piece['type'], row: number, col: number): Piece {
  return {
    id,
    side,
    type,
    position: { row, col },
  };
}

function stateWith(pieces: Piece[], currentSide: Piece['side'] = 'red'): GameState {
  return {
    ...createInitialGameState(),
    board: placePieces(pieces),
    currentSide,
  };
}

describe('evaluatePosition', () => {
  it('scores the initial position as equal', () => {
    expect(evaluatePosition(createInitialGameState())).toBe(0);
  });

  it('scores material from the black perspective', () => {
    const state = stateWith([
      piece('black-king', 'black', 'king', 0, 4),
      piece('red-king', 'red', 'king', 9, 4),
      piece('black-rook', 'black', 'rook', 4, 4),
    ]);

    expect(evaluatePosition(state)).toBe(500);
  });

  it('applies pawn river bonuses symmetrically', () => {
    const state = stateWith([
      piece('black-king', 'black', 'king', 0, 4),
      piece('red-king', 'red', 'king', 9, 4),
      piece('black-crossed-pawn', 'black', 'pawn', 5, 0),
      piece('red-crossed-pawn', 'red', 'pawn', 4, 8),
      piece('black-home-pawn', 'black', 'pawn', 3, 2),
      piece('red-home-pawn', 'red', 'pawn', 6, 6),
    ]);

    expect(evaluatePosition(state)).toBe(0);
  });
});
