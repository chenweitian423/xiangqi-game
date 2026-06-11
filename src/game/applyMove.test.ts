import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt, placePieces } from './initialState';
import { applyMove, cloneGameState, undoFullRound } from './applyMove';
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

function move(pieceToMove: Piece, row: number, col: number, captured?: Piece): Move {
  return {
    id: `${pieceToMove.id}:${pieceToMove.position.row},${pieceToMove.position.col}-${row},${col}`,
    pieceId: pieceToMove.id,
    pieceType: pieceToMove.type,
    side: pieceToMove.side,
    from: { ...pieceToMove.position },
    to: { row, col },
    ...(captured ? { captured } : {}),
  };
}

describe('applyMove', () => {
  it('moves a piece, switches side, and records the last move', () => {
    const redPawn = piece('red-pawn-test', 'red', 'pawn', 6, 4);
    const state = {
      ...stateWith([redPawn]),
      selectedPieceId: redPawn.id,
      legalTargets: [{ row: 5, col: 4 }],
    };
    const nextMove = move(redPawn, 5, 4);

    const next = applyMove(state, nextMove);

    expect(getPieceAt(next, { row: 6, col: 4 })).toBeNull();
    expect(getPieceAt(next, { row: 5, col: 4 })).toMatchObject({ id: redPawn.id, position: { row: 5, col: 4 } });
    expect(next.currentSide).toBe('black');
    expect(next.moveHistory).toEqual([nextMove]);
    expect(next.lastMove).toEqual(nextMove);
    expect(next.selectedPieceId).toBeNull();
    expect(next.legalTargets).toEqual([]);
    expect(getPieceAt(state, { row: 6, col: 4 })?.id).toBe(redPawn.id);
  });

  it('captures and records the captured piece under the captured side', () => {
    const redRook = piece('red-rook-test', 'red', 'rook', 6, 4);
    const blackPawn = piece('black-pawn-test', 'black', 'pawn', 5, 4);
    const state = stateWith([redRook, blackPawn]);

    const next = applyMove(state, move(redRook, 5, 4, blackPawn));

    expect(getPieceAt(next, { row: 5, col: 4 })).toMatchObject({ id: redRook.id, side: 'red' });
    expect(next.captured.black).toEqual([blackPawn]);
    expect(next.captured.red).toEqual([]);
    expect(next.moveHistory[0].captured).toEqual(blackPawn);
  });

  it('undoFullRound undoes one full player and AI round', () => {
    const initial = createInitialGameState();
    const redFirst = getPieceAt(initial, { row: 6, col: 4 });
    const blackReply = getPieceAt(initial, { row: 3, col: 4 });
    const redSecond = getPieceAt(initial, { row: 6, col: 0 });

    if (!redFirst || !blackReply || !redSecond) {
      throw new Error('Expected initial test pieces to exist');
    }

    const afterRedFirst = applyMove(initial, move(redFirst, 5, 4));
    const afterBlackReply = applyMove(afterRedFirst, move(blackReply, 4, 4));
    const afterRedSecond = applyMove(afterBlackReply, move(redSecond, 5, 0));

    const undone = undoFullRound(afterRedSecond);

    expect(undone.moveHistory.map((historyMove) => historyMove.id)).toEqual([afterRedFirst.moveHistory[0].id]);
    expect(getPieceAt(undone, { row: 5, col: 4 })?.id).toBe(redFirst.id);
    expect(getPieceAt(undone, { row: 4, col: 4 })).toBeNull();
    expect(getPieceAt(undone, { row: 6, col: 0 })?.id).toBe(redSecond.id);
    expect(undone.currentSide).toBe('black');
  });

  it('cloneGameState preserves independence for nested state', () => {
    const state = createInitialGameState();
    const redPawn = getPieceAt(state, { row: 6, col: 4 });

    if (!redPawn) {
      throw new Error('Expected red pawn to exist');
    }

    const moved = applyMove(state, move(redPawn, 5, 4));
    const clone = cloneGameState({
      ...moved,
      legalTargets: [{ row: 4, col: 4 }],
    });
    const clonedPawn = getPieceAt(clone, { row: 5, col: 4 });

    if (!clonedPawn || !clone.lastMove) {
      throw new Error('Expected cloned move state');
    }

    clonedPawn.position.row = 1;
    clone.moveHistory[0].to.row = 1;
    clone.lastMove.to.row = 2;
    clone.legalTargets[0].row = 3;

    expect(getPieceAt(moved, { row: 5, col: 4 })?.position.row).toBe(5);
    expect(moved.moveHistory[0].to.row).toBe(5);
    expect(moved.lastMove?.to.row).toBe(5);
  });

  it('returns an unchanged clone when the move does not match the board piece', () => {
    const state = createInitialGameState();
    const invalidMove: Move = {
      id: 'invalid',
      pieceId: 'missing-piece',
      pieceType: 'pawn',
      side: 'red',
      from: { row: 6, col: 4 },
      to: { row: 5, col: 4 },
    };

    const next = applyMove(state, invalidMove);

    expect(next).not.toBe(state);
    expect(next).toEqual(state);
  });

  it('advances the turn from the explicit move side even when currentSide differs', () => {
    const blackPawn = piece('black-pawn-explicit-side', 'black', 'pawn', 3, 4);
    const state = stateWith([blackPawn], 'red');

    const next = applyMove(state, move(blackPawn, 4, 4));

    expect(getPieceAt(next, { row: 4, col: 4 })).toMatchObject({ id: blackPawn.id, side: 'black' });
    expect(next.currentSide).toBe('red');
  });

  it('returns an unchanged clone when the destination is out of bounds', () => {
    const redPawn = piece('red-pawn-out-of-bounds', 'red', 'pawn', 6, 4);
    const state = stateWith([redPawn]);

    const next = applyMove(state, move(redPawn, 10, 4));

    expect(next).not.toBe(state);
    expect(next).toEqual(state);
    expect(next.board).toHaveLength(10);
    expect(next.board.every((row) => row.length === 9)).toBe(true);
  });

  it('returns an unchanged clone when the source is out of bounds', () => {
    const state = createInitialGameState();
    const invalidMove: Move = {
      id: 'invalid-source',
      pieceId: 'red-pawn-4',
      pieceType: 'pawn',
      side: 'red',
      from: { row: -1, col: 4 },
      to: { row: 5, col: 4 },
    };

    const next = applyMove(state, invalidMove);

    expect(next).not.toBe(state);
    expect(next).toEqual(state);
    expect(next.board).toHaveLength(10);
    expect(next.board.every((row) => row.length === 9)).toBe(true);
  });

  it('returns an unchanged clone when capturing an own piece', () => {
    const redRook = piece('red-rook-own-capture', 'red', 'rook', 6, 4);
    const redPawn = piece('red-pawn-own-capture', 'red', 'pawn', 5, 4);
    const state = stateWith([redRook, redPawn]);

    const next = applyMove(state, move(redRook, 5, 4, redPawn));

    expect(next).not.toBe(state);
    expect(next).toEqual(state);
  });

  it('returns an unchanged clone when move metadata does not match the board piece side', () => {
    const redPawn = piece('red-pawn-side-mismatch', 'red', 'pawn', 6, 4);
    const state = stateWith([redPawn]);
    const invalidMove: Move = {
      ...move(redPawn, 5, 4),
      side: 'black',
    };

    const next = applyMove(state, invalidMove);

    expect(next).not.toBe(state);
    expect(next).toEqual(state);
  });

  it('returns an unchanged clone when move metadata does not match the board piece type', () => {
    const redPawn = piece('red-pawn-type-mismatch', 'red', 'pawn', 6, 4);
    const state = stateWith([redPawn]);
    const invalidMove: Move = {
      ...move(redPawn, 5, 4),
      pieceType: 'rook',
    };

    const next = applyMove(state, invalidMove);

    expect(next).not.toBe(state);
    expect(next).toEqual(state);
  });
});
