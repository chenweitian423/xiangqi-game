import { buildServer } from './index.js';

async function start(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({
      host: app.config.host,
      port: app.config.port,
    });
    console.log(
      `xiangqi-online-server listening on ${app.config.host}:${String(app.config.port)}`,
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}

void start();
