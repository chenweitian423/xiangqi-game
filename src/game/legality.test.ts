import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt, placePieces } from './initialState';
import { applyMove } from './applyMove';
import { generateAllLegalMoves, generateLegalMoves, getCheckSide, getWinner, isInCheck } from './legality';
import type { GameState, Move, Piece } from './types';

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

function move(pieceToMove: Piece, row: number, col: number): Move {
  return {
    id: `${pieceToMove.id}:${pieceToMove.position.row},${pieceToMove.position.col}-${row},${col}`,
    pieceId: pieceToMove.id,
    pieceType: pieceToMove.type,
    side: pieceToMove.side,
    from: { ...pieceToMove.position },
    to: { row, col },
  };
}

describe('legality', () => {
  it('detects facing kings as check for both sides', () => {
    const state = stateWith([piece('black-king', 'black', 'king', 0, 4), piece('red-king', 'red', 'king', 9, 4)]);

    expect(isInCheck(state, 'red')).toBe(true);
    expect(isInCheck(state, 'black')).toBe(true);
    expect(getCheckSide(state)).toBe('red');
  });

  it('filters moves that leave own king in check', () => {
    const redKing = piece('red-king', 'red', 'king', 9, 4);
    const blackRook = piece('black-rook-test', 'black', 'rook', 0, 4);
    const redRook = piece('red-rook-test', 'red', 'rook', 5, 4);
    const state = stateWith([redKing, blackRook, redRook], 'red');

    const legalTargets = generateLegalMoves(state, redRook.id).map((legalMove) => legalMove.to);

    expect(legalTargets).toContainEqual({ row: 1, col: 4 });
    expect(legalTargets).not.toContainEqual({ row: 5, col: 3 });
    expect(legalTargets).not.toContainEqual({ row: 5, col: 5 });
  });

  it('generates all legal moves for the requested side without mutating state', () => {
    const state = createInitialGameState();
    const before = JSON.stringify(state);

    const moves = generateAllLegalMoves(state, 'red');

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((legalMove) => legalMove.side === 'red')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reports the winner when a king has been captured', () => {
    const state = stateWith([piece('red-king', 'red', 'king', 9, 4)], 'black');

    expect(isInCheck(state, 'black')).toBe(true);
    expect(getWinner(state)).toBe('red');
  });

  it('reports the opposite side as winner when the current side has no legal moves', () => {
    const trappedBlackKing = piece('black-king', 'black', 'king', 0, 4);
    const redLeftRook = piece('red-rook-left', 'red', 'rook', 1, 3);
    const redRightRook = piece('red-rook-right', 'red', 'rook', 1, 5);
    const redKing = piece('red-king', 'red', 'king', 9, 8);
    const state = stateWith([trappedBlackKing, redLeftRook, redRightRook, redKing], 'black');

    expect(generateAllLegalMoves(state, 'black')).toEqual([]);
    expect(getWinner(state)).toBe('red');
  });

  it('keeps a legal move from mutating the source state during filtering', () => {
    const state = createInitialGameState();
    const redPawn = getPieceAt(state, { row: 6, col: 4 });

    if (!redPawn) {
      throw new Error('Expected red pawn to exist');
    }

    const sourceAfterApply = applyMove(state, move(redPawn, 5, 4));

    expect(getPieceAt(state, { row: 6, col: 4 })?.id).toBe(redPawn.id);
    expect(sourceAfterApply).not.toBe(state);
  });
});
