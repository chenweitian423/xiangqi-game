export type Side = 'red' | 'black';
export type PieceType = 'king' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'pawn';
export type AiDifficulty = 'easy' | 'normal' | 'hard';

export type Position = { row: number; col: number };

export type Piece = {
  id: string;
  side: Side;
  type: PieceType;
  position: Position;
};

export type Move = {
  id: string;
  pieceId: string;
  pieceType: PieceType;
  side: Side;
  from: Position;
  to: Position;
  captured?: Piece;
  givesCheck?: boolean;
  notation?: string;
};

export type GameOver = {
  winner: Side;
  reason: 'checkmate' | 'king-captured' | 'no-legal-moves';
};

export type GameState = {
  board: Array<Array<Piece | null>>;
  currentSide: Side;
  playerSide: Side;
  openingSide: Side;
  moveHistory: Move[];
  captured: Record<Side, Piece[]>;
  lastMove: Move | null;
  selectedPieceId: string | null;
  legalTargets: Position[];
  check: Side | null;
  gameOver: GameOver | null;
  aiDifficulty: AiDifficulty;
};

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function inBounds(position: Position): boolean {
  return position.row >= 0 && position.row < BOARD_ROWS && position.col >= 0 && position.col < BOARD_COLS;
}

export function oppositeSide(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}
