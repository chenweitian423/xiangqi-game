import { shortCodeAlphabet, type MatchRejectedReason, type Role, type Room, type RoomChatMessage, type RoomMatch, type RoomParticipant, type RoomSnapshot, type RoomStatus, type Seat } from '../../server/src/contracts.js';
import { applyMove } from '../../src/game/applyMove.js';
import { createInitialGameState } from '../../src/game/initialState.js';
import { generateLegalMoves, getCheckSide, getWinner } from '../../src/game/legality.js';
import type { GameState, Move, Side } from '../../src/game/types.js';

const WAITING_ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_ROOM_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 100_000;
const STORAGE_KEY = 'room-state';

type PasswordRecord = {
  salt: string;
  hash: string;
  iterations: number;
};

type PresenceRecord = {
  participantId: string;
  roomId: string;
  shortCode: string;
  role: Role;
};

export type StoredRoomState = {
  room: Room;
  participants: RoomParticipant[];
  password: PasswordRecord | null;
  match: RoomMatch | null;
  messages: RoomChatMessage[];
  presenceByToken: Record<string, PresenceRecord>;
  tokenByParticipantId: Record<string, string>;
};

export class RoomNotFoundError extends Error {
  constructor() {
    super('The requested room does not exist.');
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

export class InvalidTokenError extends Error {
  constructor(message = 'The saved room token is invalid.') {
    super(message);
  }
}

export type MatchMoveResult =
  | {
      accepted: true;
      room: StoredRoomState;
      match: RoomMatch;
    }
  | {
      accepted: false;
      reason: MatchRejectedReason;
      expectedRevision?: number;
      message: string;
    };

type RoomFactoryOptions = {
  shortCode: string;
  nickname: string;
  password?: string;
  now?: () => string;
  randomId?: (prefix: string) => string;
  randomToken?: () => string;
};

type JoinRoomOptions = {
  nickname: string;
  password?: string;
  callerToken?: string | null;
  now?: () => string;
  randomId?: (prefix: string) => string;
  randomToken?: () => string;
};

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultRandomId(prefix: string): string {
  return `${prefix}_${randomToken(10)}`;
}

export function storageKey(): string {
  return STORAGE_KEY;
}

export function normalizeRoomPassword(password?: string): string | null {
  if (typeof password !== 'string') {
    return null;
  }

  const normalized = password.trim();
  return normalized.length > 0 ? normalized : null;
}

function plusDuration(timestamp: string, durationMs: number): string {
  return new Date(new Date(timestamp).getTime() + durationMs).toISOString();
}

export function getRoomExpiryTimestamp(
  lastActiveAt: string,
  status: RoomStatus,
): string {
  return plusDuration(
    lastActiveAt,
    status === 'waiting' ? WAITING_ROOM_EXPIRY_MS : ACTIVE_ROOM_EXPIRY_MS,
  );
}

export function isRoomExpired(
  lastActiveAt: string,
  status: RoomStatus,
  now = defaultNow(),
): boolean {
  return new Date(now).getTime() > new Date(getRoomExpiryTimestamp(lastActiveAt, status)).getTime();
}

function createParticipant(
  roomId: string,
  nickname: string,
  role: Role,
  seat: Seat | null,
  randomIdFn: (prefix: string) => string,
  now: () => string,
): RoomParticipant {
  return {
    participantId: randomIdFn('participant'),
    roomId,
    displayName: nickname.trim(),
    role,
    seat,
    status: 'connected',
    joinedAt: now(),
    leftAt: null,
  };
}

function createPresenceRecord(
  participant: RoomParticipant,
  room: Room,
): PresenceRecord {
  return {
    participantId: participant.participantId,
    roomId: room.roomId,
    shortCode: room.shortCode,
    role: participant.role,
  };
}

function clonePiecePosition<T extends { row: number; col: number }>(value: T): T {
  return {
    ...value,
    row: value.row,
    col: value.col,
  };
}

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((row) =>
      row.map((piece) =>
        piece
          ? {
              ...piece,
              position: clonePiecePosition(piece.position),
            }
          : null,
      ),
    ),
    moveHistory: state.moveHistory.map((move) => ({
      ...move,
      from: clonePiecePosition(move.from),
      to: clonePiecePosition(move.to),
      ...(move.captured
        ? {
            captured: {
              ...move.captured,
              position: clonePiecePosition(move.captured.position),
            },
          }
        : {}),
    })),
    captured: {
      red: state.captured.red.map((piece) => ({
        ...piece,
        position: clonePiecePosition(piece.position),
      })),
      black: state.captured.black.map((piece) => ({
        ...piece,
        position: clonePiecePosition(piece.position),
      })),
    },
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          from: clonePiecePosition(state.lastMove.from),
          to: clonePiecePosition(state.lastMove.to),
          ...(state.lastMove.captured
            ? {
                captured: {
                  ...state.lastMove.captured,
                  position: clonePiecePosition(state.lastMove.captured.position),
                },
              }
            : {}),
        }
      : null,
    legalTargets: state.legalTargets.map((position) => clonePiecePosition(position)),
    gameOver: state.gameOver ? { ...state.gameOver } : null,
  };
}

function cloneMatch(match: RoomMatch | null): RoomMatch | null {
  if (!match) {
    return null;
  }

  return {
    ...match,
    state: cloneGameState(match.state),
  };
}

export function cloneRoomState(state: StoredRoomState): StoredRoomState {
  return {
    room: { ...state.room },
    participants: state.participants.map((participant) => ({ ...participant })),
    password: state.password ? { ...state.password } : null,
    match: cloneMatch(state.match),
    messages: state.messages.map((message) => ({ ...message })),
    presenceByToken: { ...state.presenceByToken },
    tokenByParticipantId: { ...state.tokenByParticipantId },
  };
}

export function createRoomSnapshot(state: StoredRoomState): RoomSnapshot {
  const participants = state.participants.map((participant) => ({ ...participant }));
  const redParticipant = participants.find((participant) => participant.seat === 'red');
  const blackParticipant = participants.find((participant) => participant.seat === 'black');

  return {
    room: { ...state.room },
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
    messages: state.messages.map((message) => ({ ...message })),
    match: cloneMatch(state.match),
  };
}

function updateRoomMetadata(
  room: Room,
  options: {
    now: string;
    status?: RoomStatus;
    meaningfulActivity?: boolean;
    bumpRevision?: boolean;
    activeMatchId?: string | null;
  },
): Room {
  const nextStatus = options.status ?? room.status;
  const lastActiveAt = options.meaningfulActivity ? options.now : room.lastActiveAt;

  return {
    ...room,
    status: nextStatus,
    revision: options.bumpRevision === false ? room.revision : room.revision + 1,
    updatedAt: options.now,
    lastActiveAt,
    expiresAt: getRoomExpiryTimestamp(lastActiveAt, nextStatus),
    activeMatchId:
      options.activeMatchId !== undefined ? options.activeMatchId : room.activeMatchId,
  };
}

function findParticipant(state: StoredRoomState, participantId: string): RoomParticipant | undefined {
  return state.participants.find((participant) => participant.participantId === participantId);
}

function recordToken(
  state: StoredRoomState,
  participant: RoomParticipant,
  room: Room,
  randomTokenFn: () => string,
): { nextState: StoredRoomState; token: string } {
  const existingToken = state.tokenByParticipantId[participant.participantId];
  const nextState = cloneRoomState(state);
  if (existingToken) {
    delete nextState.presenceByToken[existingToken];
  }

  const token = randomTokenFn();
  nextState.presenceByToken[token] = createPresenceRecord(participant, room);
  nextState.tokenByParticipantId[participant.participantId] = token;
  return { nextState, token };
}

async function derivePasswordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PASSWORD_ITERATIONS,
      salt: base64ToBytes(salt) as unknown as BufferSource,
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function hashRoomPassword(password: string): Promise<PasswordRecord> {
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  return {
    salt,
    hash: await derivePasswordHash(password, salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyRoomPassword(
  attempt: string | undefined,
  storedPassword: PasswordRecord | null,
): Promise<boolean> {
  if (!storedPassword) {
    return true;
  }

  const normalizedAttempt = normalizeRoomPassword(attempt);
  if (!normalizedAttempt) {
    return false;
  }

  const attemptHash = await derivePasswordHash(normalizedAttempt, storedPassword.salt);
  return attemptHash === storedPassword.hash;
}

function createInitialMatch(
  roomId: string,
  redParticipantId: string,
  blackParticipantId: string,
  randomIdFn: (prefix: string) => string,
): RoomMatch {
  return {
    matchId: randomIdFn('match'),
    roomId,
    revision: 0,
    state: createInitialGameState(),
    redParticipantId,
    blackParticipantId,
    winner: null,
  };
}

function hasKing(state: GameState, side: Side): boolean {
  return state.board.flat().some((piece) => piece?.side === side && piece.type === 'king');
}

function finalizeState(state: GameState): GameState {
  const winner = getWinner(state);
  const loser = winner ? (winner === 'red' ? 'black' : 'red') : null;

  return {
    ...state,
    check: getCheckSide(state),
    gameOver: winner
      ? {
          winner,
          reason: loser && hasKing(state, loser) ? 'no-legal-moves' : 'king-captured',
        }
      : null,
  };
}

export async function createRoomState({
  shortCode,
  nickname,
  password,
  now = defaultNow,
  randomId = defaultRandomId,
  randomToken = () => randomTokenValue(24),
}: RoomFactoryOptions): Promise<{ room: StoredRoomState; callerToken: string }> {
  const timestamp = now();
  const room: Room = {
    roomId: randomId('room'),
    shortCode,
    revision: 0,
    status: 'waiting',
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: getRoomExpiryTimestamp(timestamp, 'waiting'),
    lastActiveAt: timestamp,
    activeMatchId: null,
  };
  const host = createParticipant(room.roomId, nickname, 'host', 'red', randomId, now);
  const state: StoredRoomState = {
    room,
    participants: [host],
    password: normalizeRoomPassword(password)
      ? await hashRoomPassword(normalizeRoomPassword(password) ?? '')
      : null,
    match: null,
    messages: [],
    presenceByToken: {},
    tokenByParticipantId: {},
  };

  const { nextState, token } = recordToken(state, host, room, randomToken);
  return {
    room: nextState,
    callerToken: token,
  };
}

export async function joinRoomState(
  state: StoredRoomState,
  {
    nickname,
    password,
    callerToken,
    now = defaultNow,
    randomId = defaultRandomId,
    randomToken = () => randomTokenValue(24),
  }: JoinRoomOptions,
): Promise<{ room: StoredRoomState; callerToken: string; callerRole: Role }> {
  if (isRoomExpired(state.room.lastActiveAt, state.room.status, now())) {
    throw new RoomNotFoundError();
  }

  const passwordMatches = await verifyRoomPassword(password, state.password);
  if (!passwordMatches) {
    throw new InvalidRoomPasswordError();
  }

  const existingGuest = state.participants.find((participant) => participant.role === 'guest');
  const presenceRecord = callerToken ? state.presenceByToken[callerToken] : null;
  const isGuestRejoin =
    Boolean(existingGuest) &&
    presenceRecord?.roomId === state.room.roomId &&
    presenceRecord?.participantId === existingGuest?.participantId &&
    presenceRecord?.role === 'guest';

  if (existingGuest && !isGuestRejoin) {
    throw new GuestSeatOccupiedError();
  }

  const nextState = cloneRoomState(state);
  let guest = nextState.participants.find((participant) => participant.role === 'guest');
  if (!guest) {
    guest = createParticipant(nextState.room.roomId, nickname, 'guest', 'black', randomId, now);
    nextState.participants.push(guest);
    nextState.match = createInitialMatch(
      nextState.room.roomId,
      nextState.participants.find((participant) => participant.seat === 'red')?.participantId ?? '',
      guest.participantId,
      randomId,
    );
    nextState.room = updateRoomMetadata(nextState.room, {
      now: now(),
      status: 'active',
      meaningfulActivity: true,
      activeMatchId: nextState.match.matchId,
    });
  } else {
    guest.status = 'connected';
    guest.leftAt = null;
    nextState.room = updateRoomMetadata(nextState.room, {
      now: now(),
      meaningfulActivity: true,
    });
  }

  const tokenResult = recordToken(nextState, guest, nextState.room, randomToken);
  return {
    room: tokenResult.nextState,
    callerToken: tokenResult.token,
    callerRole: 'guest',
  };
}

export function getRoomState(
  state: StoredRoomState,
  callerToken?: string | null,
  now = defaultNow(),
): {
  room: Room;
  callerRole: Role | null;
  callerToken?: string;
  passwordRequired: boolean;
  snapshot?: RoomSnapshot;
} {
  if (isRoomExpired(state.room.lastActiveAt, state.room.status, now)) {
    throw new RoomNotFoundError();
  }

  const presence = callerToken ? state.presenceByToken[callerToken] : null;
  const callerRole = presence?.roomId === state.room.roomId ? presence.role : null;
  const allowSnapshot = !state.password || callerRole !== null;

  return {
    room: { ...state.room },
    callerRole,
    callerToken: callerRole ? callerToken ?? undefined : undefined,
    passwordRequired: state.password !== null,
    ...(allowSnapshot
      ? {
          snapshot: createRoomSnapshot(state),
        }
      : {}),
  };
}

export function endRoomState(state: StoredRoomState, now = defaultNow()): StoredRoomState {
  const nextState = cloneRoomState(state);
  nextState.room = updateRoomMetadata(nextState.room, {
    now,
    meaningfulActivity: true,
    status: 'finished',
    activeMatchId: nextState.match?.matchId ?? nextState.room.activeMatchId,
  });
  return nextState;
}

export function restartMatchState(
  state: StoredRoomState,
  now = defaultNow(),
  randomId = defaultRandomId,
): StoredRoomState {
  const redParticipant = state.participants.find(
    (participant) => participant.seat === 'red' && participant.status === 'connected',
  );
  const blackParticipant = state.participants.find(
    (participant) => participant.seat === 'black' && participant.status === 'connected',
  );

  if (!redParticipant || !blackParticipant) {
    throw new GuestSeatOccupiedError();
  }

  const nextState = cloneRoomState(state);
  nextState.match = createInitialMatch(
    nextState.room.roomId,
    redParticipant.participantId,
    blackParticipant.participantId,
    randomId,
  );
  nextState.room = updateRoomMetadata(nextState.room, {
    now,
    meaningfulActivity: true,
    status: 'active',
    activeMatchId: nextState.match.matchId,
  });
  return nextState;
}

export function touchRoomState(state: StoredRoomState, now = defaultNow()): StoredRoomState {
  const nextState = cloneRoomState(state);
  nextState.room = updateRoomMetadata(nextState.room, {
    now,
    bumpRevision: false,
  });
  return nextState;
}

export function setParticipantConnected(
  state: StoredRoomState,
  participantId: string,
  now = defaultNow(),
): StoredRoomState {
  const nextState = cloneRoomState(state);
  const participant = findParticipant(nextState, participantId);
  if (!participant) {
    return nextState;
  }

  const statusChanged = participant.status !== 'connected';
  participant.status = 'connected';
  participant.leftAt = null;
  nextState.room = updateRoomMetadata(nextState.room, {
    now,
    meaningfulActivity: true,
    bumpRevision: statusChanged,
  });
  return nextState;
}

export function setParticipantDisconnected(
  state: StoredRoomState,
  participantId: string,
  now = defaultNow(),
): StoredRoomState {
  const nextState = cloneRoomState(state);
  const participant = findParticipant(nextState, participantId);
  if (!participant || participant.status === 'left') {
    return nextState;
  }

  participant.status = 'left';
  participant.leftAt = now;
  nextState.room = updateRoomMetadata(nextState.room, { now });
  return nextState;
}

export function postChatMessage(
  state: StoredRoomState,
  participantId: string | null,
  body: string,
  now = defaultNow(),
  randomId = defaultRandomId,
): { room: StoredRoomState; message: RoomChatMessage } {
  const nextState = cloneRoomState(state);
  const message: RoomChatMessage = {
    messageId: randomId('message'),
    roomId: nextState.room.roomId,
    participantId,
    body: body.trim(),
    status: 'sent',
    createdAt: now,
  };
  nextState.messages.push(message);
  nextState.room = updateRoomMetadata(nextState.room, {
    now,
    meaningfulActivity: false,
    bumpRevision: false,
  });
  return {
    room: nextState,
    message,
  };
}

export function applyMatchMove(
  state: StoredRoomState,
  participantId: string,
  revision: number,
  move: Move,
  now = defaultNow(),
): MatchMoveResult {
  if (!state.match) {
    return {
      accepted: false,
      reason: 'match_not_ready',
      message: 'The match is not ready yet.',
    };
  }

  const storedMatch = cloneMatch(state.match);
  if (!storedMatch) {
    return {
      accepted: false,
      reason: 'match_not_ready',
      message: 'The match is not ready yet.',
    };
  }

  if (revision !== storedMatch.revision) {
    return {
      accepted: false,
      reason: 'stale_revision',
      expectedRevision: storedMatch.revision,
      message: 'Your move was based on an old board state.',
    };
  }

  const participantSide =
    participantId === storedMatch.redParticipantId
      ? 'red'
      : participantId === storedMatch.blackParticipantId
        ? 'black'
        : null;

  if (!participantSide) {
    return {
      accepted: false,
      reason: 'spectator',
      message: 'Spectators cannot submit moves.',
    };
  }

  if (storedMatch.state.currentSide !== participantSide) {
    return {
      accepted: false,
      reason: 'out_of_turn',
      message: 'It is not your turn.',
    };
  }

  const legalMove = generateLegalMoves(storedMatch.state, move.pieceId).find(
    (candidate) =>
      candidate.id === move.id ||
      (candidate.from.row === move.from.row &&
        candidate.from.col === move.from.col &&
        candidate.to.row === move.to.row &&
        candidate.to.col === move.to.col &&
        candidate.pieceId === move.pieceId),
  );

  if (!legalMove) {
    return {
      accepted: false,
      reason: 'illegal_move',
      expectedRevision: storedMatch.revision,
      message: 'That move is not legal in the current position.',
    };
  }

  const nextStateValue = finalizeState(applyMove(storedMatch.state, legalMove));
  const nextMatch: RoomMatch = {
    ...storedMatch,
    revision: storedMatch.revision + 1,
    state: nextStateValue,
    winner: nextStateValue.gameOver?.winner ?? null,
  };

  const nextRoom = cloneRoomState(state);
  nextRoom.match = nextMatch;
  nextRoom.room = updateRoomMetadata(nextRoom.room, {
    now,
    meaningfulActivity: true,
    bumpRevision: false,
    status: 'active',
    activeMatchId: nextMatch.matchId,
  });

  return {
    accepted: true,
    room: nextRoom,
    match: nextMatch,
  };
}

export function createShortCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let value = '';
  for (const byte of bytes) {
    value += shortCodeAlphabet[byte % shortCodeAlphabet.length];
  }
  return value;
}

export function randomToken(size = 24): string {
  return randomTokenValue(size);
}

function randomTokenValue(size: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let value = '';
  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }
  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
