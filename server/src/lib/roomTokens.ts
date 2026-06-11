import { nanoid } from 'nanoid';

const TOKEN_SIZE = 24;

export function createRoomToken(): string {
  return nanoid(TOKEN_SIZE);
}

export function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}
