import { getAllPieces } from '../game/initialState';
import type { GameState, Piece, PieceType } from '../game/types';

const PIECE_VALUES: Record<PieceType, number> = {
  king: 10000,
  rook: 500,
  cannon: 350,
  horse: 300,
  elephant: 150,
  advisor: 150,
  pawn: 80,
};

const PAWN_RIVER_BONUS = 30;

function hasPawnCrossedRiver(piece: Piece): boolean {
  return piece.side === 'red' ? piece.position.row <= 4 : piece.position.row >= 5;
}

function scorePiece(piece: Piece): number {
  const bonus = piece.type === 'pawn' && hasPawnCrossedRiver(piece) ? PAWN_RIVER_BONUS : 0;
  const score = PIECE_VALUES[piece.type] + bonus;

  return piece.side === 'black' ? score : -score;
}

export function evaluatePosition(state: GameState): number {
  return getAllPieces(state).reduce((score, piece) => score + scorePiece(piece), 0);
}
