import type { FastifyInstance } from 'fastify';

import { clientSocketEventSchema, type RoomSnapshot, type ServerSocketEvent } from '../types.js';

type SocketLike = {
  send: (payload: string) => void;
  on: (event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void) => void;
};

type SocketMembership = {
  roomId: string;
  shortCode: string;
  participantId: string;
  token: string;
};

function withMatch(snapshot: RoomSnapshot, match: RoomSnapshot['match']): RoomSnapshot {
  return {
    ...snapshot,
    room: {
      ...snapshot.room,
      activeMatchId: match?.matchId ?? snapshot.room.activeMatchId,
      status:
        match?.state.gameOver || match?.winner
          ? 'finished'
          : match
            ? 'active'
            : snapshot.room.status,
    },
    match,
  };
}

function withMessages(
  snapshot: RoomSnapshot,
  messages: RoomSnapshot['messages'],
): RoomSnapshot {
  return {
    ...snapshot,
    messages,
  };
}

export async function registerRoomSocketRoute(app: FastifyInstance): Promise<void> {
  const socketsByRoomId = new Map<string, Set<SocketLike>>();
  const memberships = new WeakMap<SocketLike, SocketMembership>();

  function send(socket: SocketLike, event: ServerSocketEvent): void {
    socket.send(JSON.stringify(event));
  }

  function broadcast(roomId: string, event: ServerSocketEvent): void {
    const sockets = socketsByRoomId.get(roomId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      send(socket, event);
    }
  }

  function removeSocket(socket: SocketLike): void {
    const membership = memberships.get(socket);
    if (!membership) {
      return;
    }

    const sockets = socketsByRoomId.get(membership.roomId);
    sockets?.delete(socket);
    if (sockets && sockets.size === 0) {
      socketsByRoomId.delete(membership.roomId);
    }
    memberships.delete(socket);
  }

  app.get('/ws', { websocket: true }, (socket) => {
    const connection = socket as unknown as SocketLike;

    connection.on('message', (rawPayload) => {
      let payload: unknown;

      try {
        const messageText =
          typeof rawPayload === 'string'
            ? rawPayload
            : rawPayload instanceof Uint8Array
              ? Buffer.from(rawPayload).toString('utf8')
              : String(rawPayload);
        payload = JSON.parse(messageText);
      } catch {
        send(connection, {
          type: 'room.error',
          message: 'Unable to parse the websocket message.',
        });
        return;
      }

      let event;
      try {
        event = clientSocketEventSchema.parse(payload);
      } catch {
        send(connection, {
          type: 'room.error',
          message: 'The websocket event payload was invalid.',
        });
        return;
      }

      if (event.type === 'room.heartbeat' || event.type === 'room.leave') {
        const membership = memberships.get(connection);
        if (membership && event.type === 'room.heartbeat') {
          try {
            app.roomService.touchRoom(membership.shortCode);
          } catch {
            send(connection, {
              type: 'room.error',
              code: 'room-unavailable',
              message: 'This room has expired.',
            });
          }
        }
        if (membership && event.type === 'room.leave') {
          app.roomService.markParticipantDisconnected(
            membership.shortCode,
            membership.participantId,
          );
          removeSocket(connection);
        }
        return;
      }

      if (event.type === 'room.join') {
        const token = event.token;
        if (!token) {
          send(connection, {
            type: 'room.error',
            message: 'Missing room token.',
          });
          return;
        }

        const presenceRecord = app.presenceService.getRecord(token);
        if (!presenceRecord) {
          send(connection, {
            type: 'room.error',
            code: 'invalid-token',
            message: 'The saved room token is invalid.',
          });
          return;
        }

        if (presenceRecord.roomId !== event.roomId || presenceRecord.shortCode !== event.shortCode) {
          send(connection, {
            type: 'room.error',
            code: 'invalid-token',
            message: 'The room token does not match this room.',
          });
          return;
        }

        let roomPayload;
        try {
          roomPayload = app.roomService.getRoom(event.shortCode, token);
        } catch {
          send(connection, {
            type: 'room.error',
            code: 'room-unavailable',
            message: 'This room has expired.',
          });
          return;
        }

        app.roomService.markParticipantConnected(event.shortCode, presenceRecord.participantId);
        roomPayload = app.roomService.getRoom(event.shortCode, token);
        if (!roomPayload.snapshot) {
          send(connection, {
            type: 'room.error',
            message: 'Unable to load the room snapshot.',
          });
          return;
        }

        let snapshot = roomPayload.snapshot;
        const redSeat = snapshot.participants.find((participant) => participant.seat === 'red');
        const blackSeat = snapshot.participants.find((participant) => participant.seat === 'black');

        if (redSeat && blackSeat) {
          const match = app.matchService.ensureMatch({
            roomId: snapshot.room.roomId,
            redParticipantId: redSeat.participantId,
            blackParticipantId: blackSeat.participantId,
          });
          app.roomService.attachMatch(event.shortCode, match.matchId);
          const refreshed = app.roomService.getRoom(event.shortCode, token);
          if (refreshed.snapshot) {
            snapshot = withMatch(refreshed.snapshot, match);
          } else {
            snapshot = withMatch(snapshot, match);
          }
        } else {
          snapshot = withMatch(snapshot, null);
        }

        if (snapshot.match?.state.gameOver || snapshot.match?.winner) {
          app.roomService.finishRoom(event.shortCode, snapshot.match.matchId);
          const refreshed = app.roomService.getRoom(event.shortCode, token);
          if (refreshed.snapshot) {
            snapshot = withMatch(refreshed.snapshot, snapshot.match);
          }
        }

        snapshot = withMessages(snapshot, app.chatService.listMessages(snapshot.room.roomId));

        removeSocket(connection);
        memberships.set(connection, {
          roomId: snapshot.room.roomId,
          shortCode: snapshot.room.shortCode,
          participantId: presenceRecord.participantId,
          token,
        });
        const roomSockets = socketsByRoomId.get(snapshot.room.roomId) ?? new Set<SocketLike>();
        roomSockets.add(connection);
        socketsByRoomId.set(snapshot.room.roomId, roomSockets);

        send(connection, {
          type: 'room.snapshot',
          revision: snapshot.room.revision,
          snapshot,
        });
        return;
      }

      const membership = memberships.get(connection);
      if (!membership) {
        send(connection, {
          type: 'room.error',
          message: 'Join the room before sending match events.',
        });
        return;
      }

      if (event.type === 'room.chat.send') {
        let roomPayload;
        try {
          app.roomService.touchRoom(membership.shortCode);
          roomPayload = app.roomService.getRoom(membership.shortCode, membership.token);
        } catch {
          send(connection, {
            type: 'room.error',
            code: 'room-unavailable',
            message: 'This room has expired.',
          });
          return;
        }

        if (!roomPayload.snapshot) {
          send(connection, {
            type: 'room.error',
            message: 'Unable to load the room snapshot.',
          });
          return;
        }

        const participantExists = roomPayload.snapshot.participants.some(
          (participant) => participant.participantId === membership.participantId,
        );

        if (!participantExists) {
          send(connection, {
            type: 'room.error',
            code: 'invalid-token',
            message: 'Join the room with a valid participant token before chatting.',
          });
          return;
        }

        const message = app.chatService.postMessage({
          roomId: membership.roomId,
          participantId: membership.participantId,
          body: event.body,
        });

        broadcast(membership.roomId, {
          type: 'room.chat.posted',
          revision: roomPayload.snapshot.room.revision,
          message,
        });
        return;
      }

      if (event.type === 'match.move') {
        try {
          app.roomService.touchRoom(membership.shortCode);
        } catch {
          send(connection, {
            type: 'room.error',
            code: 'room-unavailable',
            message: 'This room has expired.',
          });
          return;
        }
        const result = app.matchService.applyMove({
          roomId: membership.roomId,
          participantId: membership.participantId,
          revision: event.revision,
          move: event.move,
        });

        if (!result.accepted) {
          send(connection, {
            type: 'match.rejected',
            revision: result.expectedRevision ?? event.revision,
            reason: result.reason,
            ...(result.expectedRevision !== undefined
              ? { expectedRevision: result.expectedRevision }
              : {}),
            message: result.message,
          });
          return;
        }

        broadcast(membership.roomId, {
          type: 'match.updated',
          revision: result.match.revision,
          match: result.match,
        });

        if (result.match.state.gameOver || result.match.winner) {
          app.roomService.finishRoom(membership.shortCode, result.match.matchId);
        }
      }
    });

    connection.on('close', () => {
      const membership = memberships.get(connection);
      if (membership) {
        app.roomService.markParticipantDisconnected(
          membership.shortCode,
          membership.participantId,
        );
      }
      removeSocket(connection);
    });

    connection.on('error', () => {
      const membership = memberships.get(connection);
      if (membership) {
        app.roomService.markParticipantDisconnected(
          membership.shortCode,
          membership.participantId,
        );
      }
      removeSocket(connection);
    });
  });
}
