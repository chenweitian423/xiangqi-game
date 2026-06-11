import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { RoomParticipant, RoomSeatState } from '../../online/types';
import SeatPanel from './SeatPanel';

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

describe('SeatPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders host and opponent seat states for the active viewer', () => {
    const seats: [RoomSeatState, RoomSeatState] = [
      { seat: 'red', status: 'occupied', participantId: 'participant-host' },
      { seat: 'black', status: 'occupied', participantId: 'participant-guest' },
    ];

    render(
      <SeatPanel
        participants={participants}
        seats={seats}
        viewerParticipantId="participant-host"
      />,
    );

    const panel = screen.getByRole('region', { name: '座位信息' });
    expect(within(panel).getByText('Host Player')).toBeInTheDocument();
    expect(within(panel).getByText('Guest Player')).toBeInTheDocument();
    expect(within(panel).getByText('你')).toBeInTheDocument();
    expect(within(panel).getByText('你的对手')).toBeInTheDocument();
    expect(within(panel).getByText('房主')).toBeInTheDocument();
    expect(within(panel).getByText('房客')).toBeInTheDocument();
  });

  it('shows when an opponent seat is still open', () => {
    const seats: [RoomSeatState, RoomSeatState] = [
      { seat: 'red', status: 'occupied', participantId: 'participant-host' },
      { seat: 'black', status: 'open', participantId: null },
    ];

    render(
      <SeatPanel
        participants={participants}
        seats={seats}
        viewerParticipantId="participant-host"
      />,
    );

    const panel = screen.getByRole('region', { name: '座位信息' });
    expect(within(panel).getByText('空位待入座')).toBeInTheDocument();
    expect(within(panel).getByText('等待玩家加入')).toBeInTheDocument();
  });
});
