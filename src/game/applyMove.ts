import { createInitialGameState } from './initialState';
import { inBounds, oppositeSide } from './types';
import type { GameState, Move, Piece, Position } from './types';

function clonePosition(position: Position): Position {
  return { row: position.row, col: position.col };
}

function clonePiece(piece: Piece): Piece {
  return {
    ...piece,
    position: clonePosition(piece.position),
  };
}

function cloneMove(move: Move): Move {
  return {
    ...move,
    from: clonePosition(move.from),
    to: clonePosition(move.to),
    ...(move.captured ? { captured: clonePiece(move.captured) } : {}),
  };
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((row) => row.map((piece) => (piece ? clonePiece(piece) : null))),
    moveHistory: state.moveHistory.map(cloneMove),
    captured: {
      red: state.captured.red.map(clonePiece),
      black: state.captured.black.map(clonePiece),
    },
    lastMove: state.lastMove ? cloneMove(state.lastMove) : null,
    legalTargets: state.legalTargets.map(clonePosition),
    gameOver: state.gameOver ? { ...state.gameOver } : null,
  };
}

export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneGameState(state);

  if (!inBounds(move.from) || !inBounds(move.to)) {
    return next;
  }

  const movingPiece = next.board[move.from.row]?.[move.from.col] ?? null;

  if (
    !movingPiece ||
    movingPiece.id !== move.pieceId ||
    movingPiece.side !== move.side ||
    movingPiece.type !== move.pieceType
  ) {
    return next;
  }

  const capturedPiece = next.board[move.to.row]?.[move.to.col] ?? null;

  if (capturedPiece?.side === movingPiece.side) {
    return next;
  }

  const movedPiece: Piece = {
    ...movingPiece,
    position: clonePosition(move.to),
  };
  const recordedMove: Move = {
    ...cloneMove(move),
    captured: capturedPiece ? clonePiece(capturedPiece) : undefined,
  };

  if (recordedMove.captured === undefined) {
    delete recordedMove.captured;
  }

  next.board[move.from.row][move.from.col] = null;
  next.board[move.to.row][move.to.col] = movedPiece;

  if (capturedPiece) {
    next.captured[capturedPiece.side].push(clonePiece(capturedPiece));
  }

  next.moveHistory.push(recordedMove);
  next.lastMove = cloneMove(recordedMove);
  next.currentSide = oppositeSide(move.side);
  next.selectedPieceId = null;
  next.legalTargets = [];

  return next;
}

export function undoFullRound(state: GameState): GameState {
  const movesToRemove = state.openingSide === 'black' && state.moveHistory.length === 1 ? 1 : 2;
  const movesToReplay = state.moveHistory.slice(0, Math.max(0, state.moveHistory.length - movesToRemove));

  return movesToReplay.reduce(
    (nextState, move) => applyMove(nextState, move),
    createInitialGameState({
      playerSide: state.playerSide,
      openingSide: state.openingSide,
      aiDifficulty: state.aiDifficulty,
    }),
  );
}
