import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createRoomBodySchema = z.object({
  nickname: z.string().trim().min(1),
  password: z.string().optional(),
});

export async function registerCreateRoomRoute(app: FastifyInstance): Promise<void> {
  app.post('/rooms', async (request, reply) => {
    const payload = createRoomBodySchema.parse(request.body);
    const roomSession = await app.roomService.createRoom(payload);
    return reply.status(201).send(roomSession);
  });
}
