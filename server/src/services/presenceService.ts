import type { Role } from '../types.js';
import { createRoomToken } from '../lib/roomTokens.js';

export type PresenceRecord = {
  participantId: string;
  roomId: string;
  shortCode: string;
  role: Role;
};

export type PresenceService = ReturnType<typeof createPresenceService>;

type PresenceServiceOptions = {
  now?: () => string;
};

export function createPresenceService(options: PresenceServiceOptions = {}) {
  void options;

  const records = new Map<string, PresenceRecord>();
  const activeTokenByParticipantId = new Map<string, string>();

  return {
    issueToken(record: PresenceRecord): string {
      const existingToken = activeTokenByParticipantId.get(record.participantId);
      if (existingToken) {
        records.delete(existingToken);
      }

      const token = createRoomToken();
      records.set(token, record);
      activeTokenByParticipantId.set(record.participantId, token);
      return token;
    },

    getRecord(token: string): PresenceRecord | null {
      return records.get(token) ?? null;
    },
  };
}
