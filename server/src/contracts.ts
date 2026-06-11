import type { GameState, Move, Side } from '../../src/game/types.js';

export const shortCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const;
export const shortCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4,12}$/;

export const seats = ['red', 'black'] as const;
export type Seat = (typeof seats)[number];

export const roomStatuses = ['waiting', 'active', 'finished', 'expired'] as const;
export type RoomStatus = (typeof roomStatuses)[number];

export const roles = ['host', 'guest'] as const;
export type Role = (typeof roles)[number];

export const participantStatuses = ['connected', 'left'] as const;
export type ParticipantStatus = (typeof participantStatuses)[number];

export const roomSeatStatuses = ['open', 'occupied'] as const;
export type RoomSeatStatus = (typeof roomSeatStatuses)[number];

export const roomChatMessageStatuses = ['sent'] as const;
export type RoomChatMessageStatus = (typeof roomChatMessageStatuses)[number];

export type RoomId = string;
export type ShortCode = string;
export type Revision = number;

export type HealthResponse = {
  ok: true;
  service: 'xiangqi-online-server';
};

export type Room = {
  roomId: RoomId;
  shortCode: ShortCode;
  revision: Revision;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lastActiveAt: string;
  activeMatchId: string | null;
};

export type OpenRoomSeatState = {
  seat: Seat;
  status: 'open';
  participantId: null;
};

export type OccupiedRoomSeatState = {
  seat: Seat;
  status: 'occupied';
  participantId: string;
};

export type RoomSeatState = OpenRoomSeatState | OccupiedRoomSeatState;

export type RoomParticipant = {
  participantId: string;
  roomId: RoomId;
  displayName: string;
  role: Role;
  seat: Seat | null;
  status: ParticipantStatus;
  joinedAt: string;
  leftAt: string | null;
};

export type RoomChatMessage = {
  messageId: string;
  roomId: RoomId;
  participantId: string | null;
  body: string;
  status: RoomChatMessageStatus;
  createdAt: string;
};

export type RoomMatch = {
  matchId: string;
  roomId: RoomId;
  revision: Revision;
  state: GameState;
  redParticipantId: string;
  blackParticipantId: string;
  winner: Side | null;
};

export type RoomSnapshot = {
  room: Room;
  participants: RoomParticipant[];
  seats: [RoomSeatState, RoomSeatState];
  messages: RoomChatMessage[];
  match: RoomMatch | null;
};

export type ClientSocketEvent =
  | {
      type: 'room.join';
      roomId: RoomId;
      shortCode: ShortCode;
      displayName: string;
      token: string;
    }
  | {
      type: 'room.heartbeat';
    }
  | {
      type: 'room.leave';
    }
  | {
      type: 'room.seat.claim';
      seat: Seat;
    }
  | {
      type: 'room.seat.release';
    }
  | {
      type: 'room.chat.send';
      body: string;
    }
  | {
      type: 'match.move';
      revision: Revision;
      move: Move;
    };

export type MatchRejectedReason =
  | 'match_not_ready'
  | 'stale_revision'
  | 'spectator'
  | 'out_of_turn'
  | 'illegal_move';

export type ServerSocketEvent =
  | {
      type: 'room.snapshot';
      revision: Revision;
      snapshot: RoomSnapshot;
    }
  | {
      type: 'room.participant.joined';
      revision: Revision;
      participant: RoomParticipant;
    }
  | {
      type: 'room.participant.left';
      revision: Revision;
      participantId: string;
    }
  | {
      type: 'room.seat.updated';
      revision: Revision;
      seat: RoomSeatState;
    }
  | {
      type: 'room.chat.posted';
      revision: Revision;
      message: RoomChatMessage;
    }
  | {
      type: 'match.updated';
      revision: Revision;
      match: RoomMatch;
    }
  | {
      type: 'match.rejected';
      revision: Revision;
      reason: MatchRejectedReason;
      expectedRevision?: Revision;
      message: string;
    }
  | {
      type: 'room.error';
      code?: 'room-unavailable' | 'invalid-token';
      message: string;
    };
