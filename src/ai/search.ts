import { applyMove } from '../game/applyMove';
import { generateAllLegalMoves, getWinner } from '../game/legality';
import type { GameState, Move, Side } from '../game/types';
import { evaluatePosition } from './evaluate';

const WIN_SCORE = 1_000_000;

function terminalScore(winner: Side, depthRemaining: number): number {
  const score = WIN_SCORE + depthRemaining;
  return winner === 'black' ? score : -score;
}

function minimax(state: GameState, depth: number, alpha: number, beta: number): number {
  const winner = getWinner(state);

  if (winner) {
    return terminalScore(winner, depth);
  }

  if (depth === 0) {
    return evaluatePosition(state);
  }

  const moves = generateAllLegalMoves(state, state.currentSide);

  if (moves.length === 0) {
    return evaluatePosition(state);
  }

  if (state.currentSide === 'black') {
    let bestScore = -Infinity;

    for (const move of moves) {
      bestScore = Math.max(bestScore, minimax(applyMove(state, move), depth - 1, alpha, beta));
      alpha = Math.max(alpha, bestScore);

      if (beta <= alpha) {
        break;
      }
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const move of moves) {
    bestScore = Math.min(bestScore, minimax(applyMove(state, move), depth - 1, alpha, beta));
    beta = Math.min(beta, bestScore);

    if (beta <= alpha) {
      break;
    }
  }

  return bestScore;
}

export function chooseBestMove(state: GameState, side: Side, depth = 2): Move | null {
  const moves = generateAllLegalMoves(state, side);
  let bestMove: Move | null = null;
  let bestScore = side === 'black' ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of moves) {
    const score = minimax(applyMove(state, move), Math.max(0, depth - 1), alpha, beta);

    if (side === 'black') {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }

      alpha = Math.max(alpha, bestScore);
      continue;
    }

    if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }

    beta = Math.min(beta, bestScore);
  }

  return bestMove;
}

export function chooseAiMove(state: GameState, sideOrDepth: Side | number = 'black', depth = 2): Move | null {
  const side = typeof sideOrDepth === 'number' ? 'black' : sideOrDepth;
  const resolvedDepth = typeof sideOrDepth === 'number' ? sideOrDepth : depth;
  return chooseBestMove(state, side, resolvedDepth);
}

export function chooseHintMove(state: GameState, sideOrDepth: Side | number = 'red', depth = 2): Move | null {
  const side = typeof sideOrDepth === 'number' ? 'red' : sideOrDepth;
  const resolvedDepth = typeof sideOrDepth === 'number' ? sideOrDepth : depth;
  return chooseBestMove(state, side, resolvedDepth);
}
