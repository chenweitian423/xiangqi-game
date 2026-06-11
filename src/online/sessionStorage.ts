import type { Role } from './types';

const STORAGE_PREFIX = 'xiangqi-online-room:';

export type StoredRoomSession = {
  code: string;
  token: string | null;
  role: Role;
  displayName?: string | null;
};

function createStorageKey(code: string): string {
  return `${STORAGE_PREFIX}${code.toUpperCase()}`;
}

export function saveRoomSession(session: StoredRoomSession): void {
  sessionStorage.setItem(createStorageKey(session.code), JSON.stringify(session));
}

export function loadRoomSession(code: string): StoredRoomSession | null {
  const rawValue = sessionStorage.getItem(createStorageKey(code));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredRoomSession> & {
      hostToken?: string | null;
      sessionToken?: string | null;
    };
    const role = parsed.role;
    if (role !== 'host' && role !== 'guest') {
      return null;
    }

    const token =
      typeof parsed.token === 'string'
        ? parsed.token
        : role === 'host'
          ? parsed.hostToken ?? null
          : parsed.sessionToken ?? null;

    return {
      code: parsed.code?.toUpperCase() ?? code.toUpperCase(),
      token,
      role,
      displayName:
        typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0
          ? parsed.displayName.trim()
          : null,
    };
  } catch {
    return null;
  }
}

export function clearRoomSession(code: string): void {
  sessionStorage.removeItem(createStorageKey(code));
}
