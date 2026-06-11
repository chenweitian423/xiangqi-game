import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  createInitialGameState,
  getAllPieces,
  getPieceAt,
  placePieces,
} from './initialState';
import type { Piece } from './types';

function piece(id: string, row: number, col: number): Piece {
  return {
    id,
    side: 'red',
    type: 'pawn',
    position: { row, col },
  };
}

describe('initial xiangqi state', () => {
  it('creates a 10 by 9 board with red to move first', () => {
    const state = createInitialGameState();
    expect(state.board).toHaveLength(10);
    expect(state.board.every((row) => row.length === 9)).toBe(true);
    expect(state.currentSide).toBe('red');
  });

  it('places kings and corner rooks in standard positions', () => {
    const state = createInitialGameState();
    expect(getPieceAt(state, { row: 9, col: 4 })?.type).toBe('king');
    expect(getPieceAt(state, { row: 0, col: 4 })?.type).toBe('king');
    expect(getPieceAt(state, { row: 9, col: 0 })?.type).toBe('rook');
    expect(getPieceAt(state, { row: 0, col: 8 })?.type).toBe('rook');
  });

  it('starts with no captures, no selected piece, and no game over', () => {
    const state = createInitialGameState();
    expect(state.captured.red).toEqual([]);
    expect(state.captured.black).toEqual([]);
    expect(state.selectedPieceId).toBeNull();
    expect(state.gameOver).toBeNull();
  });

  it('starts with 32 pieces with unique ids', () => {
    const pieces = getAllPieces(createInitialGameState());
    const ids = pieces.map((currentPiece) => currentPiece.id);

    expect(pieces).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
  });

  it('returns all pieces currently on the board', () => {
    const state = createInitialGameState();
    const pieces = getAllPieces(state);

    expect(pieces).toContain(getPieceAt(state, { row: 9, col: 4 }));
    expect(pieces).toContain(getPieceAt(state, { row: 0, col: 4 }));
    expect(pieces.every((currentPiece) => currentPiece !== null)).toBe(true);
  });

  it('creates empty board rows that can change independently', () => {
    const board = createEmptyBoard();
    board[0][0] = piece('red-pawn-test', 0, 0);

    expect(board[1][0]).toBeNull();
  });

  it('returns null when reading outside the board', () => {
    const state = createInitialGameState();

    expect(getPieceAt(state, { row: -1, col: 0 })).toBeNull();
    expect(getPieceAt(state, { row: 10, col: 0 })).toBeNull();
    expect(getPieceAt(state, { row: 0, col: -1 })).toBeNull();
    expect(getPieceAt(state, { row: 0, col: 9 })).toBeNull();
  });

  it('creates independent pieces for separate initial game states', () => {
    const first = createInitialGameState();
    const second = createInitialGameState();
    const firstKing = getPieceAt(first, { row: 9, col: 4 });
    const secondKing = getPieceAt(second, { row: 9, col: 4 });

    expect(firstKing).not.toBe(secondKing);
    expect(firstKing?.position).not.toBe(secondKing?.position);

    if (firstKing) {
      firstKing.position.row = 8;
    }

    expect(secondKing?.position).toEqual({ row: 9, col: 4 });
  });

  it('throws when placing a piece outside the board', () => {
    expect(() => placePieces([piece('invalid-pawn', -1, 0)])).toThrow(/out of bounds/i);
  });

  it('throws when two pieces occupy the same position', () => {
    expect(() => placePieces([piece('red-pawn-1', 0, 0), piece('red-pawn-2', 0, 0)])).toThrow(/duplicate/i);
  });
});
