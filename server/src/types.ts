import { z } from 'zod';

import {
  type MatchRejectedReason,
  participantStatuses,
  roles,
  roomChatMessageStatuses,
  roomSeatStatuses,
  roomStatuses,
  seats,
  shortCodePattern,
} from './contracts.js';
export {
  participantStatuses,
  roles,
  roomChatMessageStatuses,
  roomSeatStatuses,
  roomStatuses,
  seats,
  shortCodeAlphabet,
  shortCodePattern,
} from './contracts.js';

const isoTimestampSchema = z.string().datetime();
const identifierSchema = z.string().min(1);
const boardRows = 10;
const boardCols = 9;

export const roomIdSchema = identifierSchema;
export type RoomId = z.infer<typeof roomIdSchema>;

export const shortCodeSchema = z.string().regex(shortCodePattern);
export type ShortCode = z.infer<typeof shortCodeSchema>;

export const revisionSchema = z.number().int().nonnegative();
export type Revision = z.infer<typeof revisionSchema>;

export const seatSchema = z.enum(seats);
export type Seat = z.infer<typeof seatSchema>;

export const roomStatusSchema = z.enum(roomStatuses);
export type RoomStatus = z.infer<typeof roomStatusSchema>;

export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const participantStatusSchema = z.enum(participantStatuses);
export type ParticipantStatus = z.infer<typeof participantStatusSchema>;

export const roomSeatStatusSchema = z.enum(roomSeatStatuses);
export type RoomSeatStatus = z.infer<typeof roomSeatStatusSchema>;

export const roomChatMessageStatusSchema = z.enum(roomChatMessageStatuses);
export type RoomChatMessageStatus = z.infer<typeof roomChatMessageStatusSchema>;

export const matchRejectedReasons = [
  'match_not_ready',
  'stale_revision',
  'spectator',
  'out_of_turn',
  'illegal_move',
] as const satisfies readonly MatchRejectedReason[];
export const matchRejectedReasonSchema = z.enum(matchRejectedReasons);
export type MatchRejectedReasonValue = z.infer<typeof matchRejectedReasonSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('xiangqi-online-server'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const roomSchema = z.object({
  roomId: roomIdSchema,
  shortCode: shortCodeSchema,
  revision: revisionSchema,
  status: roomStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
  lastActiveAt: isoTimestampSchema,
  activeMatchId: identifierSchema.nullable(),
});
export type Room = z.infer<typeof roomSchema>;

const openRoomSeatStateSchema = z.object({
  seat: seatSchema,
  status: z.literal('open'),
  participantId: z.null(),
});

const occupiedRoomSeatStateSchema = z.object({
  seat: seatSchema,
  status: z.literal('occupied'),
  participantId: identifierSchema,
});

export const roomSeatStateSchema = z.discriminatedUnion('status', [
  openRoomSeatStateSchema,
  occupiedRoomSeatStateSchema,
]);
export type RoomSeatState = z.infer<typeof roomSeatStateSchema>;

export const roomParticipantSchema = z.object({
  participantId: identifierSchema,
  roomId: roomIdSchema,
  displayName: z.string().min(1),
  role: roleSchema,
  seat: seatSchema.nullable(),
  status: participantStatusSchema,
  joinedAt: isoTimestampSchema,
  leftAt: isoTimestampSchema.nullable(),
});
export type RoomParticipant = z.infer<typeof roomParticipantSchema>;

export const roomChatMessageSchema = z.object({
  messageId: identifierSchema,
  roomId: roomIdSchema,
  participantId: identifierSchema.nullable(),
  body: z.string().min(1),
  status: roomChatMessageStatusSchema,
  createdAt: isoTimestampSchema,
});
export type RoomChatMessage = z.infer<typeof roomChatMessageSchema>;

const roomSeatsSchema = z
  .tuple([roomSeatStateSchema, roomSeatStateSchema])
  .superRefine((seatStates, context) => {
    const sortedSeats = seatStates
      .map((seatState) => seatState.seat)
      .sort()
      .join(',');

    if (sortedSeats !== 'black,red') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'room snapshot seats must contain exactly one red seat and one black seat',
      });
    }
  });

const sideSchema = z.enum(['red', 'black']);
const pieceTypeSchema = z.enum(['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'pawn']);
const aiDifficultySchema = z.enum(['easy', 'normal', 'hard']);
const positionSchema = z.object({
  row: z.number().int().min(0).max(boardRows - 1),
  col: z.number().int().min(0).max(boardCols - 1),
});

const pieceSchema = z.object({
  id: identifierSchema,
  side: sideSchema,
  type: pieceTypeSchema,
  position: positionSchema,
});

const moveSchema = z.object({
  id: identifierSchema,
  pieceId: identifierSchema,
  pieceType: pieceTypeSchema,
  side: sideSchema,
  from: positionSchema,
  to: positionSchema,
  captured: pieceSchema.optional(),
  givesCheck: z.boolean().optional(),
  notation: z.string().min(1).optional(),
});

const boardSchema = z
  .array(z.array(pieceSchema.nullable()).length(boardCols))
  .length(boardRows);

const gameOverSchema = z.object({
  winner: sideSchema,
  reason: z.enum(['checkmate', 'king-captured', 'no-legal-moves']),
});

const gameStateSchema = z.object({
  board: boardSchema,
  currentSide: sideSchema,
  playerSide: sideSchema,
  openingSide: sideSchema,
  moveHistory: z.array(moveSchema),
  captured: z.object({
    red: z.array(pieceSchema),
    black: z.array(pieceSchema),
  }),
  lastMove: moveSchema.nullable(),
  selectedPieceId: identifierSchema.nullable(),
  legalTargets: z.array(positionSchema),
  check: sideSchema.nullable(),
  gameOver: gameOverSchema.nullable(),
  aiDifficulty: aiDifficultySchema,
});

export const roomMatchSchema = z.object({
  matchId: identifierSchema,
  roomId: roomIdSchema,
  revision: revisionSchema,
  state: gameStateSchema,
  redParticipantId: identifierSchema,
  blackParticipantId: identifierSchema,
  winner: z.enum(['red', 'black']).nullable(),
});
export type RoomMatch = z.infer<typeof roomMatchSchema>;

export const roomSnapshotSchema = z.object({
  room: roomSchema,
  participants: z.array(roomParticipantSchema),
  seats: roomSeatsSchema,
  messages: z.array(roomChatMessageSchema),
  match: roomMatchSchema.nullable(),
});
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;

export const clientSocketEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('room.join'),
    roomId: roomIdSchema,
    shortCode: shortCodeSchema,
    displayName: z.string().min(1),
    token: z.string().min(1),
  }),
  z.object({
    type: z.literal('room.heartbeat'),
  }),
  z.object({
    type: z.literal('room.leave'),
  }),
  z.object({
    type: z.literal('room.seat.claim'),
    seat: seatSchema,
  }),
  z.object({
    type: z.literal('room.seat.release'),
  }),
  z.object({
    type: z.literal('room.chat.send'),
    body: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal('match.move'),
    revision: revisionSchema,
    move: moveSchema,
  }),
]);
export type ClientSocketEvent = z.infer<typeof clientSocketEventSchema>;

export const serverSocketEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('room.snapshot'),
    revision: revisionSchema,
    snapshot: roomSnapshotSchema,
  }),
  z.object({
    type: z.literal('room.participant.joined'),
    revision: revisionSchema,
    participant: roomParticipantSchema,
  }),
  z.object({
    type: z.literal('room.participant.left'),
    revision: revisionSchema,
    participantId: identifierSchema,
  }),
  z.object({
    type: z.literal('room.seat.updated'),
    revision: revisionSchema,
    seat: roomSeatStateSchema,
  }),
  z.object({
    type: z.literal('room.chat.posted'),
    revision: revisionSchema,
    message: roomChatMessageSchema,
  }),
  z.object({
    type: z.literal('match.updated'),
    revision: revisionSchema,
    match: roomMatchSchema,
  }),
  z.object({
    type: z.literal('match.rejected'),
    revision: revisionSchema,
    reason: matchRejectedReasonSchema,
    expectedRevision: revisionSchema.optional(),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal('room.error'),
    code: z.enum(['room-unavailable', 'invalid-token']).optional(),
    message: z.string().min(1),
  }),
]);
export type ServerSocketEvent = z.infer<typeof serverSocketEventSchema>;
