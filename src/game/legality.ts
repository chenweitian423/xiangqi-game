import { getAllPieces } from './initialState';
import { applyMove } from './applyMove';
import { generateAllPseudoLegalMoves, generatePseudoLegalMoves } from './moveGeneration';
import { oppositeSide, samePosition } from './types';
import type { GameState, Move, Piece, Side } from './types';

function findKing(state: GameState, side: Side): Piece | null {
  return getAllPieces(state).find((piece) => piece.side === side && piece.type === 'king') ?? null;
}

function areKingsFacing(state: GameState): boolean {
  const redKing = findKing(state, 'red');
  const blackKing = findKing(state, 'black');

  if (!redKing || !blackKing || redKing.position.col !== blackKing.position.col) {
    return false;
  }

  const col = redKing.position.col;
  const firstRow = Math.min(redKing.position.row, blackKing.position.row) + 1;
  const lastRow = Math.max(redKing.position.row, blackKing.position.row);

  for (let row = firstRow; row < lastRow; row += 1) {
    if (state.board[row][col] !== null) {
      return false;
    }
  }

  return true;
}

export function isInCheck(state: GameState, side: Side): boolean {
  const king = findKing(state, side);

  if (!king) {
    return true;
  }

  if (areKingsFacing(state)) {
    return true;
  }

  return generateAllPseudoLegalMoves(state, oppositeSide(side)).some((move) => samePosition(move.to, king.position));
}

export function generateLegalMoves(state: GameState, pieceId: string): Move[] {
  return generatePseudoLegalMoves(state, pieceId).filter((move) => !isInCheck(applyMove(state, move), move.side));
}

export function generateAllLegalMoves(state: GameState, side = state.currentSide): Move[] {
  return getAllPieces(state)
    .filter((piece) => piece.side === side)
    .flatMap((piece) => generateLegalMoves(state, piece.id));
}

export function getCheckSide(state: GameState): Side | null {
  if (isInCheck(state, state.currentSide)) {
    return state.currentSide;
  }

  const otherSide = oppositeSide(state.currentSide);
  return isInCheck(state, otherSide) ? otherSide : null;
}

export function getWinner(state: GameState): Side | null {
  if (!findKing(state, 'red')) {
    return 'black';
  }

  if (!findKing(state, 'black')) {
    return 'red';
  }

  return generateAllLegalMoves(state, state.currentSide).length === 0 ? oppositeSide(state.currentSide) : null;
}
