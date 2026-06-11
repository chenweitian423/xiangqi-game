const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export const WAITING_ROOM_TTL_MS = DAY_IN_MS;
export const ACTIVE_ROOM_TTL_MS = 7 * DAY_IN_MS;

export function getRoomExpiryDurationMs(
  status: 'waiting' | 'active' | 'finished' | 'expired',
): number {
  return status === 'waiting' ? WAITING_ROOM_TTL_MS : ACTIVE_ROOM_TTL_MS;
}

export function getRoomExpiryTimestamp(
  lastActiveAt: string,
  status: 'waiting' | 'active' | 'finished' | 'expired',
): string {
  const expiresAt = new Date(Date.parse(lastActiveAt) + getRoomExpiryDurationMs(status));
  return expiresAt.toISOString();
}

export function isRoomExpired(
  lastActiveAt: string,
  status: 'waiting' | 'active' | 'finished' | 'expired',
  now: string,
): boolean {
  return Date.parse(now) > Date.parse(getRoomExpiryTimestamp(lastActiveAt, status));
}
