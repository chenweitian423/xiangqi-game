import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { extractBearerToken } from '../lib/roomTokens.js';
import { RoomNotFoundError } from '../services/roomService.js';

const endRoomParamsSchema = z.object({
  shortCode: z.string().trim().min(1),
});

export async function registerEndRoomRoute(app: FastifyInstance): Promise<void> {
  app.post('/rooms/:shortCode/end', async (request, reply) => {
    const { shortCode } = endRoomParamsSchema.parse(request.params);
    const callerToken = extractBearerToken(request.headers.authorization);

    if (!callerToken) {
      return reply.status(401).send({
        error: 'missing-token',
        message: 'A room token is required to end this room.',
      });
    }

    const presenceRecord = app.presenceService.getRecord(callerToken);
    if (!presenceRecord || presenceRecord.shortCode !== shortCode.toUpperCase()) {
      return reply.status(403).send({
        error: 'host-only',
        message: 'Only the host can end this room.',
      });
    }

    if (presenceRecord.role !== 'host') {
      return reply.status(403).send({
        error: 'host-only',
        message: 'Only the host can end this room.',
      });
    }

    try {
      const roomPayload = app.roomService.getRoom(shortCode, callerToken);
      app.roomService.finishRoom(shortCode, roomPayload.room.activeMatchId);
      const updatedRoom = app.roomService.getRoom(shortCode, callerToken);
      return reply.status(200).send(updatedRoom);
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
