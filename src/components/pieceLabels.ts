import type { Piece, PieceType, Side } from '../game/types';

const redLabels: Record<PieceType, string> = {
  king: '帅',
  advisor: '仕',
  elephant: '相',
  horse: '马',
  rook: '车',
  cannon: '炮',
  pawn: '兵',
};

const blackLabels: Record<PieceType, string> = {
  king: '将',
  advisor: '士',
  elephant: '象',
  horse: '马',
  rook: '车',
  cannon: '炮',
  pawn: '卒',
};

export const sideNames: Record<Side, string> = {
  red: '红方',
  black: '黑方',
};

export function getPieceLabel(piece: Pick<Piece, 'side' | 'type'>): string {
  return piece.side === 'red' ? redLabels[piece.type] : blackLabels[piece.type];
}

export function getPieceName(piece: Pick<Piece, 'side' | 'type'>): string {
  return `${piece.side === 'red' ? '红' : '黑'}${getPieceLabel(piece)}`;
}
