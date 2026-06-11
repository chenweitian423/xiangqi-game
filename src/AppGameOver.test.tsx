import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createInitialGameState } from './game/initialState';
import { saveGameState } from './storage/localSave';

describe('App game over review flow', () => {
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

  it('lets the player dismiss the game-over dialog and keep reviewing the board', () => {
    saveGameState({
      ...createInitialGameState(),
      moveHistory: [createInitialGameState().moveHistory[0]].filter(Boolean),
      gameOver: { winner: 'black', reason: 'king-captured' },
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '继续复盘' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/对局结束/)).toBeInTheDocument();
  });
});
