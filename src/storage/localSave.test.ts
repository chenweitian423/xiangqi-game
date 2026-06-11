import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../game/initialState';
import { clearGameState, loadGameState, saveGameState } from './localSave';

describe('localSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round trips serializable game state', () => {
    const state = {
      ...createInitialGameState(),
      selectedPieceId: 'red-pawn-3',
      legalTargets: [{ row: 5, col: 4 }],
    };

    saveGameState(state);

    expect(loadGameState()).toEqual(state);
  });

  it('returns null when there is no saved state', () => {
    expect(loadGameState()).toBeNull();
  });

  it('returns null for corrupt localStorage data', () => {
    localStorage.setItem('xiangqi-game-state', '{not valid json');

    expect(loadGameState()).toBeNull();
  });

  it('returns null for valid JSON that is not a game state', () => {
    localStorage.setItem('xiangqi-game-state', '{}');

    expect(loadGameState()).toBeNull();
  });

  it('returns null for game states with malformed board or current side', () => {
    const state = createInitialGameState();

    localStorage.setItem('xiangqi-game-state', JSON.stringify({ ...state, board: [] }));
    expect(loadGameState()).toBeNull();

    localStorage.setItem('xiangqi-game-state', JSON.stringify({ ...state, currentSide: 'green' }));
    expect(loadGameState()).toBeNull();
  });

  it('does not throw when saving fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(() => saveGameState(createInitialGameState())).not.toThrow();
  });

  it('clears saved game state', () => {
    saveGameState(createInitialGameState());

    clearGameState();

    expect(loadGameState()).toBeNull();
  });

  it('does not throw when clearing fails', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(() => clearGameState()).not.toThrow();
  });
});
