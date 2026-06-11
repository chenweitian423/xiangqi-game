import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../game/initialState';
import { chooseAiMoveAsync, chooseHintMoveAsync } from './asyncSearch';

describe('chooseAiMoveAsync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back asynchronously when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    const state = createInitialGameState();

    const promise = chooseAiMoveAsync(state, 'black', 1);

    await expect(promise).resolves.toMatchObject({ side: 'black' });
  });

  it('aborts before starting work', async () => {
    vi.stubGlobal('Worker', undefined);
    const controller = new AbortController();
    controller.abort();

    await expect(chooseAiMoveAsync(createInitialGameState(), 'black', 1, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('returns a red-side hint asynchronously', async () => {
    vi.stubGlobal('Worker', undefined);

    await expect(chooseHintMoveAsync(createInitialGameState(), 'red', 1)).resolves.toMatchObject({
      side: 'red',
    });
  });

  it('supports a red-side computer opening move asynchronously', async () => {
    vi.stubGlobal('Worker', undefined);

    await expect(chooseAiMoveAsync(createInitialGameState(), 'red', 1)).resolves.toMatchObject({
      side: 'red',
    });
  });
});
