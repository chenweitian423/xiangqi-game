import { nanoid } from 'nanoid';

import { createShortCodeGenerator } from '../config.js';
import { getRoomExpiryTimestamp, isRoomExpired } from '../lib/expiry.js';
import { hashRoomPassword, normalizeRoomPassword, verifyRoomPassword } from '../lib/passwords.js';
import type { PresenceService } from './presenceService.js';
import type { Role, Room, RoomParticipant, RoomSnapshot, RoomStatus, Seat } from '../types.js';

export type RoomSessionPayload = {
  room: Room;
  callerRole: Role;
  callerToken?: string;
  passwordRequired: boolean;
  snapshot: RoomSnapshot;
};

export type GetRoomPayload = {
  room: Room;
  callerRole: Role | null;
  callerToken?: string;
  passwordRequired: boolean;
  snapshot?: RoomSnapshot;
};

type StoredRoom = {
  room: Room;
  participants: RoomParticipant[];
  passwordHash: string | null;
  snapshot: RoomSnapshot;
};

type CreateRoomInput = {
  nickname: string;
  password?: string;
};

type JoinRoomInput = {
  shortCode: string;
  nickname: string;
  password?: string;
  callerToken?: string | null;
};

export class RoomNotFoundError extends Error {
  constructor() {
    super('Room not found.');
  }
}

export class InvalidRoomPasswordError extends Error {
  constructor() {
    super('The room password is incorrect.');
  }
}

export class GuestSeatOccupiedError extends Error {
  constructor() {
    super('The guest seat is already occupied. Rejoin with your saved room token.');
  }
}

export function createRoomService(options: {
  shortCodeLength: number;
  bcryptSaltRounds: number;
  presenceService: PresenceService;
  now?: () => string;
}) {
  const roomsByCode = new Map<string, StoredRoom>();
  const generateShortCode = createShortCodeGenerator(options.shortCodeLength);
  const now = options.now ?? (() => new Date().toISOString());

  function createRoomRecord(shortCode: string): Room {
    const timestamp = now();
    return {
      roomId: `room_${nanoid(10)}`,
      shortCode,
      revision: 0,
      status: 'waiting',
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: getRoomExpiryTimestamp(timestamp, 'waiting'),
      lastActiveAt: timestamp,
      activeMatchId: null,
    };
  }

  function createParticipant(input: {
    roomId: string;
    nickname: string;
    role: Role;
    seat: Seat | null;
  }): RoomParticipant {
    return {
      participantId: `participant_${nanoid(10)}`,
      roomId: input.roomId,
      displayName: input.nickname.trim(),
      role: input.role,
      seat: input.seat,
      status: 'connected',
      joinedAt: now(),
      leftAt: null,
    };
  }

  function createSnapshot(room: Room, participants: RoomParticipant[]): RoomSnapshot {
    const redParticipant = participants.find((participant) => participant.seat === 'red');
    const blackParticipant = participants.find((participant) => participant.seat === 'black');

    return {
      room,
      participants,
      seats: [
        redParticipant
          ? {
              seat: 'red',
              status: 'occupied',
              participantId: redParticipant.participantId,
            }
          : {
              seat: 'red',
              status: 'open',
              participantId: null,
            },
        blackParticipant
          ? {
              seat: 'black',
              status: 'occupied',
              participantId: blackParticipant.participantId,
            }
          : {
              seat: 'black',
              status: 'open',
              participantId: null,
            },
      ],
      messages: [],
      match: null,
    };
  }

  function refreshStoredRoom(
    storedRoom: StoredRoom,
    options: {
      status?: RoomStatus;
      meaningfulActivity?: boolean;
      bumpRevision?: boolean;
      activeMatchId?: string | null;
    } = {},
  ): void {
    const nextStatus = options.status ?? storedRoom.room.status;
    const timestamp = now();
    const lastActiveAt = options.meaningfulActivity ? timestamp : storedRoom.room.lastActiveAt;
    storedRoom.room = {
      ...storedRoom.room,
      ...(options.activeMatchId !== undefined
        ? {
            activeMatchId: options.activeMatchId,
          }
        : {}),
      status: nextStatus,
      revision: options.bumpRevision === false ? storedRoom.room.revision : storedRoom.room.revision + 1,
      updatedAt: timestamp,
      lastActiveAt,
      expiresAt: getRoomExpiryTimestamp(lastActiveAt, nextStatus),
    };
    storedRoom.snapshot = createSnapshot(storedRoom.room, [...storedRoom.participants]);
  }

  function getStoredRoom(shortCode: string): StoredRoom {
    const storedRoom = roomsByCode.get(shortCode.toUpperCase());
    if (!storedRoom) {
      throw new RoomNotFoundError();
    }

    if (isRoomExpired(storedRoom.room.lastActiveAt, storedRoom.room.status, now())) {
      roomsByCode.delete(shortCode.toUpperCase());
      throw new RoomNotFoundError();
    }

    return storedRoom;
  }

  function createUniqueShortCode(): string {
    let nextShortCode = generateShortCode();
    while (roomsByCode.has(nextShortCode)) {
      nextShortCode = generateShortCode();
    }
    return nextShortCode;
  }

  function setParticipantStatus(
    storedRoom: StoredRoom,
    participantId: string,
    status: RoomParticipant['status'],
  ): boolean {
    const participant = storedRoom.participants.find((candidate) => candidate.participantId === participantId);
    if (!participant || participant.status === status) {
      return false;
    }

    participant.status = status;
    participant.leftAt = status === 'left' ? now() : null;
    return true;
  }

  return {
    async createRoom(input: CreateRoomInput): Promise<RoomSessionPayload> {
      const shortCode = createUniqueShortCode();
      const room = createRoomRecord(shortCode);
      const host = createParticipant({
        roomId: room.roomId,
        nickname: input.nickname,
        role: 'host',
        seat: 'red',
      });
      const password = normalizeRoomPassword(input.password);
      const passwordHash = password
        ? await hashRoomPassword(password, options.bcryptSaltRounds)
        : null;

      const storedRoom: StoredRoom = {
        room,
        participants: [host],
        passwordHash,
        snapshot: createSnapshot(room, [host]),
      };

      roomsByCode.set(shortCode, storedRoom);

      const callerToken = options.presenceService.issueToken({
        participantId: host.participantId,
        roomId: room.roomId,
        shortCode,
        role: host.role,
      });

      return {
        room: storedRoom.room,
        callerRole: host.role,
        callerToken,
        passwordRequired: passwordHash !== null,
        snapshot: storedRoom.snapshot,
      };
    },

    async joinRoom(input: JoinRoomInput): Promise<RoomSessionPayload> {
      const storedRoom = getStoredRoom(input.shortCode);

      const passwordMatches = await verifyRoomPassword(input.password, storedRoom.passwordHash);
      if (!passwordMatches) {
        throw new InvalidRoomPasswordError();
      }

      const existingGuest = storedRoom.participants.find((participant) => participant.role === 'guest');
      const presenceRecord = input.callerToken
        ? options.presenceService.getRecord(input.callerToken)
        : null;
      const isGuestRejoin =
        existingGuest !== undefined &&
        presenceRecord?.roomId === storedRoom.room.roomId &&
        presenceRecord.participantId === existingGuest.participantId &&
        presenceRecord.role === 'guest';

      if (existingGuest && !isGuestRejoin) {
        throw new GuestSeatOccupiedError();
      }

      const guest =
        existingGuest ??
        createParticipant({
          roomId: storedRoom.room.roomId,
          nickname: input.nickname,
          role: 'guest',
          seat: 'black',
        });

      if (!existingGuest) {
        storedRoom.participants = [...storedRoom.participants, guest];
        refreshStoredRoom(storedRoom, {
          status: 'active',
          meaningfulActivity: true,
        });
      } else {
        const statusChanged = setParticipantStatus(storedRoom, guest.participantId, 'connected');
        refreshStoredRoom(storedRoom, {
          meaningfulActivity: true,
          bumpRevision: statusChanged,
        });
      }

      const callerToken = options.presenceService.issueToken({
        participantId: guest.participantId,
        roomId: storedRoom.room.roomId,
        shortCode: storedRoom.room.shortCode,
        role: guest.role,
      });

      return {
        room: storedRoom.room,
        callerRole: guest.role,
        callerToken,
        passwordRequired: storedRoom.passwordHash !== null,
        snapshot: storedRoom.snapshot,
      };
    },

    getRoom(shortCode: string, callerToken?: string | null): GetRoomPayload {
      const storedRoom = getStoredRoom(shortCode);

      const presenceRecord = callerToken ? options.presenceService.getRecord(callerToken) : null;
      const callerRole =
        presenceRecord && presenceRecord.roomId === storedRoom.room.roomId
          ? presenceRecord.role
          : null;
      const isAuthenticatedForRoom = callerRole !== null;

      return {
        room: storedRoom.room,
        callerRole,
        callerToken: callerRole ? callerToken ?? undefined : undefined,
        passwordRequired: storedRoom.passwordHash !== null,
        snapshot:
          !storedRoom.passwordHash || isAuthenticatedForRoom
            ? storedRoom.snapshot
            : undefined,
      };
    },

    attachMatch(shortCode: string, matchId: string): GetRoomPayload {
      const storedRoom = getStoredRoom(shortCode);

      if (storedRoom.room.activeMatchId !== matchId) {
        refreshStoredRoom(storedRoom, {
          status: 'active',
          meaningfulActivity: true,
          activeMatchId: matchId,
        });
      }

      return {
        room: storedRoom.room,
        callerRole: null,
        passwordRequired: storedRoom.passwordHash !== null,
        snapshot: storedRoom.snapshot,
      };
    },

    touchRoom(shortCode: string): void {
      const storedRoom = getStoredRoom(shortCode);
      refreshStoredRoom(storedRoom, {
        bumpRevision: false,
      });
    },

    markParticipantConnected(shortCode: string, participantId: string): void {
      const storedRoom = getStoredRoom(shortCode);
      const statusChanged = setParticipantStatus(storedRoom, participantId, 'connected');
      refreshStoredRoom(storedRoom, {
        meaningfulActivity: true,
        bumpRevision: statusChanged,
      });
    },

    markParticipantDisconnected(shortCode: string, participantId: string): void {
      const storedRoom = getStoredRoom(shortCode);
      const statusChanged = setParticipantStatus(storedRoom, participantId, 'left');
      if (statusChanged) {
        refreshStoredRoom(storedRoom);
      }
    },

    finishRoom(shortCode: string, matchId: string | null): void {
      const storedRoom = getStoredRoom(shortCode);
      refreshStoredRoom(storedRoom, {
        status: 'finished',
        meaningfulActivity: true,
        activeMatchId: matchId,
      });
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
