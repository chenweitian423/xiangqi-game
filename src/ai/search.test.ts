import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt, placePieces } from '../game/initialState';
import { applyMove } from '../game/applyMove';
import { generateAllLegalMoves } from '../game/legality';
import { chooseAiMove } from './search';
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

describe('chooseAiMove', () => {
  it('returns a legal black move from the initial position without mutating input', () => {
    const state = createInitialGameState();
    const before = JSON.stringify(state);
    const legalBlackMoveIds = new Set(generateAllLegalMoves(state, 'black').map((move) => move.id));

    const move = chooseAiMove(state);

    expect(move).not.toBeNull();
    expect(move?.side).toBe('black');
    expect(legalBlackMoveIds.has(move?.id ?? '')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('chooses an obvious high-value capture', () => {
    const blackKing = piece('black-king', 'black', 'king', 0, 4);
    const redKing = piece('red-king', 'red', 'king', 9, 4);
    const blackRook = piece('black-rook', 'black', 'rook', 4, 4);
    const redRook = piece('red-rook', 'red', 'rook', 4, 7);
    const redPawn = piece('red-pawn', 'red', 'pawn', 5, 4);
    const state = stateWith([blackKing, redKing, blackRook, redRook, redPawn], 'black');

    const move = chooseAiMove(state, 1);

    expect(move).toMatchObject({
      pieceId: blackRook.id,
      to: redRook.position,
      captured: { id: redRook.id },
    });
  });

  it('responds with a legal move when black is in check', () => {
    const blackKing = piece('black-king', 'black', 'king', 0, 4);
    const redKing = piece('red-king', 'red', 'king', 9, 8);
    const redRook = piece('red-rook', 'red', 'rook', 1, 4);
    const state = stateWith([blackKing, redKing, redRook], 'black');

    const move = chooseAiMove(state, 1);

    expect(move).not.toBeNull();
    expect(move?.side).toBe('black');
    expect(generateAllLegalMoves(state, 'black').map((legalMove) => legalMove.id)).toContain(move?.id);
    expect(getPieceAt(applyMove(state, move!), { row: move!.to.row, col: move!.to.col })?.side).toBe('black');
  });
});
