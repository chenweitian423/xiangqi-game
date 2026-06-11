import type { GameState, Move, Side } from '../game/types';
import { chooseBestMove } from './search';

type WorkerRequest = {
  id: number;
  state: GameState;
  depth: number;
  side: Side;
};

type WorkerResponse = {
  id: number;
  move: Move | null;
};

type PendingRequest = {
  resolve: (move: Move | null) => void;
  reject: (reason?: unknown) => void;
};

let nextRequestId = 1;
let aiWorker: Worker | null = null;
const pendingRequests = new Map<number, PendingRequest>();

function createAbortError(): Error {
  return new DOMException('AI calculation aborted', 'AbortError');
}

function rejectPendingRequests(error: Error): void {
  for (const { reject } of pendingRequests.values()) {
    reject(error);
  }

  pendingRequests.clear();
}

function getAiWorker(): Worker | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  if (aiWorker) {
    return aiWorker;
  }

  aiWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  aiWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const request = pendingRequests.get(event.data.id);

    if (!request) {
      return;
    }

    pendingRequests.delete(event.data.id);
    request.resolve(event.data.move);
  };
  aiWorker.onerror = () => {
    const error = new Error('AI worker failed');
    rejectPendingRequests(error);

    if (aiWorker) {
      aiWorker.terminate();
      aiWorker = null;
    }
  };

  return aiWorker;
}

function chooseMoveAsync(state: GameState, side: Side, depth: number, signal?: AbortSignal): Promise<Move | null> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  const worker = getAiWorker();

  if (!worker) {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(createAbortError());
      signal?.addEventListener('abort', onAbort, { once: true });

      window.setTimeout(() => {
        if (signal?.aborted) {
          return;
        }

        try {
          resolve(chooseBestMove(state, side, depth));
        } catch (error) {
          reject(error);
        } finally {
          signal?.removeEventListener('abort', onAbort);
        }
      }, 0);
    });
  }

  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      pendingRequests.delete(id);
      cleanup();
      reject(createAbortError());
    };

    pendingRequests.set(id, {
      resolve: (move) => {
        cleanup();
        resolve(move);
      },
      reject: (error) => {
        cleanup();
        reject(error);
      },
    });

    signal?.addEventListener('abort', onAbort, { once: true });

    const request: WorkerRequest = { id, state, side, depth };
    worker.postMessage(request);
  });
}

export function chooseAiMoveAsync(
  state: GameState,
  side: Side = 'black',
  depth = 2,
  signal?: AbortSignal,
): Promise<Move | null> {
  return chooseMoveAsync(state, side, depth, signal);
}

export function chooseHintMoveAsync(
  state: GameState,
  side: Side = 'red',
  depth = 2,
  signal?: AbortSignal,
): Promise<Move | null> {
  return chooseMoveAsync(state, side, depth, signal);
}
