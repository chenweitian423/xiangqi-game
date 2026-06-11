import { describe, expect, it } from 'vitest';
import { gameReducer } from './gameReducer';
import { createInitialGameState, getPieceAt, placePieces } from '../game/initialState';
import type { GameState, Move, Piece, Position } from '../game/types';

function piece(id: string, side: Piece['side'], type: Piece['type'], row: number, col: number): Piece {
  return {
    id,
    side,
    type,
    position: { row, col },
  };
}

function move(pieceToMove: Piece, to: Position, captured?: Piece): Move {
  return {
    id: `${pieceToMove.id}:${pieceToMove.position.row},${pieceToMove.position.col}-${to.row},${to.col}`,
    pieceId: pieceToMove.id,
    pieceType: pieceToMove.type,
    side: pieceToMove.side,
    from: { ...pieceToMove.position },
    to: { ...to },
    ...(captured ? { captured } : {}),
  };
}

function stateWith(pieces: Piece[], currentSide: Piece['side'] = 'red'): GameState {
  return {
    ...createInitialGameState(),
    board: placePieces(pieces),
    currentSide,
  };
}

describe('gameReducer', () => {
  it('selects a red piece and exposes legal targets', () => {
    const state = createInitialGameState();
    const next = gameReducer(state, { type: 'select-square', position: { row: 6, col: 4 } });
    expect(next.selectedPieceId).toBe('red-pawn-3');
    expect(next.legalTargets).toEqual([{ row: 5, col: 4 }]);
  });

  it('moves a selected piece to a legal target', () => {
    const selected = gameReducer(createInitialGameState(), { type: 'select-square', position: { row: 6, col: 4 } });
    const next = gameReducer(selected, { type: 'select-square', position: { row: 5, col: 4 } });
    expect(getPieceAt(next, { row: 5, col: 4 })).toMatchObject({ id: 'red-pawn-3', side: 'red' });
    expect(next.currentSide).toBe('black');
  });

  it('blocks player input when it is the computer turn', () => {
    const state = createInitialGameState({ openingSide: 'black' });
    const next = gameReducer(state, { type: 'select-square', position: { row: 6, col: 4 } });
    expect(next).toEqual(state);
    expect(next).not.toBe(state);
  });

  it('still lets the player control red pieces after choosing computer first', () => {
    const state = {
      ...createInitialGameState({ openingSide: 'black' }),
      currentSide: 'red' as const,
    };

    const next = gameReducer(state, { type: 'select-square', position: { row: 6, col: 4 } });
    expect(next.selectedPieceId).toBe('red-pawn-3');
  });

  it('applies black moves through apply-move for AI flow', () => {
    const state = createInitialGameState({ openingSide: 'black' });
    const blackPawn = getPieceAt(state, { row: 3, col: 4 });

    if (!blackPawn) {
      throw new Error('Expected black pawn to exist');
    }

    const next = gameReducer(state, { type: 'apply-move', move: move(blackPawn, { row: 4, col: 4 }) });
    expect(getPieceAt(next, { row: 4, col: 4 })).toMatchObject({ id: blackPawn.id, side: 'black' });
    expect(next.currentSide).toBe('red');
  });

  it('undoes a full round and preserves the computer-first opening', () => {
    const initial = createInitialGameState({ openingSide: 'black' });
    const blackOpen = getPieceAt(initial, { row: 3, col: 4 });
    const redReply = getPieceAt(initial, { row: 6, col: 4 });
    const blackFollow = piece('black-pawn-temp', 'black', 'pawn', 4, 4);

    if (!blackOpen || !redReply) {
      throw new Error('Expected opening pieces to exist');
    }

    const afterBlackOpen = gameReducer(initial, { type: 'apply-move', move: move(blackOpen, { row: 4, col: 4 }) });
    const afterRedReply = gameReducer(afterBlackOpen, { type: 'apply-move', move: move(redReply, { row: 5, col: 4 }) });
    const afterBlackFollow = gameReducer(afterRedReply, {
      type: 'apply-move',
      move: move({ ...blackFollow, id: afterRedReply.board[4][4]!.id }, { row: 5, col: 4 }, redReply),
    });

    const undone = gameReducer(afterBlackFollow, { type: 'undo-full-round' });
    expect(undone.openingSide).toBe('black');
    expect(undone.moveHistory).toHaveLength(1);
    expect(undone.currentSide).toBe('red');
  });

  it('undoes the single computer opening move', () => {
    const state = createInitialGameState({ openingSide: 'black' });
    const blackPawn = getPieceAt(state, { row: 3, col: 4 });

    if (!blackPawn) {
      throw new Error('Expected black pawn to exist');
    }

    const afterAiOpener = gameReducer(state, { type: 'apply-move', move: move(blackPawn, { row: 4, col: 4 }) });
    const undone = gameReducer(afterAiOpener, { type: 'undo-full-round' });

    expect(undone.moveHistory).toHaveLength(0);
    expect(undone.currentSide).toBe('black');
    expect(undone.playerSide).toBe('red');
    expect(undone.openingSide).toBe('black');
  });

  it('restarts and preserves opening side and difficulty', () => {
    const selected = gameReducer(createInitialGameState(), { type: 'set-opening-side', side: 'black' });
    const changedDifficulty = gameReducer(selected, { type: 'set-ai-difficulty', difficulty: 'hard' });
    const next = gameReducer(changedDifficulty, { type: 'restart' });

    expect(next).toEqual(createInitialGameState({ openingSide: 'black', aiDifficulty: 'hard' }));
  });

  it('switches opening side by starting a fresh game', () => {
    const next = gameReducer(createInitialGameState(), { type: 'set-opening-side', side: 'black' });
    expect(next.playerSide).toBe('red');
    expect(next.openingSide).toBe('black');
    expect(next.currentSide).toBe('black');
    expect(next.moveHistory).toHaveLength(0);
  });

  it('finalizes game over when a king is captured', () => {
    const redKing = piece('red-king', 'red', 'king', 9, 4);
    const redRook = piece('red-rook', 'red', 'rook', 1, 4);
    const blackKing = piece('black-king', 'black', 'king', 0, 4);
    const state = stateWith([redKing, redRook, blackKing]);

    const next = gameReducer(state, { type: 'apply-move', move: move(redRook, { row: 0, col: 4 }, blackKing) });
    expect(next.gameOver).toEqual({ winner: 'red', reason: 'king-captured' });
  });
});
