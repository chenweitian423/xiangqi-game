import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createInitialGameState } from './game/initialState';
import { saveGameState } from './storage/localSave';

describe('App ceremony cues', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
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
    vi.useRealTimers();
  });

  it('shows a short opening ceremony cue on a fresh game', () => {
    render(<App />);

    expect(screen.getByText('对局开始')).toBeInTheDocument();
    expect(screen.getByText('你执红方先行')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByText('对局开始')).not.toBeInTheDocument();
  });

  it('adds a victory flourish when the game is over', () => {
    saveGameState({
      ...createInitialGameState(),
      gameOver: { winner: 'red', reason: 'king-captured' },
    });

    render(<App />);

    expect(screen.getByRole('dialog')).toHaveClass('is-red-win');
    expect(screen.getByText('鸣人').closest('.character-card')).toHaveClass('is-celebrating');
  });
});
