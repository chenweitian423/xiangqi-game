import type { Move, PieceType, Side } from './types';

const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const pieceLabels: Record<Side, Record<PieceType, string>> = {
  red: {
    king: '帅',
    advisor: '仕',
    elephant: '相',
    horse: '马',
    rook: '车',
    cannon: '炮',
    pawn: '兵',
  },
  black: {
    king: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    rook: '车',
    cannon: '炮',
    pawn: '卒',
  },
};

function fileNumber(side: Side, col: number): string {
  return side === 'red' ? numerals[8 - col] : numerals[col];
}

function stepNumber(distance: number): string {
  return numerals[Math.max(0, distance - 1)] ?? String(distance);
}

function isForward(move: Move): boolean {
  return move.side === 'red' ? move.to.row < move.from.row : move.to.row > move.from.row;
}

function usesDestinationFile(pieceType: PieceType): boolean {
  return pieceType === 'horse' || pieceType === 'advisor' || pieceType === 'elephant';
}

export function formatMove(move: Move): string {
  const piece = pieceLabels[move.side][move.pieceType];
  const fromFile = fileNumber(move.side, move.from.col);

  if (move.from.row === move.to.row) {
    return `${piece}${fromFile}平${fileNumber(move.side, move.to.col)}`;
  }

  const action = isForward(move) ? '进' : '退';

  if (usesDestinationFile(move.pieceType)) {
    return `${piece}${fromFile}${action}${fileNumber(move.side, move.to.col)}`;
  }

  return `${piece}${fromFile}${action}${stepNumber(Math.abs(move.to.row - move.from.row))}`;
}
