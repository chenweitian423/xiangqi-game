import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { RoomParticipant } from '../../online/types';
import ParticipantList from './ParticipantList';

describe('ParticipantList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders players and spectators in separate presence groups', () => {
    const participants: RoomParticipant[] = [
      {
        participantId: 'participant-host',
        roomId: 'room-42',
        displayName: 'Host Player',
        role: 'host',
        seat: 'red',
        status: 'connected',
        joinedAt: '2026-05-20T00:00:00.000Z',
        leftAt: null,
      },
      {
        participantId: 'participant-guest',
        roomId: 'room-42',
        displayName: 'Guest Player',
        role: 'guest',
        seat: 'black',
        status: 'connected',
        joinedAt: '2026-05-20T00:00:30.000Z',
        leftAt: null,
      },
      {
        participantId: 'participant-spectator',
        roomId: 'room-42',
        displayName: 'River Coach',
        role: 'guest',
        seat: null,
        status: 'connected',
        joinedAt: '2026-05-20T00:01:00.000Z',
        leftAt: null,
      },
      {
        participantId: 'participant-left',
        roomId: 'room-42',
        displayName: 'Late Viewer',
        role: 'host',
        seat: null,
        status: 'left',
        joinedAt: '2026-05-20T00:02:00.000Z',
        leftAt: '2026-05-20T00:03:00.000Z',
      },
    ];

    render(<ParticipantList participants={participants} viewerParticipantId="participant-spectator" />);

    const panel = screen.getByRole('region', { name: '房间成员' });
    expect(within(panel).getByText('Host Player')).toBeInTheDocument();
    expect(within(panel).getByText('Guest Player')).toBeInTheDocument();
    expect(within(panel).getByText('River Coach')).toBeInTheDocument();
    expect(within(panel).getByText('Late Viewer')).toBeInTheDocument();
    expect(within(panel).getByText('观战中')).toBeInTheDocument();
    expect(within(panel).getByText('已离线')).toBeInTheDocument();
    expect(within(panel).getByText('你')).toBeInTheDocument();
  });

  it('shows an empty spectator note when everyone is seated', () => {
    const participants: RoomParticipant[] = [
      {
        participantId: 'participant-host',
        roomId: 'room-42',
        displayName: 'Host Player',
        role: 'host',
        seat: 'red',
        status: 'connected',
        joinedAt: '2026-05-20T00:00:00.000Z',
        leftAt: null,
      },
      {
        participantId: 'participant-guest',
        roomId: 'room-42',
        displayName: 'Guest Player',
        role: 'guest',
        seat: 'black',
        status: 'connected',
        joinedAt: '2026-05-20T00:00:30.000Z',
        leftAt: null,
      },
    ];

    render(<ParticipantList participants={participants} />);

    expect(screen.getByText('暂无观战成员')).toBeInTheDocument();
  });
});
