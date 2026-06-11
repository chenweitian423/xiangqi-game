import { BOARD_COLS, BOARD_ROWS, inBounds } from '../game/types';
import type { AiDifficulty, GameOver, GameState, Move, Piece, PieceType, Position, Side } from '../game/types';

const STORAGE_KEY = 'xiangqi-game-state';
const SIDES: Side[] = ['red', 'black'];
const PIECE_TYPES: PieceType[] = ['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'pawn'];
const AI_DIFFICULTIES: AiDifficulty[] = ['easy', 'normal', 'hard'];
const GAME_OVER_REASONS: GameOver['reason'][] = ['checkmate', 'king-captured', 'no-legal-moves'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSide(value: unknown): value is Side {
  return SIDES.includes(value as Side);
}

function isPieceType(value: unknown): value is PieceType {
  return PIECE_TYPES.includes(value as PieceType);
}

function isAiDifficulty(value: unknown): value is AiDifficulty {
  return AI_DIFFICULTIES.includes(value as AiDifficulty);
}

function isPosition(value: unknown): value is Position {
  if (!isRecord(value)) {
    return false;
  }

  const position = { row: value.row, col: value.col };
  return Number.isInteger(position.row) && Number.isInteger(position.col) && inBounds(position as Position);
}

function isPiece(value: unknown): value is Piece {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string' && isSide(value.side) && isPieceType(value.type) && isPosition(value.position);
}

function isMove(value: unknown): value is Move {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.pieceId === 'string' &&
    isPieceType(value.pieceType) &&
    isSide(value.side) &&
    isPosition(value.from) &&
    isPosition(value.to) &&
    (value.captured === undefined || isPiece(value.captured))
  );
}

function isPieceArray(value: unknown): value is Piece[] {
  return Array.isArray(value) && value.every(isPiece);
}

function isPositionArray(value: unknown): value is Position[] {
  return Array.isArray(value) && value.every(isPosition);
}

function isBoard(value: unknown): value is GameState['board'] {
  if (!Array.isArray(value) || value.length !== BOARD_ROWS) {
    return false;
  }

  return value.every((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== BOARD_COLS) {
      return false;
    }

    return row.every((entry, colIndex) => {
      if (entry === null) {
        return true;
      }

      return isPiece(entry) && entry.position.row === rowIndex && entry.position.col === colIndex;
    });
  });
}

function isCaptured(value: unknown): value is GameState['captured'] {
  return isRecord(value) && isPieceArray(value.red) && isPieceArray(value.black);
}

function isGameOver(value: unknown): value is GameOver | null {
  return (
    value === null ||
    (isRecord(value) && isSide(value.winner) && GAME_OVER_REASONS.includes(value.reason as GameOver['reason']))
  );
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBoard(value.board) &&
    isSide(value.currentSide) &&
    isSide(value.playerSide) &&
    isSide(value.openingSide) &&
    Array.isArray(value.moveHistory) &&
    value.moveHistory.every(isMove) &&
    isCaptured(value.captured) &&
    (value.lastMove === null || isMove(value.lastMove)) &&
    (value.selectedPieceId === null || typeof value.selectedPieceId === 'string') &&
    isPositionArray(value.legalTargets) &&
    (value.check === null || isSide(value.check)) &&
    isGameOver(value.gameOver) &&
    isAiDifficulty(value.aiDifficulty)
  );
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Saving is best-effort; gameplay should continue if browser storage is unavailable.
  }
}

export function loadGameState(): GameState | null {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (!savedState) {
      return null;
    }

    const parsedState: unknown = JSON.parse(savedState);

    return isGameState(parsedState) ? parsedState : null;
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing is best-effort; unavailable storage should not break the app.
  }
}
