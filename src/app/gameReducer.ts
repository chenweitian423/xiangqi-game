import { applyMove, cloneGameState, undoFullRound } from '../game/applyMove';
import { createInitialGameState, getAllPieces, getPieceAt } from '../game/initialState';
import { generateAllLegalMoves, generateLegalMoves, getCheckSide, getWinner } from '../game/legality';
import { samePosition } from '../game/types';
import type { AiDifficulty, GameOver, GameState, Move, Position, Side } from '../game/types';

export type GameAction =
  | { type: 'select-square'; position: Position }
  | { type: 'apply-move'; move: Move }
  | { type: 'set-ai-difficulty'; difficulty: AiDifficulty }
  | { type: 'set-opening-side'; side: Side }
  | { type: 'undo-full-round' }
  | { type: 'restart'; openingSide?: Side };

function hasKing(state: GameState, side: Side): boolean {
  return getAllPieces(state).some((piece) => piece.side === side && piece.type === 'king');
}

function getGameOver(state: GameState): GameOver | null {
  const winner = getWinner(state);

  if (!winner) {
    return null;
  }

  const loser = winner === 'red' ? 'black' : 'red';

  return {
    winner,
    reason: hasKing(state, loser) ? 'no-legal-moves' : 'king-captured',
  };
}

function finalizeState(state: GameState): GameState {
  return {
    ...state,
    check: getCheckSide(state),
    gameOver: getGameOver(state),
  };
}

function clearSelection(state: GameState): GameState {
  return {
    ...cloneGameState(state),
    selectedPieceId: null,
    legalTargets: [],
  };
}

function selectPiece(state: GameState, pieceId: string): GameState {
  return {
    ...cloneGameState(state),
    selectedPieceId: pieceId,
    legalTargets: generateLegalMoves(state, pieceId).map((move) => ({ ...move.to })),
  };
}

function applySelectedMove(state: GameState, position: Position): GameState | null {
  if (!state.selectedPieceId) {
    return null;
  }

  const selectedMove = generateLegalMoves(state, state.selectedPieceId).find((move) => samePosition(move.to, position));

  return selectedMove ? finalizeState(applyMove(state, selectedMove)) : null;
}

function handleSelectSquare(state: GameState, position: Position): GameState {
  if (state.currentSide !== state.playerSide || state.gameOver) {
    return cloneGameState(state);
  }

  const targetPiece = getPieceAt(state, position);

  if (targetPiece?.side === state.playerSide) {
    return selectPiece(state, targetPiece.id);
  }

  const moved = applySelectedMove(state, position);

  return moved ?? clearSelection(state);
}

function sameMove(a: Move, b: Move): boolean {
  return (
    a.id === b.id &&
    a.pieceId === b.pieceId &&
    a.pieceType === b.pieceType &&
    a.side === b.side &&
    samePosition(a.from, b.from) &&
    samePosition(a.to, b.to)
  );
}

function applyExternalMove(state: GameState, move: Move): GameState {
  if (
    state.gameOver ||
    move.side !== state.currentSide ||
    !generateAllLegalMoves(state, state.currentSide).some((legalMove) => sameMove(legalMove, move))
  ) {
    return cloneGameState(state);
  }

  return finalizeState(applyMove(state, move));
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'restart':
      return createInitialGameState({
        playerSide: state.playerSide,
        openingSide: action.openingSide ?? state.openingSide,
        aiDifficulty: state.aiDifficulty,
      });
    case 'undo-full-round':
      return finalizeState({
        ...undoFullRound(state),
        aiDifficulty: state.aiDifficulty,
        playerSide: state.playerSide,
        openingSide: state.openingSide,
      });
    case 'apply-move':
      return applyExternalMove(state, action.move);
    case 'set-ai-difficulty':
      return {
        ...cloneGameState(state),
        aiDifficulty: action.difficulty,
      };
    case 'set-opening-side':
      return createInitialGameState({
        playerSide: state.playerSide,
        openingSide: action.side,
        aiDifficulty: state.aiDifficulty,
      });
    case 'select-square':
      return handleSelectSquare(state, action.position);
  }
}
