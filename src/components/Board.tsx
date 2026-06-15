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

const boardLineCoordinates = {
  left: 0,
  right: 800,
  top: 0,
  bottom: 900,
  riverTop: 400,
  riverBottom: 500,
};

const markerPositions = [
  { row: 2, col: 1 },
  { row: 2, col: 7 },
  { row: 3, col: 0 },
  { row: 3, col: 2 },
  { row: 3, col: 4 },
  { row: 3, col: 6 },
  { row: 3, col: 8 },
  { row: 6, col: 0 },
  { row: 6, col: 2 },
  { row: 6, col: 4 },
  { row: 6, col: 6 },
  { row: 6, col: 8 },
  { row: 7, col: 1 },
  { row: 7, col: 7 },
];

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

function renderPositionMarker({ row, col }: Position) {
  const x = col * 100;
  const y = row * 100;
  const gap = 9;
  const length = 19;
  const quadrants = [
    col > 0 ? { key: 'tl', sx: -1, sy: -1 } : null,
    col < BOARD_COLS - 1 ? { key: 'tr', sx: 1, sy: -1 } : null,
    col > 0 ? { key: 'bl', sx: -1, sy: 1 } : null,
    col < BOARD_COLS - 1 ? { key: 'br', sx: 1, sy: 1 } : null,
  ].filter(Boolean) as { key: string; sx: 1 | -1; sy: 1 | -1 }[];

  return (
    <g key={`marker-${row}-${col}`} className="board-position-marker">
      {quadrants.map(({ key, sx, sy }) => {
        const innerX = x + sx * gap;
        const outerX = x + sx * (gap + length);
        const innerY = y + sy * gap;
        const outerY = y + sy * (gap + length);

        return (
          <path
            key={key}
            d={`M ${outerX} ${innerY} L ${innerX} ${innerY} M ${innerX} ${outerY} L ${innerX} ${innerY}`}
          />
        );
      })}
    </g>
  );
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
  const horizontalLines = Array.from({ length: BOARD_ROWS }, (_, row) => row * 100);
  const innerVerticalLines = Array.from({ length: BOARD_COLS - 2 }, (_, index) => (index + 1) * 100);

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
      <svg
        className="board-lines"
        viewBox="0 0 800 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {horizontalLines.map((y) => (
          <line
            key={`h-${y}`}
            className="board-horizontal-line"
            x1={boardLineCoordinates.left}
            y1={y}
            x2={boardLineCoordinates.right}
            y2={y}
          />
        ))}
        <line
          className="board-vertical-line board-side-vertical"
          x1={boardLineCoordinates.left}
          y1={boardLineCoordinates.top}
          x2={boardLineCoordinates.left}
          y2={boardLineCoordinates.bottom}
        />
        <line
          className="board-vertical-line board-side-vertical"
          x1={boardLineCoordinates.right}
          y1={boardLineCoordinates.top}
          x2={boardLineCoordinates.right}
          y2={boardLineCoordinates.bottom}
        />
        {innerVerticalLines.map((x) => (
          <g key={`v-${x}`}>
            <line
              className="board-vertical-line board-inner-vertical"
              x1={x}
              y1={boardLineCoordinates.top}
              x2={x}
              y2={boardLineCoordinates.riverTop}
            />
            <line
              className="board-vertical-line board-inner-vertical"
              x1={x}
              y1={boardLineCoordinates.riverBottom}
              x2={x}
              y2={boardLineCoordinates.bottom}
            />
          </g>
        ))}
        <line className="board-palace-line" x1="300" y1="0" x2="500" y2="200" />
        <line className="board-palace-line" x1="500" y1="0" x2="300" y2="200" />
        <line className="board-palace-line" x1="300" y1="700" x2="500" y2="900" />
        <line className="board-palace-line" x1="500" y1="700" x2="300" y2="900" />
        {markerPositions.map(renderPositionMarker)}
      </svg>
      <div className="board-river" aria-hidden="true">
        <span>楚</span>
        <span>河</span>
        <span>汉</span>
        <span>界</span>
      </div>
      <div className="xiangqi-board" aria-label="象棋棋盘">
        {squares}
      </div>
    </div>
  );
}
