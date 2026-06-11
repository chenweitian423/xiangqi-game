import { BOARD_COLS, BOARD_ROWS, inBounds } from './types';
import type { GameState, Piece, PieceType, Position, Side } from './types';

const mainRowTypes: PieceType[] = [
  'rook',
  'horse',
  'elephant',
  'advisor',
  'king',
  'advisor',
  'elephant',
  'horse',
  'rook',
];

function createPiece(id: string, side: Side, type: PieceType, row: number, col: number): Piece {
  return {
    id,
    side,
    type,
    position: { row, col },
  };
}

function clonePiece(piece: Piece): Piece {
  return {
    ...piece,
    position: { ...piece.position },
  };
}

function createMainRow(side: Side, row: number): Piece[] {
  return mainRowTypes.map((type, col) => {
    const rank = col < 4 ? 1 : col > 4 ? 2 : '';
    return createPiece(`${side}-${type}${rank === '' ? '' : `-${rank}`}`, side, type, row, col);
  });
}

const initialPieces: Piece[] = [
  ...createMainRow('black', 0),
  createPiece('black-cannon-1', 'black', 'cannon', 2, 1),
  createPiece('black-cannon-2', 'black', 'cannon', 2, 7),
  createPiece('black-pawn-1', 'black', 'pawn', 3, 0),
  createPiece('black-pawn-2', 'black', 'pawn', 3, 2),
  createPiece('black-pawn-3', 'black', 'pawn', 3, 4),
  createPiece('black-pawn-4', 'black', 'pawn', 3, 6),
  createPiece('black-pawn-5', 'black', 'pawn', 3, 8),
  createPiece('red-pawn-1', 'red', 'pawn', 6, 0),
  createPiece('red-pawn-2', 'red', 'pawn', 6, 2),
  createPiece('red-pawn-3', 'red', 'pawn', 6, 4),
  createPiece('red-pawn-4', 'red', 'pawn', 6, 6),
  createPiece('red-pawn-5', 'red', 'pawn', 6, 8),
  createPiece('red-cannon-1', 'red', 'cannon', 7, 1),
  createPiece('red-cannon-2', 'red', 'cannon', 7, 7),
  ...createMainRow('red', 9),
];

export function createEmptyBoard(): GameState['board'] {
  return Array.from({ length: BOARD_ROWS }, () => Array.from<Piece | null>({ length: BOARD_COLS }).fill(null));
}

export function placePieces(pieces: Piece[]): GameState['board'] {
  const board = createEmptyBoard();

  for (const piece of pieces) {
    const { row, col } = piece.position;

    if (!inBounds(piece.position)) {
      throw new Error(`Cannot place piece ${piece.id} out of bounds at ${row},${col}`);
    }

    if (board[row][col] !== null) {
      throw new Error(`Cannot place piece ${piece.id} on duplicate occupied position ${row},${col}`);
    }

    board[row][col] = clonePiece(piece);
  }

  return board;
}

type InitialStateOptions = {
  playerSide?: Side;
  openingSide?: Side;
  aiDifficulty?: GameState['aiDifficulty'];
};

export function createInitialGameState(options: InitialStateOptions = {}): GameState {
  const playerSide = options.playerSide ?? 'red';
  const openingSide = options.openingSide ?? 'red';

  return {
    board: placePieces(initialPieces),
    currentSide: openingSide,
    playerSide,
    openingSide,
    moveHistory: [],
    captured: {
      red: [],
      black: [],
    },
    lastMove: null,
    selectedPieceId: null,
    legalTargets: [],
    check: null,
    gameOver: null,
    aiDifficulty: options.aiDifficulty ?? 'normal',
  };
}

export function getPieceAt(state: GameState, position: Position): Piece | null {
  if (!inBounds(position)) {
    return null;
  }

  return state.board[position.row][position.col];
}

export function getAllPieces(state: GameState): Piece[] {
  return state.board.flat().filter((piece): piece is Piece => piece !== null);
}
