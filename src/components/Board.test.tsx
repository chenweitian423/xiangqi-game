import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, placePieces } from '../game/initialState';
import type { GameState, Move, Piece } from '../game/types';
import { Board } from './Board';

function piece(id: string, side: Piece['side'], type: Piece['type'], row: number, col: number): Piece {
  return {
    id,
    side,
    type,
    position: { row, col },
  };
}

function boardState(overrides: Partial<GameState>): GameState {
  const redKing = piece('red-king', 'red', 'king', 9, 4);
  const blackKing = piece('black-king', 'black', 'king', 0, 4);
  const redRook = piece('red-rook', 'red', 'rook', 4, 4);
  const blackPawn = piece('black-pawn', 'black', 'pawn', 4, 6);

  return {
    ...createInitialGameState(),
    board: placePieces([redKing, blackKing, redRook, blackPawn]),
    selectedPieceId: redRook.id,
    legalTargets: [
      { row: 4, col: 5 },
      { row: 4, col: 6 },
    ],
    ...overrides,
  };
}

describe('Board', () => {
  afterEach(() => {
    cleanup();
  });

  it('distinguishes ordinary move targets from capture targets', () => {
    render(<Board state={boardState({})} onSquareClick={vi.fn()} />);

    const moveTarget = screen.getByRole('button', { name: /空位 第5行 第6列/ });
    const captureTarget = screen.getByRole('button', { name: /黑卒 第5行 第7列/ });

    expect(moveTarget.querySelector('.target-dot')).not.toBeNull();
    expect(moveTarget).not.toHaveClass('is-capture-target');
    expect(captureTarget).toHaveClass('is-capture-target');
    expect(captureTarget.querySelector('.capture-ring')).not.toBeNull();
  });

  it('marks the start and end of the most recent move with arrival animation', () => {
    const move: Move = {
      id: 'red-rook:4,4-4,6',
      pieceId: 'red-rook',
      pieceType: 'rook',
      side: 'red',
      from: { row: 4, col: 4 },
      to: { row: 4, col: 6 },
    };

    render(<Board state={boardState({ lastMove: move })} onSquareClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /红车 第5行 第5列/ }).querySelector('.last-move-badge')).toHaveTextContent('起');
    expect(screen.getByRole('button', { name: /黑卒 第5行 第7列/ }).querySelector('.last-move-badge')).toHaveTextContent('到');
    expect(screen.getByRole('button', { name: /黑卒 第5行 第7列/ }).querySelector('.piece')).toHaveClass('piece-arriving');
  });

  it('marks the checked king and a suggested move', () => {
    const suggestion: Move = {
      id: 'red-rook:4,4-4,6',
      pieceId: 'red-rook',
      pieceType: 'rook',
      side: 'red',
      from: { row: 4, col: 4 },
      to: { row: 4, col: 6 },
    };

    render(<Board state={boardState({ check: 'black' })} onSquareClick={vi.fn()} hintMove={suggestion} />);

    expect(screen.getByRole('button', { name: /黑将 第1行 第5列/ })).toHaveClass('is-checked-king');
    expect(screen.getByRole('button', { name: /黑将 第1行 第5列/ }).querySelector('.check-ring')).not.toBeNull();
    expect(screen.getByRole('button', { name: /黑将 第1行 第5列/ }).querySelector('.piece')).toHaveClass('piece-checked');
    expect(screen.getByRole('button', { name: /红车 第5行 第5列/ })).toHaveClass('is-hint-from');
    expect(screen.getByRole('button', { name: /黑卒 第5行 第7列/ })).toHaveClass('is-hint-to');
  });

  it('shows capture feedback when the latest move captures a piece', () => {
    const move: Move = {
      id: 'red-rook:4,4-4,6',
      pieceId: 'red-rook',
      pieceType: 'rook',
      side: 'red',
      from: { row: 4, col: 4 },
      to: { row: 4, col: 6 },
      captured: piece('black-pawn', 'black', 'pawn', 4, 6),
    };

    render(<Board state={boardState({ lastMove: move })} onSquareClick={vi.fn()} />);

    const impactSquare = screen.getByRole('button', { name: /黑卒 第5行 第7列/ });

    expect(impactSquare).toHaveClass('is-capture-impact');
    expect(impactSquare.querySelector('.capture-burst')).not.toBeNull();
    expect(impactSquare.querySelector('.piece-captured-ghost')).not.toBeNull();
  });
});
