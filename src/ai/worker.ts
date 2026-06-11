import { chooseBestMove } from './search';
import type { GameState, Move, Side } from '../game/types';

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

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, state, depth, side } = event.data;
  const move = chooseBestMove(state, side, depth);
  const response: WorkerResponse = { id, move };
  self.postMessage(response);
};
