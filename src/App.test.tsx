import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { resolveAppMode, resolveModeFromLocation } from './App';
import { createInitialGameState } from './game/initialState';
import { saveGameState } from './storage/localSave';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', 'https://example.com/');
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

  it('renders the single-player xiangqi game by default', () => {
    render(<App />);

    expect(screen.getAllByRole('button', { name: /第\d+行 第\d+列/ })).toHaveLength(90);
    expect(screen.getByRole('button', { name: /红兵 第7行 第1列/ })).toHaveTextContent('兵');
    expect(screen.getByRole('button', { name: /黑车 第1行 第1列/ })).toHaveStyle({ left: '0%', top: '0%' });
    expect(screen.getByText(/红方走棋/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /AI难度/ })).toHaveValue('normal');
    expect(screen.getByRole('button', { name: /我先手/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /电脑先手/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('鸣人')).toBeInTheDocument();
    expect(screen.getByText('佐助')).toBeInTheDocument();
  });

  it('renders the online match shell without single-player AI controls', () => {
    render(<App mode={{ kind: 'online', roomId: 'room-42' }} />);

    expect(screen.getByRole('region', { name: '联机对弈' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '欢乐象棋' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '加入房间' })).toBeInTheDocument();
    expect(screen.getByLabelText('房间号')).toHaveValue('ROOM-42');
    expect(screen.queryByRole('region', { name: '中国象棋' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'AI难度' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提示一步' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '悔棋' })).not.toBeInTheDocument();
  });

  it('renders the online match fallback when roomId is missing', () => {
    render(<App mode={{ kind: 'online' }} />);

    expect(screen.getByRole('heading', { name: '欢乐象棋' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '创建房间' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重开' })).not.toBeInTheDocument();
  });

  it('keeps single-player-only hint and AI controls out of online mode even after rendering both shells', () => {
    const { rerender } = render(<App />);

    expect(screen.getByRole('combobox', { name: 'AI难度' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提示一步' })).toBeInTheDocument();

    rerender(<App mode={{ kind: 'online', roomId: 'room-42' }} />);

    expect(screen.getByRole('heading', { name: '欢乐象棋' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '加入房间' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'AI难度' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提示一步' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '悔棋' })).not.toBeInTheDocument();
  });

  it('prefers an explicit mode prop over location-derived defaults', () => {
    render(<App mode={{ kind: 'single-player' }} />);

    expect(screen.getByText(/红方走棋/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '联机对局' })).not.toBeInTheDocument();
  });

  it('changes AI difficulty', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: /AI难度/ }), { target: { value: 'hard' } });
    expect(screen.getByRole('combobox', { name: /AI难度/ })).toHaveValue('hard');
  });

  it('toggles sound and haptics preferences', () => {
    render(<App />);

    const soundButton = screen.getByRole('button', { name: /声音/ });
    const hapticsButton = screen.getByRole('button', { name: /震动/ });

    fireEvent.click(soundButton);
    expect(screen.getByText(/已关闭声音反馈/)).toBeInTheDocument();
    fireEvent.click(hapticsButton);
    expect(screen.getByText(/已关闭震动反馈/)).toBeInTheDocument();
  });

  it('disables haptics controls when vibration is unsupported', () => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: undefined,
    });

    render(<App />);
    expect(screen.getByRole('button', { name: /震动/ })).toBeDisabled();
    expect(screen.getByText(/当前浏览器不支持震动/)).toBeInTheDocument();
  });

  it('plays a red move, applies an AI reply, undoes the round, and restarts', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /红兵 第7行 第1列/ }));
    const targetSquare = screen.getByRole('button', { name: /空位 第6行 第1列/ });
    expect(targetSquare.querySelector('.target-dot')).not.toBeNull();

    fireEvent.click(targetSquare);
    await waitFor(() => expect(screen.getByText(/红方走棋/)).toBeInTheDocument(), { timeout: 2500 });
    expect(document.querySelectorAll('.move-list li').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /悔棋/ }));
    expect(screen.getByText(/已悔棋，回到上一回合/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /重开/ }));
    expect(screen.getByText(/棋局已重开/)).toBeInTheDocument();
    expect(screen.getByText(/红方走棋/)).toBeInTheDocument();
  });

  it('lets the computer move first while the player remains red', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /电脑先手/ }));

    expect(screen.getByText(/已切换为电脑先手/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /电脑先手/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/电脑走棋/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/红方走棋/)).toBeInTheDocument(), { timeout: 2500 });
    expect(screen.getByText(/轮到你/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /红兵 第7行 第1列/ })).toBeInTheDocument();
    expect(screen.getByText('佐助').closest('.character-card')).not.toBeNull();
  });

  it('shows a game-over dialog and restarts from it', () => {
    saveGameState({
      ...createInitialGameState(),
      gameOver: { winner: 'red', reason: 'king-captured' },
    });

    render(<App />);

    expect(screen.getByRole('dialog', { name: /红方获胜/ })).toBeInTheDocument();
    expect(screen.getByText(/将帅被吃/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /再来一局/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses collapsible information panels on compact screens', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('700px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(<App />);
    const mobilePanels = screen.getByRole('group', { name: /手机信息面板/ });
    expect(within(mobilePanels).getAllByText('被吃棋子')).toHaveLength(2);
    expect(within(mobilePanels).getAllByText('棋谱')).toHaveLength(2);
  });

  it('shows a move hint without playing it', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /提示一步/ }));
    await waitFor(() => expect(screen.getByText(/提示：试试这一步/)).toBeInTheDocument());
    expect(document.querySelectorAll('.is-hint-from')).toHaveLength(1);
    expect(document.querySelectorAll('.is-hint-to')).toHaveLength(1);
  });

  it('shows a warning when undo is unavailable', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /悔棋/ }));
    expect(screen.getByText(/当前还没有可悔的回合/)).toBeInTheDocument();
  });
});

describe('resolveAppMode', () => {
  it('returns the explicit mode when provided', () => {
    expect(resolveAppMode({ kind: 'online', roomId: 'ROOM42' })).toEqual({
      kind: 'online',
      roomId: 'ROOM42',
    });
  });
});

describe('resolveModeFromLocation', () => {
  it('maps /online/:roomCode to online mode', () => {
    expect(resolveModeFromLocation({ pathname: '/online/abcd12', search: '' })).toEqual({
      kind: 'online',
      roomId: 'ABCD12',
    });
  });

  it('maps room query params to online mode', () => {
    expect(resolveModeFromLocation({ pathname: '/', search: '?room=abcd12' })).toEqual({
      kind: 'online',
      roomId: 'ABCD12',
    });
  });

  it('keeps /online without a room code in setup mode', () => {
    expect(resolveModeFromLocation({ pathname: '/online', search: '' })).toEqual({
      kind: 'online',
    });
  });

  it('falls back to single-player for unrelated routes', () => {
    expect(resolveModeFromLocation({ pathname: '/', search: '' })).toEqual({
      kind: 'single-player',
    });
  });
});
