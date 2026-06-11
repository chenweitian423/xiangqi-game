# Xiangqi Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure frontend React + TypeScript Chinese chess game where the player controls red and plays against a moderate built-in AI.

**Architecture:** Keep game rules, AI search, UI state, persistence, and React components separate. The game core is framework-free and fully unit-testable; the UI consumes the core through a reducer and serializable state.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS modules or plain CSS.

---

## File Structure

Create and maintain this structure:

```text
src/
  app/
    App.tsx
    gameReducer.ts
    gameReducer.test.ts
  game/
    types.ts
    initialState.ts
    moveGeneration.ts
    moveGeneration.test.ts
    legality.ts
    legality.test.ts
    applyMove.ts
    applyMove.test.ts
    notation.ts
    notation.test.ts
  ai/
    evaluate.ts
    evaluate.test.ts
    search.ts
    search.test.ts
  components/
    Board.tsx
    Piece.tsx
    GameStatus.tsx
    MoveList.tsx
    CapturedPieces.tsx
    GameControls.tsx
  storage/
    localSave.ts
    localSave.test.ts
  styles/
    theme.css
```

The generated Vite files `src/main.tsx`, `src/index.css`, `index.html`, `package.json`, `tsconfig*.json`, and `vite.config.ts` should remain at their normal locations.

---

### Task 1: Scaffold the React Project

**Files:**
- Create through tooling: `package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, TypeScript config, Vite config
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/setupTests.ts`

- [ ] **Step 1: Create the Vite React TypeScript app in the current folder**

Run:

```bash
npm create vite@latest . -- --template react-ts
```

Expected: Vite creates a React TypeScript project in the repository root.

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Expected: dependencies are installed and `node_modules/` remains ignored by Git.

- [ ] **Step 3: Configure Vitest**

Edit `vite.config.ts` to:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
```

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add package scripts**

Ensure `package.json` has:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm test
npm run build
```

Expected: tests run with no test files or pass if the template includes tests; build completes.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig*.json src
git commit -m "chore: scaffold xiangqi frontend"
```

---

### Task 2: Define Core Types and Initial Board

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/initialState.ts`
- Create: `src/game/initialState.test.ts`

- [ ] **Step 1: Write failing tests for initial state**

Create `src/game/initialState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt } from './initialState';

describe('initial xiangqi state', () => {
  it('creates a 10 by 9 board with red to move first', () => {
    const state = createInitialGameState();
    expect(state.board).toHaveLength(10);
    expect(state.board.every((row) => row.length === 9)).toBe(true);
    expect(state.currentSide).toBe('red');
  });

  it('places kings and corner rooks in standard positions', () => {
    const state = createInitialGameState();
    expect(getPieceAt(state, { row: 9, col: 4 })?.type).toBe('king');
    expect(getPieceAt(state, { row: 0, col: 4 })?.type).toBe('king');
    expect(getPieceAt(state, { row: 9, col: 0 })?.type).toBe('rook');
    expect(getPieceAt(state, { row: 0, col: 8 })?.type).toBe('rook');
  });

  it('starts with no captures, no selected piece, and no game over', () => {
    const state = createInitialGameState();
    expect(state.captured.red).toEqual([]);
    expect(state.captured.black).toEqual([]);
    expect(state.selectedPieceId).toBeNull();
    expect(state.gameOver).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/game/initialState.test.ts
```

Expected: FAIL because the files do not exist yet.

- [ ] **Step 3: Implement core types**

Create `src/game/types.ts`:

```ts
export type Side = 'red' | 'black';
export type PieceType = 'king' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'pawn';

export type Position = {
  row: number;
  col: number;
};

export type Piece = {
  id: string;
  side: Side;
  type: PieceType;
  position: Position;
};

export type Move = {
  id: string;
  pieceId: string;
  pieceType: PieceType;
  side: Side;
  from: Position;
  to: Position;
  captured?: Piece;
  givesCheck?: boolean;
  notation?: string;
};

export type GameOver = {
  winner: Side;
  reason: 'checkmate' | 'king-captured' | 'no-legal-moves';
};

export type GameState = {
  board: Array<Array<Piece | null>>;
  currentSide: Side;
  moveHistory: Move[];
  captured: Record<Side, Piece[]>;
  lastMove: Move | null;
  selectedPieceId: string | null;
  legalTargets: Position[];
  check: Side | null;
  gameOver: GameOver | null;
  aiDifficulty: 'normal';
};

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function inBounds(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_ROWS &&
    position.col >= 0 &&
    position.col < BOARD_COLS
  );
}

export function oppositeSide(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}
```

- [ ] **Step 4: Implement initial state**

Create `src/game/initialState.ts`:

```ts
import type { GameState, Piece, Position, Side } from './types';
import { BOARD_COLS, BOARD_ROWS } from './types';

function piece(id: string, side: Side, type: Piece['type'], row: number, col: number): Piece {
  return { id, side, type, position: { row, col } };
}

const INITIAL_PIECES: Piece[] = [
  piece('black-rook-1', 'black', 'rook', 0, 0),
  piece('black-horse-1', 'black', 'horse', 0, 1),
  piece('black-elephant-1', 'black', 'elephant', 0, 2),
  piece('black-advisor-1', 'black', 'advisor', 0, 3),
  piece('black-king', 'black', 'king', 0, 4),
  piece('black-advisor-2', 'black', 'advisor', 0, 5),
  piece('black-elephant-2', 'black', 'elephant', 0, 6),
  piece('black-horse-2', 'black', 'horse', 0, 7),
  piece('black-rook-2', 'black', 'rook', 0, 8),
  piece('black-cannon-1', 'black', 'cannon', 2, 1),
  piece('black-cannon-2', 'black', 'cannon', 2, 7),
  piece('black-pawn-1', 'black', 'pawn', 3, 0),
  piece('black-pawn-2', 'black', 'pawn', 3, 2),
  piece('black-pawn-3', 'black', 'pawn', 3, 4),
  piece('black-pawn-4', 'black', 'pawn', 3, 6),
  piece('black-pawn-5', 'black', 'pawn', 3, 8),
  piece('red-pawn-1', 'red', 'pawn', 6, 0),
  piece('red-pawn-2', 'red', 'pawn', 6, 2),
  piece('red-pawn-3', 'red', 'pawn', 6, 4),
  piece('red-pawn-4', 'red', 'pawn', 6, 6),
  piece('red-pawn-5', 'red', 'pawn', 6, 8),
  piece('red-cannon-1', 'red', 'cannon', 7, 1),
  piece('red-cannon-2', 'red', 'cannon', 7, 7),
  piece('red-rook-1', 'red', 'rook', 9, 0),
  piece('red-horse-1', 'red', 'horse', 9, 1),
  piece('red-elephant-1', 'red', 'elephant', 9, 2),
  piece('red-advisor-1', 'red', 'advisor', 9, 3),
  piece('red-king', 'red', 'king', 9, 4),
  piece('red-advisor-2', 'red', 'advisor', 9, 5),
  piece('red-elephant-2', 'red', 'elephant', 9, 6),
  piece('red-horse-2', 'red', 'horse', 9, 7),
  piece('red-rook-2', 'red', 'rook', 9, 8),
];

export function createEmptyBoard(): GameState['board'] {
  return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null));
}

export function placePieces(pieces: Piece[]): GameState['board'] {
  const board = createEmptyBoard();
  for (const nextPiece of pieces) {
    board[nextPiece.position.row][nextPiece.position.col] = { ...nextPiece, position: { ...nextPiece.position } };
  }
  return board;
}

export function createInitialGameState(): GameState {
  return {
    board: placePieces(INITIAL_PIECES),
    currentSide: 'red',
    moveHistory: [],
    captured: { red: [], black: [] },
    lastMove: null,
    selectedPieceId: null,
    legalTargets: [],
    check: null,
    gameOver: null,
    aiDifficulty: 'normal',
  };
}

export function getPieceAt(state: GameState, position: Position): Piece | null {
  return state.board[position.row]?.[position.col] ?? null;
}

export function getAllPieces(state: GameState): Piece[] {
  return state.board.flat().filter((item): item is Piece => item !== null);
}
```

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- src/game/initialState.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/game/types.ts src/game/initialState.ts src/game/initialState.test.ts
git commit -m "feat: add xiangqi initial state"
```

---

### Task 3: Implement Piece Move Generation

**Files:**
- Create: `src/game/moveGeneration.ts`
- Create: `src/game/moveGeneration.test.ts`

- [ ] **Step 1: Write move generation tests**

Create `src/game/moveGeneration.test.ts` with tests for rook, horse leg blocking, cannon screen capture, elephant river restriction, palace rules, and pawn movement:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './initialState';
import { generatePseudoLegalMoves } from './moveGeneration';

function targetsFor(pieceId: string) {
  return generatePseudoLegalMoves(createInitialGameState(), pieceId).map((move) => move.to);
}

describe('pseudo legal move generation', () => {
  it('generates red pawn forward movement before crossing the river', () => {
    expect(targetsFor('red-pawn-3')).toContainEqual({ row: 5, col: 4 });
    expect(targetsFor('red-pawn-3')).not.toContainEqual({ row: 6, col: 3 });
  });

  it('generates black pawn forward movement before crossing the river', () => {
    expect(targetsFor('black-pawn-3')).toContainEqual({ row: 4, col: 4 });
    expect(targetsFor('black-pawn-3')).not.toContainEqual({ row: 3, col: 3 });
  });

  it('blocks horse movement when the horse leg is occupied', () => {
    const moves = targetsFor('red-horse-1');
    expect(moves).toContainEqual({ row: 7, col: 0 });
    expect(moves).not.toContainEqual({ row: 7, col: 2 });
  });

  it('allows cannon capture only with one screen', () => {
    const moves = targetsFor('red-cannon-1');
    expect(moves).toContainEqual({ row: 3, col: 1 });
    expect(moves).not.toContainEqual({ row: 0, col: 1 });
  });

  it('keeps elephants on their own side of the river', () => {
    const moves = targetsFor('red-elephant-1');
    expect(moves).toContainEqual({ row: 7, col: 0 });
    expect(moves).toContainEqual({ row: 7, col: 4 });
    expect(moves).not.toContainEqual({ row: 5, col: 0 });
  });

  it('keeps king and advisors inside the palace', () => {
    expect(targetsFor('red-king')).toContainEqual({ row: 8, col: 4 });
    expect(targetsFor('red-king')).not.toContainEqual({ row: 9, col: 5 });
    expect(targetsFor('red-advisor-1')).toContainEqual({ row: 8, col: 4 });
    expect(targetsFor('red-advisor-1')).not.toContainEqual({ row: 8, col: 2 });
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/game/moveGeneration.test.ts
```

Expected: FAIL because `moveGeneration.ts` does not exist.

- [ ] **Step 3: Implement move generation**

Create `src/game/moveGeneration.ts`:

```ts
import { getAllPieces, getPieceAt } from './initialState';
import type { GameState, Move, Piece, Position } from './types';
import { inBounds, samePosition } from './types';

let moveCounter = 0;

function makeMove(piece: Piece, to: Position, captured?: Piece): Move {
  moveCounter += 1;
  return {
    id: `move-${moveCounter}`,
    pieceId: piece.id,
    pieceType: piece.type,
    side: piece.side,
    from: { ...piece.position },
    to,
    captured,
  };
}

function isOwnPiece(state: GameState, piece: Piece, position: Position): boolean {
  return getPieceAt(state, position)?.side === piece.side;
}

function pushIfAvailable(state: GameState, piece: Piece, moves: Move[], to: Position): void {
  if (!inBounds(to) || isOwnPiece(state, piece, to)) return;
  moves.push(makeMove(piece, to, getPieceAt(state, to) ?? undefined));
}

function slideMoves(state: GameState, piece: Piece, directions: Position[]): Move[] {
  const moves: Move[] = [];
  for (const direction of directions) {
    let row = piece.position.row + direction.row;
    let col = piece.position.col + direction.col;
    while (inBounds({ row, col })) {
      const target = getPieceAt(state, { row, col });
      if (!target) {
        moves.push(makeMove(piece, { row, col }));
      } else {
        if (target.side !== piece.side) moves.push(makeMove(piece, { row, col }, target));
        break;
      }
      row += direction.row;
      col += direction.col;
    }
  }
  return moves;
}

function cannonMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [{ row: 1, col: 0 }, { row: -1, col: 0 }, { row: 0, col: 1 }, { row: 0, col: -1 }];
  for (const direction of directions) {
    let row = piece.position.row + direction.row;
    let col = piece.position.col + direction.col;
    let screens = 0;
    while (inBounds({ row, col })) {
      const target = getPieceAt(state, { row, col });
      if (!target && screens === 0) moves.push(makeMove(piece, { row, col }));
      if (target) {
        screens += 1;
        if (screens === 2) {
          if (target.side !== piece.side) moves.push(makeMove(piece, { row, col }, target));
          break;
        }
      }
      row += direction.row;
      col += direction.col;
    }
  }
  return moves;
}

function horseMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  const patterns = [
    { leg: { row: -1, col: 0 }, to: { row: -2, col: -1 } },
    { leg: { row: -1, col: 0 }, to: { row: -2, col: 1 } },
    { leg: { row: 1, col: 0 }, to: { row: 2, col: -1 } },
    { leg: { row: 1, col: 0 }, to: { row: 2, col: 1 } },
    { leg: { row: 0, col: -1 }, to: { row: -1, col: -2 } },
    { leg: { row: 0, col: -1 }, to: { row: 1, col: -2 } },
    { leg: { row: 0, col: 1 }, to: { row: -1, col: 2 } },
    { leg: { row: 0, col: 1 }, to: { row: 1, col: 2 } },
  ];
  for (const pattern of patterns) {
    const leg = { row: piece.position.row + pattern.leg.row, col: piece.position.col + pattern.leg.col };
    const to = { row: piece.position.row + pattern.to.row, col: piece.position.col + pattern.to.col };
    if (!getPieceAt(state, leg)) pushIfAvailable(state, piece, moves, to);
  }
  return moves;
}

function elephantMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const delta of [{ row: 2, col: 2 }, { row: 2, col: -2 }, { row: -2, col: 2 }, { row: -2, col: -2 }]) {
    const eye = { row: piece.position.row + delta.row / 2, col: piece.position.col + delta.col / 2 };
    const to = { row: piece.position.row + delta.row, col: piece.position.col + delta.col };
    const crossesRiver = piece.side === 'red' ? to.row < 5 : to.row > 4;
    if (!crossesRiver && !getPieceAt(state, eye)) pushIfAvailable(state, piece, moves, to);
  }
  return moves;
}

function inPalace(piece: Piece, position: Position): boolean {
  const palaceRows = piece.side === 'red' ? [7, 8, 9] : [0, 1, 2];
  return palaceRows.includes(position.row) && position.col >= 3 && position.col <= 5;
}

function advisorMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const delta of [{ row: 1, col: 1 }, { row: 1, col: -1 }, { row: -1, col: 1 }, { row: -1, col: -1 }]) {
    const to = { row: piece.position.row + delta.row, col: piece.position.col + delta.col };
    if (inPalace(piece, to)) pushIfAvailable(state, piece, moves, to);
  }
  return moves;
}

function kingMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const delta of [{ row: 1, col: 0 }, { row: -1, col: 0 }, { row: 0, col: 1 }, { row: 0, col: -1 }]) {
    const to = { row: piece.position.row + delta.row, col: piece.position.col + delta.col };
    if (inPalace(piece, to)) pushIfAvailable(state, piece, moves, to);
  }
  return moves;
}

function pawnMoves(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  const forward = piece.side === 'red' ? -1 : 1;
  pushIfAvailable(state, piece, moves, { row: piece.position.row + forward, col: piece.position.col });
  const crossed = piece.side === 'red' ? piece.position.row <= 4 : piece.position.row >= 5;
  if (crossed) {
    pushIfAvailable(state, piece, moves, { row: piece.position.row, col: piece.position.col - 1 });
    pushIfAvailable(state, piece, moves, { row: piece.position.row, col: piece.position.col + 1 });
  }
  return moves;
}

export function generatePseudoLegalMoves(state: GameState, pieceId: string): Move[] {
  const piece = getAllPieces(state).find((item) => item.id === pieceId);
  if (!piece) return [];
  if (piece.type === 'rook') return slideMoves(state, piece, [{ row: 1, col: 0 }, { row: -1, col: 0 }, { row: 0, col: 1 }, { row: 0, col: -1 }]);
  if (piece.type === 'cannon') return cannonMoves(state, piece);
  if (piece.type === 'horse') return horseMoves(state, piece);
  if (piece.type === 'elephant') return elephantMoves(state, piece);
  if (piece.type === 'advisor') return advisorMoves(state, piece);
  if (piece.type === 'king') return kingMoves(state, piece);
  return pawnMoves(state, piece);
}

export function generateAllPseudoLegalMoves(state: GameState, side = state.currentSide): Move[] {
  return getAllPieces(state)
    .filter((piece) => piece.side === side)
    .flatMap((piece) => generatePseudoLegalMoves(state, piece.id))
    .filter((move, index, moves) => moves.findIndex((candidate) => samePosition(candidate.to, move.to) && candidate.pieceId === move.pieceId) === index);
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- src/game/moveGeneration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/game/moveGeneration.ts src/game/moveGeneration.test.ts
git commit -m "feat: generate xiangqi piece moves"
```

---

### Task 4: Implement Legal Move Filtering and Applying Moves

**Files:**
- Create: `src/game/applyMove.ts`
- Create: `src/game/applyMove.test.ts`
- Create: `src/game/legality.ts`
- Create: `src/game/legality.test.ts`

- [ ] **Step 1: Write tests for applying moves and legality**

Create `src/game/applyMove.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt } from './initialState';
import { applyMove, undoFullRound } from './applyMove';

describe('applyMove', () => {
  it('moves a piece, switches side, and records last move', () => {
    const state = createInitialGameState();
    const next = applyMove(state, {
      id: 'test-move',
      pieceId: 'red-pawn-3',
      pieceType: 'pawn',
      side: 'red',
      from: { row: 6, col: 4 },
      to: { row: 5, col: 4 },
    });
    expect(getPieceAt(next, { row: 5, col: 4 })?.id).toBe('red-pawn-3');
    expect(getPieceAt(next, { row: 6, col: 4 })).toBeNull();
    expect(next.currentSide).toBe('black');
    expect(next.lastMove?.id).toBe('test-move');
  });

  it('captures pieces and records them under the captured side', () => {
    const state = createInitialGameState();
    const next = applyMove(state, {
      id: 'capture',
      pieceId: 'red-cannon-1',
      pieceType: 'cannon',
      side: 'red',
      from: { row: 7, col: 1 },
      to: { row: 3, col: 1 },
      captured: getPieceAt(state, { row: 3, col: 1 }) ?? undefined,
    });
    expect(next.captured.black.map((piece) => piece.id)).toContain('black-pawn-2');
  });

  it('undoes one full player and AI round', () => {
    const first = applyMove(createInitialGameState(), {
      id: 'red',
      pieceId: 'red-pawn-3',
      pieceType: 'pawn',
      side: 'red',
      from: { row: 6, col: 4 },
      to: { row: 5, col: 4 },
    });
    const second = applyMove(first, {
      id: 'black',
      pieceId: 'black-pawn-3',
      pieceType: 'pawn',
      side: 'black',
      from: { row: 3, col: 4 },
      to: { row: 4, col: 4 },
    });
    const undone = undoFullRound(second);
    expect(undone.moveHistory).toHaveLength(0);
    expect(getPieceAt(undone, { row: 6, col: 4 })?.id).toBe('red-pawn-3');
    expect(getPieceAt(undone, { row: 3, col: 4 })?.id).toBe('black-pawn-3');
  });
});
```

Create `src/game/legality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState, getPieceAt, placePieces } from './initialState';
import { generateLegalMoves, isInCheck } from './legality';
import type { GameState, Piece } from './types';

function stateWithPieces(pieces: Piece[], currentSide: GameState['currentSide'] = 'red'): GameState {
  return {
    ...createInitialGameState(),
    board: placePieces(pieces),
    currentSide,
    moveHistory: [],
    captured: { red: [], black: [] },
    lastMove: null,
    selectedPieceId: null,
    legalTargets: [],
    check: null,
    gameOver: null,
  };
}

describe('legality', () => {
  it('detects facing kings as check', () => {
    const state = stateWithPieces([
      { id: 'red-king', side: 'red', type: 'king', position: { row: 9, col: 4 } },
      { id: 'black-king', side: 'black', type: 'king', position: { row: 0, col: 4 } },
    ]);
    expect(isInCheck(state, 'red')).toBe(true);
    expect(isInCheck(state, 'black')).toBe(true);
  });

  it('filters moves that leave own king in check', () => {
    const state = stateWithPieces([
      { id: 'red-king', side: 'red', type: 'king', position: { row: 9, col: 4 } },
      { id: 'red-rook', side: 'red', type: 'rook', position: { row: 5, col: 4 } },
      { id: 'black-king', side: 'black', type: 'king', position: { row: 0, col: 0 } },
      { id: 'black-rook', side: 'black', type: 'rook', position: { row: 0, col: 4 } },
    ]);
    const moves = generateLegalMoves(state, 'red-rook');
    expect(moves.every((move) => move.to.col === 4)).toBe(true);
    expect(getPieceAt(state, { row: 5, col: 4 })?.id).toBe('red-rook');
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/game/applyMove.test.ts src/game/legality.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement apply move**

Create `src/game/applyMove.ts`:

```ts
import { createInitialGameState, getPieceAt } from './initialState';
import type { GameState, Move, Piece } from './types';
import { oppositeSide } from './types';

function clonePiece(piece: Piece): Piece {
  return { ...piece, position: { ...piece.position } };
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((row) => row.map((piece) => (piece ? clonePiece(piece) : null))),
    moveHistory: state.moveHistory.map((move) => ({
      ...move,
      from: { ...move.from },
      to: { ...move.to },
      captured: move.captured ? clonePiece(move.captured) : undefined,
    })),
    captured: {
      red: state.captured.red.map(clonePiece),
      black: state.captured.black.map(clonePiece),
    },
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          from: { ...state.lastMove.from },
          to: { ...state.lastMove.to },
          captured: state.lastMove.captured ? clonePiece(state.lastMove.captured) : undefined,
        }
      : null,
    legalTargets: state.legalTargets.map((position) => ({ ...position })),
  };
}

export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneGameState(state);
  const movingPiece = getPieceAt(next, move.from);
  if (!movingPiece || movingPiece.id !== move.pieceId) return state;
  const captured = getPieceAt(next, move.to);
  next.board[move.from.row][move.from.col] = null;
  const movedPiece = { ...movingPiece, position: { ...move.to } };
  next.board[move.to.row][move.to.col] = movedPiece;
  const recordedMove = { ...move, captured: captured ? clonePiece(captured) : move.captured };
  if (recordedMove.captured) next.captured[recordedMove.captured.side].push(recordedMove.captured);
  next.moveHistory.push(recordedMove);
  next.lastMove = recordedMove;
  next.currentSide = oppositeSide(state.currentSide);
  next.selectedPieceId = null;
  next.legalTargets = [];
  return next;
}

export function undoFullRound(state: GameState): GameState {
  const targetLength = Math.max(0, state.moveHistory.length - 2);
  let replay = createInitialGameState();
  for (const move of state.moveHistory.slice(0, targetLength)) {
    replay = applyMove(replay, move);
  }
  return replay;
}
```

- [ ] **Step 4: Implement legality**

Create `src/game/legality.ts`:

```ts
import { applyMove } from './applyMove';
import { getAllPieces, getPieceAt } from './initialState';
import { generateAllPseudoLegalMoves, generatePseudoLegalMoves } from './moveGeneration';
import type { GameState, Move, Side } from './types';
import { oppositeSide } from './types';

function findKing(state: GameState, side: Side) {
  return getAllPieces(state).find((piece) => piece.side === side && piece.type === 'king') ?? null;
}

function kingsFace(state: GameState): boolean {
  const redKing = findKing(state, 'red');
  const blackKing = findKing(state, 'black');
  if (!redKing || !blackKing || redKing.position.col !== blackKing.position.col) return false;
  const col = redKing.position.col;
  const start = Math.min(redKing.position.row, blackKing.position.row) + 1;
  const end = Math.max(redKing.position.row, blackKing.position.row);
  for (let row = start; row < end; row += 1) {
    if (getPieceAt(state, { row, col })) return false;
  }
  return true;
}

export function isInCheck(state: GameState, side: Side): boolean {
  if (kingsFace(state)) return true;
  const king = findKing(state, side);
  if (!king) return true;
  return generateAllPseudoLegalMoves(state, oppositeSide(side)).some(
    (move) => move.to.row === king.position.row && move.to.col === king.position.col,
  );
}

export function generateLegalMoves(state: GameState, pieceId: string): Move[] {
  const piece = getAllPieces(state).find((item) => item.id === pieceId);
  if (!piece) return [];
  return generatePseudoLegalMoves(state, pieceId).filter((move) => {
    const next = applyMove(state, move);
    return !isInCheck(next, piece.side);
  });
}

export function generateAllLegalMoves(state: GameState, side = state.currentSide): Move[] {
  return getAllPieces(state)
    .filter((piece) => piece.side === side)
    .flatMap((piece) => generateLegalMoves(state, piece.id));
}

export function getCheckSide(state: GameState): Side | null {
  if (isInCheck(state, 'red')) return 'red';
  if (isInCheck(state, 'black')) return 'black';
  return null;
}

export function getWinner(state: GameState): Side | null {
  if (!findKing(state, 'red')) return 'black';
  if (!findKing(state, 'black')) return 'red';
  if (generateAllLegalMoves(state, state.currentSide).length === 0) return oppositeSide(state.currentSide);
  return null;
}
```

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- src/game/applyMove.test.ts src/game/legality.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/game/applyMove.ts src/game/applyMove.test.ts src/game/legality.ts src/game/legality.test.ts
git commit -m "feat: apply and validate xiangqi moves"
```

---

### Task 5: Add Notation, AI Evaluation, and Search

**Files:**
- Create: `src/game/notation.ts`
- Create: `src/game/notation.test.ts`
- Create: `src/ai/evaluate.ts`
- Create: `src/ai/evaluate.test.ts`
- Create: `src/ai/search.ts`
- Create: `src/ai/search.test.ts`

- [ ] **Step 1: Write tests**

Create `src/ai/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cloneGameState } from '../game/applyMove';
import { createInitialGameState } from '../game/initialState';
import { chooseAiMove } from './search';

describe('AI search', () => {
  it('returns a legal black move from the initial position without mutating state', () => {
    const state = createInitialGameState();
    const before = cloneGameState(state);
    const move = chooseAiMove({ ...state, currentSide: 'black' }, 2);
    expect(move?.side).toBe('black');
    expect(state).toEqual(before);
  });
});
```

Create `src/ai/evaluate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/initialState';
import { evaluatePosition } from './evaluate';

describe('evaluatePosition', () => {
  it('scores the initial position close to equal', () => {
    expect(evaluatePosition(createInitialGameState())).toBe(0);
  });
});
```

Create `src/game/notation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatMove } from './notation';

describe('formatMove', () => {
  it('formats a readable coordinate move', () => {
    expect(formatMove({
      id: 'm1',
      pieceId: 'red-pawn-3',
      pieceType: 'pawn',
      side: 'red',
      from: { row: 6, col: 4 },
      to: { row: 5, col: 4 },
    })).toBe('红兵 (6,4) -> (5,4)');
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/ai/search.test.ts src/ai/evaluate.test.ts src/game/notation.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement notation**

Create `src/game/notation.ts`:

```ts
import type { Move, PieceType, Side } from './types';

const SIDE_LABEL: Record<Side, string> = { red: '红', black: '黑' };
const PIECE_LABEL: Record<PieceType, string> = {
  king: '帅',
  advisor: '仕',
  elephant: '相',
  horse: '马',
  rook: '车',
  cannon: '炮',
  pawn: '兵',
};

export function formatMove(move: Move): string {
  return `${SIDE_LABEL[move.side]}${PIECE_LABEL[move.pieceType]} (${move.from.row},${move.from.col}) -> (${move.to.row},${move.to.col})`;
}
```

- [ ] **Step 4: Implement evaluation**

Create `src/ai/evaluate.ts`:

```ts
import { getAllPieces } from '../game/initialState';
import type { GameState, PieceType } from '../game/types';

const PIECE_VALUE: Record<PieceType, number> = {
  king: 10000,
  rook: 500,
  cannon: 350,
  horse: 300,
  elephant: 150,
  advisor: 150,
  pawn: 80,
};

export function evaluatePosition(state: GameState): number {
  return getAllPieces(state).reduce((score, piece) => {
    const material = PIECE_VALUE[piece.type];
    const pawnBonus = piece.type === 'pawn' && (piece.side === 'red' ? piece.position.row <= 4 : piece.position.row >= 5) ? 30 : 0;
    const value = material + pawnBonus;
    return score + (piece.side === 'black' ? value : -value);
  }, 0);
}
```

- [ ] **Step 5: Implement search**

Create `src/ai/search.ts`:

```ts
import { applyMove } from '../game/applyMove';
import { generateAllLegalMoves, getWinner } from '../game/legality';
import type { GameState, Move, Side } from '../game/types';
import { evaluatePosition } from './evaluate';

function terminalScore(state: GameState): number | null {
  const winner = getWinner(state);
  if (winner === 'black') return 100000;
  if (winner === 'red') return -100000;
  return null;
}

function minimax(state: GameState, depth: number, alpha: number, beta: number, maximizingSide: Side): number {
  const terminal = terminalScore(state);
  if (terminal !== null) return terminal;
  if (depth === 0) return evaluatePosition(state);
  const moves = generateAllLegalMoves(state, state.currentSide);
  if (moves.length === 0) return state.currentSide === 'black' ? -100000 : 100000;
  if (state.currentSide === maximizingSide) {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(state, move), depth - 1, alpha, beta, maximizingSide));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    best = Math.min(best, minimax(applyMove(state, move), depth - 1, alpha, beta, maximizingSide));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseAiMove(state: GameState, depth = 2): Move | null {
  const moves = generateAllLegalMoves(state, 'black');
  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = minimax(applyMove(state, move), depth - 1, -Infinity, Infinity, 'black');
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
```

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/ai/search.test.ts src/ai/evaluate.test.ts src/game/notation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/ai src/game/notation.ts src/game/notation.test.ts
git commit -m "feat: add xiangqi ai search"
```

---

### Task 6: Add Reducer, Persistence, and Game Flow Tests

**Files:**
- Create: `src/app/gameReducer.ts`
- Create: `src/app/gameReducer.test.ts`
- Create: `src/storage/localSave.ts`
- Create: `src/storage/localSave.test.ts`

- [ ] **Step 1: Write reducer and storage tests**

Create `src/app/gameReducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/initialState';
import { gameReducer } from './gameReducer';

describe('gameReducer', () => {
  it('selects a red piece and exposes legal targets', () => {
    const state = gameReducer(createInitialGameState(), { type: 'select-square', position: { row: 6, col: 4 } });
    expect(state.selectedPieceId).toBe('red-pawn-3');
    expect(state.legalTargets).toContainEqual({ row: 5, col: 4 });
  });

  it('moves a selected piece to a legal target', () => {
    const selected = gameReducer(createInitialGameState(), { type: 'select-square', position: { row: 6, col: 4 } });
    const moved = gameReducer(selected, { type: 'select-square', position: { row: 5, col: 4 } });
    expect(moved.lastMove?.pieceId).toBe('red-pawn-3');
    expect(moved.currentSide).toBe('black');
  });

  it('restarts the game', () => {
    const moved = gameReducer(createInitialGameState(), { type: 'select-square', position: { row: 6, col: 4 } });
    const restarted = gameReducer(moved, { type: 'restart' });
    expect(restarted.moveHistory).toHaveLength(0);
    expect(restarted.currentSide).toBe('red');
  });
});
```

Create `src/storage/localSave.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/initialState';
import { loadGameState, saveGameState } from './localSave';

describe('localSave', () => {
  it('round trips serializable game state', () => {
    const state = createInitialGameState();
    saveGameState(state);
    expect(loadGameState()).toEqual(state);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/app/gameReducer.test.ts src/storage/localSave.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement reducer**

Create `src/app/gameReducer.ts`:

```ts
import { applyMove, undoFullRound } from '../game/applyMove';
import { createInitialGameState, getPieceAt } from '../game/initialState';
import { generateLegalMoves, getCheckSide, getWinner } from '../game/legality';
import type { GameState, Position } from '../game/types';
import { samePosition } from '../game/types';

export type GameAction =
  | { type: 'select-square'; position: Position }
  | { type: 'apply-move'; move: import('../game/types').Move }
  | { type: 'undo-full-round' }
  | { type: 'restart' };

function finalizeState(state: GameState): GameState {
  const winner = getWinner(state);
  return {
    ...state,
    check: getCheckSide(state),
    gameOver: winner ? { winner, reason: 'no-legal-moves' } : null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'restart') return createInitialGameState();
  if (action.type === 'undo-full-round') return undoFullRound(state);
  if (action.type === 'apply-move') return finalizeState(applyMove(state, action.move));
  if (action.type === 'select-square') {
    if (state.currentSide !== 'red' || state.gameOver) return state;
    const clickedPiece = getPieceAt(state, action.position);
    if (state.selectedPieceId) {
      const selectedMove = generateLegalMoves(state, state.selectedPieceId).find((move) => samePosition(move.to, action.position));
      if (selectedMove) return finalizeState(applyMove(state, selectedMove));
    }
    if (clickedPiece?.side === 'red') {
      const legalMoves = generateLegalMoves(state, clickedPiece.id);
      return {
        ...state,
        selectedPieceId: clickedPiece.id,
        legalTargets: legalMoves.map((move) => move.to),
      };
    }
    return { ...state, selectedPieceId: null, legalTargets: [] };
  }
  return state;
}
```

- [ ] **Step 4: Implement local storage**

Create `src/storage/localSave.ts`:

```ts
import type { GameState } from '../game/types';

const STORAGE_KEY = 'xiangqi-game-state';

export function saveGameState(state: GameState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadGameState(): GameState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as GameState;
}

export function clearGameState(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- src/app/gameReducer.test.ts src/storage/localSave.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app src/storage
git commit -m "feat: add xiangqi game reducer"
```

---

### Task 7: Build the React UI

**Files:**
- Modify: `src/App.tsx` or create `src/app/App.tsx` and update `src/main.tsx`
- Create: `src/components/Board.tsx`
- Create: `src/components/Piece.tsx`
- Create: `src/components/GameStatus.tsx`
- Create: `src/components/MoveList.tsx`
- Create: `src/components/CapturedPieces.tsx`
- Create: `src/components/GameControls.tsx`
- Create: `src/styles/theme.css`
- Modify: `src/index.css`

- [ ] **Step 1: Create component implementations**

Use these public component props:

```ts
// Board.tsx
import type { GameState, Position } from '../game/types';
export type BoardProps = { state: GameState; onSquareClick: (position: Position) => void };

// GameStatus.tsx
import type { GameState } from '../game/types';
export type GameStatusProps = { state: GameState; aiThinking: boolean };

// GameControls.tsx
export type GameControlsProps = { onUndo: () => void; onRestart: () => void; disabled: boolean };
```

The components should render:

- A 10 by 9 board with buttons for every square.
- Piece labels using Chinese characters.
- Legal target highlights.
- Last move source and destination highlights.
- Top status with player, turn, AI thinking, check, and game over.
- Move list from `state.moveHistory`.
- Captured pieces from `state.captured`.
- Undo and restart buttons.

- [ ] **Step 2: Wire App state and AI response**

`src/app/App.tsx` should:

```ts
import { useEffect, useReducer, useState } from 'react';
import { chooseAiMove } from '../ai/search';
import { Board } from '../components/Board';
import { CapturedPieces } from '../components/CapturedPieces';
import { GameControls } from '../components/GameControls';
import { GameStatus } from '../components/GameStatus';
import { MoveList } from '../components/MoveList';
import { createInitialGameState } from '../game/initialState';
import type { Position } from '../game/types';
import { loadGameState, saveGameState } from '../storage/localSave';
import '../styles/theme.css';
import { gameReducer } from './gameReducer';

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => loadGameState() ?? createInitialGameState());
  const [aiThinking, setAiThinking] = useState(false);

  useEffect(() => {
    saveGameState(state);
  }, [state]);

  useEffect(() => {
    if (state.currentSide !== 'black' || state.gameOver || aiThinking) return;
    setAiThinking(true);
    const timeout = window.setTimeout(() => {
      const move = chooseAiMove(state, 2);
      if (move) dispatch({ type: 'apply-move', move });
      setAiThinking(false);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [state, aiThinking]);

  function handleSquareClick(position: Position) {
    if (!aiThinking) dispatch({ type: 'select-square', position });
  }

  return (
    <main className="app-shell">
      <section className="play-table">
        <GameStatus state={state} aiThinking={aiThinking} />
        <Board state={state} onSquareClick={handleSquareClick} />
        <GameControls
          disabled={aiThinking}
          onUndo={() => dispatch({ type: 'undo-full-round' })}
          onRestart={() => dispatch({ type: 'restart' })}
        />
        <CapturedPieces captured={state.captured} />
        <MoveList moves={state.moveHistory} />
      </section>
    </main>
  );
}
```

Update `src/main.tsx` to import `{ App }` from `./app/App`.

- [ ] **Step 3: Add theme CSS**

Create `src/styles/theme.css` with stable board dimensions, a centered layout, modern Chinese-inspired colors, responsive sizing, accessible focus states, and non-overlapping controls. Use fixed grid tracks for the board so labels and highlights do not resize squares.

- [ ] **Step 4: Manual browser verification**

Run:

```bash
npm run dev
```

Open the local URL. Verify:

- The board is centered.
- Player can select a red piece and see legal targets.
- Player move triggers AI thinking and then an AI move.
- Undo removes one red and one black move.
- Restart resets the game.
- Layout remains usable at desktop width and mobile width.

- [ ] **Step 5: Automated verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src
git commit -m "feat: build xiangqi game interface"
```

---

### Task 8: Final Polish and End-to-End Check

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/app/App.tsx`
- Modify: `src/components/Board.tsx`
- Modify: `src/components/Piece.tsx`
- Modify: `src/components/GameStatus.tsx`
- Modify: `src/components/MoveList.tsx`
- Modify: `src/components/CapturedPieces.tsx`
- Modify: `src/components/GameControls.tsx`
- Create: `README.md`

- [ ] **Step 1: Add a concise README**

Create `README.md`:

```md
# Xiangqi

A pure frontend Chinese chess game built with React, TypeScript, and Vite. The player controls red and plays against a built-in black AI.

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm test
npm run build
```
```

- [ ] **Step 2: Verify all requirements from the design spec**

Check the running app for:

- Human vs AI.
- Player red first.
- AI black.
- Legal move highlights.
- Last move marker.
- Move list.
- Captured pieces.
- Check and win/loss messages.
- Undo by one full round.
- Restart.
- Local save of latest game.
- Offline pure frontend build.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run build
git status --short
```

Expected:

- Tests pass.
- Build passes.
- Only intentional files are changed.

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md src package.json package-lock.json vite.config.ts
git commit -m "docs: add xiangqi project readme"
```
