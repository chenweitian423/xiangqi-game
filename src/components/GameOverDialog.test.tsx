import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameOverDialog } from './GameOverDialog';

describe('GameOverDialog', () => {
  it('shows a richer game summary with restart and review actions', () => {
    const onRestart = vi.fn();
    const onClose = vi.fn();

    render(
      <GameOverDialog
        gameOver={{ winner: 'red', reason: 'checkmate' }}
        moveCount={18}
        playerSide="red"
        onRestart={onRestart}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog', { name: /红方获胜/ })).toBeInTheDocument();
    expect(screen.getByText('本局胜利')).toBeInTheDocument();
    expect(screen.getByText('你执红方')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('将死')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续复盘' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再来一局' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '继续复盘' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRestart).not.toHaveBeenCalled();
  });
});
