import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RoomChatMessage } from '../../online/types';
import ChatPanel from './ChatPanel';

const orderedMessages: RoomChatMessage[] = [
  {
    messageId: 'message-1',
    roomId: 'room-42',
    participantId: 'participant-host',
    body: 'First hello',
    status: 'sent',
    createdAt: '2026-05-20T10:00:00.000Z',
  },
  {
    messageId: 'message-2',
    roomId: 'room-42',
    participantId: 'participant-spectator',
    body: 'Second hello',
    status: 'sent',
    createdAt: '2026-05-20T10:01:00.000Z',
  },
];

describe('ChatPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders message history in order with author labels', () => {
    render(
      <ChatPanel
        messages={orderedMessages}
        participants={[
          {
            participantId: 'participant-host',
            roomId: 'room-42',
            displayName: 'Host Player',
            role: 'host',
            seat: 'red',
            status: 'connected',
            joinedAt: '2026-05-20T09:59:00.000Z',
            leftAt: null,
          },
          {
            participantId: 'participant-spectator',
            roomId: 'room-42',
            displayName: 'River Watcher',
            role: 'guest',
            seat: null,
            status: 'connected',
            joinedAt: '2026-05-20T10:00:30.000Z',
            leftAt: null,
          },
        ]}
        disabled={false}
        onSendMessage={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: '房间聊天' });
    const items = within(panel).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Host Player');
    expect(items[0]).toHaveTextContent('First hello');
    expect(items[1]).toHaveTextContent('River Watcher');
    expect(items[1]).toHaveTextContent('Second hello');
  });

  it('submits a message and clears the input', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(
      <ChatPanel
        messages={[]}
        participants={[]}
        disabled={false}
        onSendMessage={onSendMessage}
      />,
    );

    const panel = screen.getByRole('region', { name: '房间聊天' });
    const input = within(panel).getByLabelText('发送消息');
    await user.type(input, 'Hello room');
    await user.click(within(panel).getByRole('button', { name: '发送' }));

    expect(onSendMessage).toHaveBeenCalledWith('Hello room');
    expect(input).toHaveValue('');
  });

  it('disables chat input when the room is unavailable', () => {
    render(
      <ChatPanel
        messages={orderedMessages}
        participants={[]}
        disabled
        onSendMessage={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: '房间聊天' });
    expect(within(panel).getByLabelText('发送消息')).toBeDisabled();
    expect(within(panel).getByRole('button', { name: '发送' })).toBeDisabled();
  });
});
