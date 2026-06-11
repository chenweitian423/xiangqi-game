import { compare, hash } from 'bcryptjs';

export function normalizeRoomPassword(password?: string | null): string | null {
  const normalized = password?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export async function hashRoomPassword(password: string, saltRounds: number): Promise<string> {
  return hash(password, saltRounds);
}

export async function verifyRoomPassword(
  password: string | undefined,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) {
    return true;
  }

  const normalized = normalizeRoomPassword(password);
  if (!normalized) {
    return false;
  }

  return compare(normalized, passwordHash);
}
