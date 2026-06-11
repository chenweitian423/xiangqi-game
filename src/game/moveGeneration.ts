import { getAllPieces, getPieceAt } from './initialState';
import { inBounds } from './types';
import type { GameState, Move, Piece, Position, Side } from './types';

type Direction = Readonly<{ row: number; col: number }>;

const ORTHOGONAL_DIRECTIONS: Direction[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const DIAGONAL_DIRECTIONS: Direction[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];

const HORSE_MOVES: Array<Readonly<{ move: Direction; leg: Direction }>> = [
  { move: { row: -2, col: -1 }, leg: { row: -1, col: 0 } },
  { move: { row: -2, col: 1 }, leg: { row: -1, col: 0 } },
  { move: { row: 2, col: -1 }, leg: { row: 1, col: 0 } },
  { move: { row: 2, col: 1 }, leg: { row: 1, col: 0 } },
  { move: { row: -1, col: -2 }, leg: { row: 0, col: -1 } },
  { move: { row: 1, col: -2 }, leg: { row: 0, col: -1 } },
  { move: { row: -1, col: 2 }, leg: { row: 0, col: 1 } },
  { move: { row: 1, col: 2 }, leg: { row: 0, col: 1 } },
];

const ELEPHANT_MOVES: Array<Readonly<{ move: Direction; eye: Direction }>> = [
  { move: { row: -2, col: -2 }, eye: { row: -1, col: -1 } },
  { move: { row: -2, col: 2 }, eye: { row: -1, col: 1 } },
  { move: { row: 2, col: -2 }, eye: { row: 1, col: -1 } },
  { move: { row: 2, col: 2 }, eye: { row: 1, col: 1 } },
];

function clonePosition(position: Position): Position {
  return { row: position.row, col: position.col };
}

function clonePiece(piece: Piece): Piece {
  return {
    ...piece,
    position: clonePosition(piece.position),
  };
}

function offset(position: Position, direction: Direction): Position {
  return {
    row: position.row + direction.row,
    col: position.col + direction.col,
  };
}

function createMove(piece: Piece, to: Position, captured?: Piece): Move {
  return {
    id: `${piece.id}:${piece.position.row},${piece.position.col}-${to.row},${to.col}`,
    pieceId: piece.id,
    pieceType: piece.type,
    side: piece.side,
    from: clonePosition(piece.position),
    to: clonePosition(to),
    ...(captured ? { captured: clonePiece(captured) } : {}),
  };
}

function addStepMove(state: GameState, piece: Piece, to: Position, moves: Move[]): void {
  if (!inBounds(to)) {
    return;
  }

  const target = getPieceAt(state, to);

  if (target?.side === piece.side) {
    return;
  }

  moves.push(createMove(piece, to, target ?? undefined));
}

function generateRookMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const direction of ORTHOGONAL_DIRECTIONS) {
    let position = offset(piece.position, direction);

    while (inBounds(position)) {
      const target = getPieceAt(state, position);

      if (target === null) {
        moves.push(createMove(piece, position));
      } else {
        if (target.side !== piece.side) {
          moves.push(createMove(piece, position, target));
        }
        break;
      }

      position = offset(position, direction);
    }
  }

  return moves;
}

function generateCannonMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const direction of ORTHOGONAL_DIRECTIONS) {
    let position = offset(piece.position, direction);
    let screenFound = false;

    while (inBounds(position)) {
      const target = getPieceAt(state, position);

      if (!screenFound) {
        if (target === null) {
          moves.push(createMove(piece, position));
        } else {
          screenFound = true;
        }
      } else if (target !== null) {
        if (target.side !== piece.side) {
          moves.push(createMove(piece, position, target));
        }
        break;
      }

      position = offset(position, direction);
    }
  }

  return moves;
}

function generateHorseMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const { move, leg } of HORSE_MOVES) {
    if (getPieceAt(state, offset(piece.position, leg)) !== null) {
      continue;
    }

    addStepMove(state, piece, offset(piece.position, move), moves);
  }

  return moves;
}

function isElephantRiverLegal(side: Side, position: Position): boolean {
  return side === 'red' ? position.row >= 5 : position.row <= 4;
}

function generateElephantMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const { move, eye } of ELEPHANT_MOVES) {
    const target = offset(piece.position, move);

    if (!isElephantRiverLegal(piece.side, target) || getPieceAt(state, offset(piece.position, eye)) !== null) {
      continue;
    }

    addStepMove(state, piece, target, moves);
  }

  return moves;
}

function isInPalace(side: Side, position: Position): boolean {
  const palaceRows = side === 'red' ? position.row >= 7 && position.row <= 9 : position.row >= 0 && position.row <= 2;

  return palaceRows && position.col >= 3 && position.col <= 5;
}

function generateAdvisorMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const direction of DIAGONAL_DIRECTIONS) {
    const target = offset(piece.position, direction);

    if (isInPalace(piece.side, target)) {
      addStepMove(state, piece, target, moves);
    }
  }

  return moves;
}

function generateKingMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const direction of ORTHOGONAL_DIRECTIONS) {
    const target = offset(piece.position, direction);

    if (isInPalace(piece.side, target)) {
      addStepMove(state, piece, target, moves);
    }
  }

  return moves;
}

function hasPawnCrossedRiver(piece: Piece): boolean {
  return piece.side === 'red' ? piece.position.row <= 4 : piece.position.row >= 5;
}

function generatePawnMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  const forward = piece.side === 'red' ? -1 : 1;
  const directions: Direction[] = [{ row: forward, col: 0 }];

  if (hasPawnCrossedRiver(piece)) {
    directions.push({ row: 0, col: -1 }, { row: 0, col: 1 });
  }

  for (const direction of directions) {
    addStepMove(state, piece, offset(piece.position, direction), moves);
  }

  return moves;
}

export function generatePseudoLegalMoves(state: GameState, pieceId: string): Move[] {
  const piece = getAllPieces(state).find((currentPiece) => currentPiece.id === pieceId);

  if (!piece) {
    return [];
  }

  switch (piece.type) {
    case 'rook':
      return generateRookMoves(state, piece);
    case 'cannon':
      return generateCannonMoves(state, piece);
    case 'horse':
      return generateHorseMoves(state, piece);
    case 'elephant':
      return generateElephantMoves(state, piece);
    case 'advisor':
      return generateAdvisorMoves(state, piece);
    case 'king':
      return generateKingMoves(state, piece);
    case 'pawn':
      return generatePawnMoves(state, piece);
  }
}

export function generateAllPseudoLegalMoves(state: GameState, side = state.currentSide): Move[] {
  return getAllPieces(state)
    .filter((piece) => piece.side === side)
    .flatMap((piece) => generatePseudoLegalMoves(state, piece.id));
}
