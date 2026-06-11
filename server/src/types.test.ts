import { describe, expect, it } from 'vitest';
import {
  clientSocketEventSchema,
  roomMatchSchema,
  roomChatMessageSchema,
  roomParticipantSchema,
  roomSchema,
  roomSeatStateSchema,
  roomSnapshotSchema,
  shortCodeSchema,
  serverSocketEventSchema,
} from './types.js';

describe('online shared contracts', () => {
  it('parses the Stage 2 room, seat, participant, and chat shapes', () => {
    const room = {
      roomId: 'room-42',
      shortCode: 'ABCD23',
      revision: 7,
      status: 'waiting',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:05:00.000Z',
      expiresAt: '2026-05-21T10:05:00.000Z',
      lastActiveAt: '2026-05-20T10:05:00.000Z',
      activeMatchId: null,
    };

    const host = {
      participantId: 'participant-host',
      roomId: 'room-42',
      displayName: 'Host',
      role: 'host',
      seat: 'red',
      status: 'connected',
      joinedAt: '2026-05-20T10:00:00.000Z',
      leftAt: null,
    };

    const chatMessage = {
      messageId: 'message-1',
      roomId: 'room-42',
      participantId: 'participant-host',
      body: 'Ready to play',
      status: 'sent',
      createdAt: '2026-05-20T10:05:00.000Z',
    };

    const match = {
      matchId: 'match-1',
      roomId: 'room-42',
      revision: 0,
      state: {
        board: Array.from({ length: 10 }, () => Array.from({ length: 9 }).fill(null)),
        currentSide: 'red',
        playerSide: 'red',
        openingSide: 'red',
        moveHistory: [],
        captured: { red: [], black: [] },
        lastMove: null,
        selectedPieceId: null,
        legalTargets: [],
        check: null,
        gameOver: null,
        aiDifficulty: 'normal',
      },
      redParticipantId: 'participant-host',
      blackParticipantId: 'participant-guest',
      winner: null,
    };

    expect(roomSchema.parse(room)).toEqual(room);
    expect(roomParticipantSchema.parse(host)).toEqual(host);
    expect(roomMatchSchema.parse(match)).toEqual(match);
    expect(
      roomSeatStateSchema.parse({
        seat: 'red',
        status: 'occupied',
        participantId: 'participant-host',
      }),
    ).toEqual({
      seat: 'red',
      status: 'occupied',
      participantId: 'participant-host',
    });
    expect(roomChatMessageSchema.parse(chatMessage)).toEqual(chatMessage);
    expect(
      roomSnapshotSchema.parse({
        room,
        participants: [host],
        seats: [
          {
            seat: 'red',
            status: 'occupied',
            participantId: 'participant-host',
          },
          {
            seat: 'black',
            status: 'open',
            participantId: null,
          },
        ],
        messages: [chatMessage],
        match: null,
      }),
    ).toBeTruthy();
  });

  it('parses the Stage 2 client and server socket event shapes', () => {
    expect(
      clientSocketEventSchema.parse({
        type: 'room.join',
        roomId: 'room-42',
        shortCode: 'ABCD23',
        displayName: 'Guest',
        token: 'token-123',
      }),
    ).toEqual({
      type: 'room.join',
      roomId: 'room-42',
      shortCode: 'ABCD23',
      displayName: 'Guest',
      token: 'token-123',
    });

    expect(
      serverSocketEventSchema.parse({
        type: 'match.updated',
        revision: 8,
        match: {
          matchId: 'match-1',
          roomId: 'room-42',
          revision: 8,
          state: {
            board: Array.from({ length: 10 }, () => Array.from({ length: 9 }).fill(null)),
            currentSide: 'red',
            playerSide: 'red',
            openingSide: 'red',
            moveHistory: [],
            captured: { red: [], black: [] },
            lastMove: null,
            selectedPieceId: null,
            legalTargets: [],
            check: null,
            gameOver: null,
            aiDifficulty: 'normal',
          },
          redParticipantId: 'participant-host',
          blackParticipantId: 'participant-guest',
          winner: null,
        },
      }),
    ).toEqual({
      type: 'match.updated',
      revision: 8,
      match: {
        matchId: 'match-1',
        roomId: 'room-42',
        revision: 8,
        state: {
          board: Array.from({ length: 10 }, () => Array.from({ length: 9 }).fill(null)),
          currentSide: 'red',
          playerSide: 'red',
          openingSide: 'red',
          moveHistory: [],
          captured: { red: [], black: [] },
          lastMove: null,
          selectedPieceId: null,
          legalTargets: [],
          check: null,
          gameOver: null,
          aiDifficulty: 'normal',
        },
        redParticipantId: 'participant-host',
        blackParticipantId: 'participant-guest',
        winner: null,
      },
    });
  });

  it('rejects room.join events without the required room token', () => {
    expect(() =>
      clientSocketEventSchema.parse({
        type: 'room.join',
        roomId: 'room-42',
        shortCode: 'ABCD23',
        displayName: 'Guest',
      }),
    ).toThrow();
  });

  it('rejects malformed move and match payloads', () => {
    expect(() =>
      clientSocketEventSchema.parse({
        type: 'match.move',
        revision: 2,
        move: {
          id: 'bad-move',
          pieceId: 'red-pawn-3',
          pieceType: 'pawn',
          side: 'red',
          from: { row: '6', col: 4 },
          to: { row: 5, col: 4 },
        },
      }),
    ).toThrow();

    expect(() =>
      serverSocketEventSchema.parse({
        type: 'match.updated',
        revision: 3,
        match: {
          matchId: 'match-1',
          roomId: 'room-42',
          revision: 3,
          state: {
            board: 'not-a-board',
          },
          redParticipantId: 'participant-host',
          blackParticipantId: 'participant-guest',
          winner: null,
        },
      }),
    ).toThrow();
  });

  it('rejects impossible room seat state combinations', () => {
    expect(() =>
      roomSeatStateSchema.parse({
        seat: 'red',
        status: 'open',
        participantId: 'participant-host',
      }),
    ).toThrow();

    expect(() =>
      roomSeatStateSchema.parse({
        seat: 'black',
        status: 'occupied',
        participantId: null,
      }),
    ).toThrow();
  });

  it('rejects room snapshots that do not contain exactly one red seat and one black seat', () => {
    const room = {
      roomId: 'room-42',
      shortCode: 'ABCD23',
      revision: 7,
      status: 'waiting',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:05:00.000Z',
      expiresAt: '2026-05-21T10:05:00.000Z',
      lastActiveAt: '2026-05-20T10:05:00.000Z',
      activeMatchId: null,
    };

    expect(() =>
      roomSnapshotSchema.parse({
        room,
        participants: [],
        seats: [
          { seat: 'red', status: 'open', participantId: null },
          { seat: 'red', status: 'open', participantId: null },
        ],
        messages: [],
        match: null,
      }),
    ).toThrow();
  });

  it('rejects short codes outside the restricted generator format', () => {
    expect(shortCodeSchema.parse('ABCD23')).toBe('ABCD23');
    expect(() => shortCodeSchema.parse('abcd23')).toThrow();
    expect(() => shortCodeSchema.parse('ABCD01')).toThrow();
    expect(() => shortCodeSchema.parse('ABCDIO')).toThrow();
  });
});
