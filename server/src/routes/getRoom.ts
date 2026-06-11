import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { extractBearerToken } from '../lib/roomTokens.js';
import { RoomNotFoundError } from '../services/roomService.js';

const getRoomParamsSchema = z.object({
  shortCode: z.string().trim().min(1),
});

export async function registerGetRoomRoute(app: FastifyInstance): Promise<void> {
  app.get('/rooms/:shortCode', async (request, reply) => {
    const { shortCode } = getRoomParamsSchema.parse(request.params);
    const callerToken = extractBearerToken(request.headers.authorization);

    try {
      const roomPayload = app.roomService.getRoom(shortCode, callerToken);
      return reply.status(200).send(roomPayload);
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        return reply.status(404).send({
          error: 'room-not-found',
          message: 'The requested room does not exist.',
        });
      }

      throw error;
    }
  });
}
