import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { applyMove } from './game/applyMove';
import { createInitialGameState } from './game/initialState';
import { generateLegalMoves } from './game/legality';
import { saveGameState } from './storage/localSave';
import type { GameState, Position } from './game/types';

function findMove(state: GameState, position: Position) {
  const piece = state.board[position.row][position.col];

  if (!piece) {
    throw new Error('Expected a piece at the given position');
  }

  const move = generateLegalMoves(state, piece.id)[0];

  if (!move) {
    throw new Error('Expected at least one legal move');
  }

  return move;
}

function buildReplayState(): GameState {
  const firstState = createInitialGameState();
  const firstMove = findMove(firstState, { row: 6, col: 0 });
  const secondState = applyMove(firstState, firstMove);
  const secondMove = findMove(secondState, { row: 3, col: 0 });

  return applyMove(secondState, secondMove);
}

describe('App replay mode', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'AudioContext', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('steps backward and forward through replay controls', () => {
    saveGameState(buildReplayState());
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '上一步' }));

    expect(screen.getByText(/复盘至第 1 手/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /黑卒 第4行 第1列/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /黑卒 第5行 第1列/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '回到终局' }));
    expect(screen.getByRole('button', { name: /黑卒 第5行 第1列/ })).toBeInTheDocument();
  });

  it('jumps to a move when selecting it from the move list', () => {
    saveGameState(buildReplayState());
    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: /回看第 1 手/ })[0]);

    expect(screen.getByText(/复盘至第 1 手/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /黑卒 第4行 第1列/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回到实战' })).toBeInTheDocument();
  });
});
