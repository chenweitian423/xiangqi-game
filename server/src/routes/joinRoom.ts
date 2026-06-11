import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { extractBearerToken } from '../lib/roomTokens.js';
import {
  GuestSeatOccupiedError,
  InvalidRoomPasswordError,
  RoomNotFoundError,
} from '../services/roomService.js';

const joinRoomParamsSchema = z.object({
  shortCode: z.string().trim().min(1),
});

const joinRoomBodySchema = z.object({
  nickname: z.string().trim().min(1),
  password: z.string().optional(),
});

export async function registerJoinRoomRoute(app: FastifyInstance): Promise<void> {
  app.post('/rooms/:shortCode/join', async (request, reply) => {
    const { shortCode } = joinRoomParamsSchema.parse(request.params);
    const payload = joinRoomBodySchema.parse(request.body);
    const callerToken = extractBearerToken(request.headers.authorization);

    try {
      const roomSession = await app.roomService.joinRoom({
        shortCode,
        ...payload,
        callerToken,
      });
      return reply.status(200).send(roomSession);
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        return reply.status(404).send({
          error: 'room-not-found',
          message: 'The requested room does not exist.',
        });
      }

      if (error instanceof InvalidRoomPasswordError) {
        return reply.status(403).send({
          error: 'invalid-room-password',
          message: 'The room password is incorrect.',
        });
      }

      if (error instanceof GuestSeatOccupiedError) {
        return reply.status(409).send({
          error: 'guest-seat-occupied',
          message: 'The guest seat is already occupied. Rejoin with your saved room token.',
        });
      }

      throw error;
    }
  });
}
