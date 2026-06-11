import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt, placePieces } from './initialState';
import { generateAllPseudoLegalMoves, generatePseudoLegalMoves } from './moveGeneration';
import type { GameState, Piece } from './types';

function targetsFor(pieceId: string) {
  return generatePseudoLegalMoves(createInitialGameState(), pieceId).map((move) => move.to);
}

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

describe('pseudo legal move generation', () => {
  it('generates red pawn forward movement before crossing the river', () => {
    expect(targetsFor('red-pawn-3')).toContainEqual({ row: 5, col: 4 });
    expect(targetsFor('red-pawn-3')).not.toContainEqual({ row: 6, col: 3 });
  });

  it('generates black pawn forward movement before crossing the river', () => {
    expect(targetsFor('black-pawn-3')).toContainEqual({ row: 4, col: 4 });
    expect(targetsFor('black-pawn-3')).not.toContainEqual({ row: 3, col: 3 });
  });

  it('generates sideways pawn movement after crossing the river', () => {
    const state = stateWith([piece('red-pawn-test', 'red', 'pawn', 4, 4)]);

    expect(generatePseudoLegalMoves(state, 'red-pawn-test').map((move) => move.to)).toEqual(
      expect.arrayContaining([
        { row: 3, col: 4 },
        { row: 4, col: 3 },
        { row: 4, col: 5 },
      ]),
    );
  });

  it('blocks horse movement when the horse leg is occupied', () => {
    const state = stateWith([
      piece('red-horse-test', 'red', 'horse', 5, 5),
      piece('red-leg-blocker', 'red', 'pawn', 5, 4),
    ]);

    const moves = generatePseudoLegalMoves(state, 'red-horse-test').map((move) => move.to);
    expect(moves).toContainEqual({ row: 3, col: 4 });
    expect(moves).not.toContainEqual({ row: 4, col: 3 });
  });

  it('allows cannon capture only with one screen', () => {
    const state = stateWith([
      piece('red-cannon-test', 'red', 'cannon', 7, 1),
      piece('red-screen', 'red', 'pawn', 5, 1),
      piece('black-target', 'black', 'pawn', 3, 1),
      piece('black-hidden', 'black', 'horse', 0, 1),
    ]);

    const moves = generatePseudoLegalMoves(state, 'red-cannon-test').map((move) => move.to);
    expect(moves).toContainEqual({ row: 3, col: 1 });
    expect(moves).not.toContainEqual({ row: 0, col: 1 });
  });

  it('slides rooks until blocked and captures the first enemy in a line', () => {
    const state = stateWith([
      piece('red-rook-test', 'red', 'rook', 4, 4),
      piece('red-blocker', 'red', 'pawn', 4, 6),
      piece('black-target', 'black', 'pawn', 2, 4),
      piece('black-hidden', 'black', 'pawn', 1, 4),
    ]);

    const moves = generatePseudoLegalMoves(state, 'red-rook-test');
    const targets = moves.map((move) => move.to);

    expect(targets).toContainEqual({ row: 4, col: 5 });
    expect(targets).not.toContainEqual({ row: 4, col: 6 });
    expect(targets).toContainEqual({ row: 2, col: 4 });
    expect(targets).not.toContainEqual({ row: 1, col: 4 });
    expect(moves.find((move) => move.to.row === 2 && move.to.col === 4)?.captured?.id).toBe('black-target');
  });

  it('keeps elephants on their own side of the river', () => {
    const moves = targetsFor('red-elephant-1');
    expect(moves).toContainEqual({ row: 7, col: 0 });
    expect(moves).toContainEqual({ row: 7, col: 4 });
    expect(moves).not.toContainEqual({ row: 5, col: 0 });
  });

  it('blocks elephants when the eye is occupied', () => {
    const state = stateWith([
      piece('red-elephant-test', 'red', 'elephant', 9, 2),
      piece('red-eye-blocker', 'red', 'pawn', 8, 3),
    ]);

    expect(generatePseudoLegalMoves(state, 'red-elephant-test').map((move) => move.to)).not.toContainEqual({
      row: 7,
      col: 4,
    });
  });

  it('keeps king and advisors inside the palace', () => {
    expect(targetsFor('red-king')).toContainEqual({ row: 8, col: 4 });
    expect(targetsFor('red-king')).not.toContainEqual({ row: 9, col: 5 });
    expect(targetsFor('red-advisor-1')).toContainEqual({ row: 8, col: 4 });
    expect(targetsFor('red-advisor-1')).not.toContainEqual({ row: 8, col: 2 });
  });

  it('keeps black palace pieces inside the black palace', () => {
    expect(targetsFor('black-king')).toContainEqual({ row: 1, col: 4 });
    expect(targetsFor('black-advisor-1')).toContainEqual({ row: 1, col: 4 });
    expect(targetsFor('black-advisor-1')).not.toContainEqual({ row: 1, col: 2 });
  });

  it('generates moves for the requested side only', () => {
    const state = createInitialGameState();
    const redMoves = generateAllPseudoLegalMoves(state);

    expect(redMoves.length).toBeGreaterThan(0);
    expect(redMoves.every((move) => move.side === 'red')).toBe(true);
    expect(redMoves.some((move) => getPieceAt(state, move.from)?.id === move.pieceId)).toBe(true);
  });
});
