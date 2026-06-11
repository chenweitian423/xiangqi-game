import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach as afterEachHook, describe, expect, it, vi } from 'vitest';

import CreateRoomPanel from './CreateRoomPanel';

describe('CreateRoomPanel', () => {
  afterEachHook(() => {
    cleanup();
  });

  it('submits the nickname and optional password', async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn().mockResolvedValue(undefined);

    render(<CreateRoomPanel onCreateRoom={onCreateRoom} />);

    await user.type(screen.getByLabelText('昵称'), 'Host Player');
    await user.type(screen.getByLabelText('房间密码（可选）'), 'river-horse');
    await user.click(screen.getByRole('button', { name: '创建房间' }));

    expect(onCreateRoom).toHaveBeenCalledWith({
      nickname: 'Host Player',
      password: 'river-horse',
    });
  });
});
