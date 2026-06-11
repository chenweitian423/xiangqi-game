import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';

import { createDb, type Database } from './db.js';
import { resolveConfig, type ServerConfig } from './config.js';
import { healthResponseSchema, type HealthResponse } from './types.js';
import { createPresenceService, type PresenceService } from './services/presenceService.js';
import { createMatchService, type MatchService } from './services/matchService.js';
import { createRoomService, type RoomService } from './services/roomService.js';
import { createChatService, type ChatService } from './services/chatService.js';
import { registerCreateRoomRoute } from './routes/createRoom.js';
import { registerEndRoomRoute } from './routes/endRoom.js';
import { registerJoinRoomRoute } from './routes/joinRoom.js';
import { registerGetRoomRoute } from './routes/getRoom.js';
import { registerRoomSocketRoute } from './ws/roomSocket.js';

export { createDb, loadSchemaSql, schemaFileUrl } from './db.js';
export { createShortCodeGenerator, hashRoomSecret, resolveConfig } from './config.js';
export * from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    db: Database;
    presenceService: PresenceService;
    matchService: MatchService;
    roomService: RoomService;
    chatService: ChatService;
  }
}

export type BuildServerOptions = {
  config?: Partial<ServerConfig>;
  db?: Database;
};

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const config = resolveConfig(options.config);
  const db = options.db ?? createDb(config);
  const ownsDb = options.db === undefined;

  const app = Fastify({
    logger: false,
  });

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('presenceService', createPresenceService());
  app.decorate('matchService', createMatchService());
  app.decorate('chatService', createChatService());
  app.decorate(
    'roomService',
    createRoomService({
      shortCodeLength: config.shortCodeLength,
      bcryptSaltRounds: config.bcryptSaltRounds,
      presenceService: app.presenceService,
    }),
  );

  await app.register(websocket);
  registerCors(app);
  await registerCreateRoomRoute(app);
  await registerJoinRoomRoute(app);
  await registerGetRoomRoute(app);
  await registerEndRoomRoute(app);
  await registerRoomSocketRoute(app);

  app.get('/health', async () => {
    const payload: HealthResponse = {
      ok: true,
      service: 'xiangqi-online-server',
    };

    return healthResponseSchema.parse(payload);
  });

  if (ownsDb) {
    app.addHook('onClose', async () => {
      await db.close();
    });
  }

  await app.ready();
  return app;
}

function registerCors(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && app.config.corsOrigins.includes(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
    }

    reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type,authorization');

    if (request.method === 'OPTIONS') {
      await reply.code(204).send();
    }
  });
}
