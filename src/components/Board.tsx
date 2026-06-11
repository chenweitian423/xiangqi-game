import type { CSSProperties } from 'react';
import { BOARD_COLS, BOARD_ROWS, samePosition } from '../game/types';
import type { GameState, Move, Position } from '../game/types';
import type { Side } from '../game/types';
import { Piece } from './Piece';
import { getPieceName } from './pieceLabels';

export type BoardProps = {
  state: GameState;
  onSquareClick: (position: Position) => void;
  hintMove?: Move | null;
  disabled?: boolean;
  orientation?: Side;
};

function isPositionIn(list: Position[], position: Position): boolean {
  return list.some((entry) => samePosition(entry, position));
}

function getSquareLabel(position: Position, state: GameState): string {
  const piece = state.board[position.row][position.col];
  const row = position.row + 1;
  const col = position.col + 1;

  if (!piece) {
    return `空位 第${row}行 第${col}列`;
  }

  return `${getPieceName(piece)} 第${row}行 第${col}列`;
}

function pointStyle(position: Position, orientation: Side): CSSProperties {
  const displayRow = orientation === 'black' ? BOARD_ROWS - 1 - position.row : position.row;
  const displayCol = orientation === 'black' ? BOARD_COLS - 1 - position.col : position.col;

  return {
    left: `${(displayCol / (BOARD_COLS - 1)) * 100}%`,
    top: `${(displayRow / (BOARD_ROWS - 1)) * 100}%`,
  };
}

export function Board({
  state,
  onSquareClick,
  hintMove = null,
  disabled = false,
  orientation = 'red',
}: BoardProps) {
  const squares = [];
  const selectedPiece = state.selectedPieceId
    ? state.board.flat().find((piece) => piece?.id === state.selectedPieceId) ?? null
    : null;
  const capturedPiece = state.lastMove?.captured ?? null;

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const position = { row, col };
      const piece = state.board[row][col];
      const selected = piece?.id === state.selectedPieceId;
      const legalTarget = !disabled && isPositionIn(state.legalTargets, position);
      const captureTarget = Boolean(legalTarget && piece && selectedPiece && piece.side !== selectedPiece.side);
      const lastFrom = state.lastMove ? samePosition(state.lastMove.from, position) : false;
      const lastTo = state.lastMove ? samePosition(state.lastMove.to, position) : false;
      const checkedKing = Boolean(piece && piece.type === 'king' && state.check === piece.side);
      const hintFrom = Boolean(hintMove && samePosition(hintMove.from, position));
      const hintTo = Boolean(hintMove && samePosition(hintMove.to, position));
      const captureImpact = Boolean(capturedPiece && lastTo);
      const classes = [
        'board-square',
        disabled ? 'is-disabled' : '',
        selected ? 'is-selected' : '',
        legalTarget ? 'is-legal-target' : '',
        captureTarget ? 'is-capture-target' : '',
        lastFrom ? 'is-last-from' : '',
        lastTo ? 'is-last-to' : '',
        captureImpact ? 'is-capture-impact' : '',
        checkedKing ? 'is-checked-king' : '',
        hintFrom ? 'is-hint-from' : '',
        hintTo ? 'is-hint-to' : '',
      ]
        .filter(Boolean)
        .join(' ');

      squares.push(
        <button
          type="button"
          key={`${row}-${col}`}
          className={classes}
          style={pointStyle(position, orientation)}
          aria-label={getSquareLabel(position, state)}
          aria-pressed={selected}
          onClick={() => onSquareClick(position)}
          disabled={disabled}
        >
          {checkedKing ? <span className="check-ring" aria-hidden="true" /> : null}
          {captureImpact ? <span className="capture-burst" aria-hidden="true" /> : null}
          {piece ? (
            <Piece piece={piece} selected={selected} arriving={lastTo} checked={checkedKing} />
          ) : legalTarget ? (
            <span className="target-dot" />
          ) : null}
          {captureImpact && capturedPiece ? (
            <Piece piece={capturedPiece} selected={false} className="piece-captured-ghost" />
          ) : null}
          {captureTarget ? <span className="capture-ring" aria-hidden="true" /> : null}
          {hintTo ? <span className="hint-ring" aria-hidden="true" /> : null}
          {lastFrom ? (
            <span className="last-move-badge" aria-hidden="true">
              起
            </span>
          ) : null}
          {lastTo ? (
            <span className="last-move-badge" aria-hidden="true">
              到
            </span>
          ) : null}
        </button>,
      );
    }
  }

  return (
    <div className="board-wrap">
      <div className="board-lines" aria-hidden="true" />
      <div className="board-river" aria-hidden="true">
        <span>楚河</span>
        <span>汉界</span>
      </div>
      <div className="xiangqi-board" aria-label="象棋棋盘">
        {squares}
      </div>
    </div>
  );
}
