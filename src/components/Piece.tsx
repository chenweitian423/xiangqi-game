import type { Piece as GamePiece } from '../game/types';
import { getPieceLabel } from './pieceLabels';

export type PieceProps = {
  piece: GamePiece;
  selected: boolean;
  arriving?: boolean;
  checked?: boolean;
  className?: string;
};

export function Piece({ piece, selected, arriving = false, checked = false, className = '' }: PieceProps) {
  const classes = [
    'piece',
    `piece-${piece.side}`,
    selected ? 'piece-selected' : '',
    arriving ? 'piece-arriving' : '',
    checked ? 'piece-checked' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} aria-hidden="true">
      {getPieceLabel(piece)}
    </span>
  );
}
