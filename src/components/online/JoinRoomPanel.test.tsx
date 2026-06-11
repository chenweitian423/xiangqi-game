import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach as afterEachHook, describe, expect, it, vi } from 'vitest';

import JoinRoomPanel from './JoinRoomPanel';

describe('JoinRoomPanel', () => {
  afterEachHook(() => {
    cleanup();
  });

  it('accepts the room code and password when joining', async () => {
    const user = userEvent.setup();
    const onJoinRoom = vi.fn().mockResolvedValue(undefined);

    render(<JoinRoomPanel onJoinRoom={onJoinRoom} />);

    await user.type(screen.getByLabelText('房间号'), 'ABCD12');
    await user.type(screen.getByLabelText('昵称'), 'Guest Player');
    await user.type(screen.getByLabelText('房间密码'), 'river-horse');
    await user.click(screen.getByRole('button', { name: '加入房间' }));

    expect(onJoinRoom).toHaveBeenCalledWith({
      code: 'ABCD12',
      nickname: 'Guest Player',
      password: 'river-horse',
    });
  });

  it('prefills the room code from a shared room link', () => {
    render(<JoinRoomPanel onJoinRoom={vi.fn()} initialCode="abcd12" />);

    expect(document.querySelector<HTMLInputElement>('input[name="roomCode"]')).toHaveValue('ABCD12');
  });

  it('shows password-required guidance when the room is protected', () => {
    render(
      <JoinRoomPanel
        onJoinRoom={vi.fn()}
        passwordRequired
        notice="This room is protected. Enter the room password to continue."
      />,
    );

    expect(screen.getByText('This room is protected. Enter the room password to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('房间密码')).toHaveAccessibleDescription(
      '这个房间开启了密码保护，请先输入密码。',
    );
  });
});
