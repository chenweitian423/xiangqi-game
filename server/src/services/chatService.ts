import { nanoid } from 'nanoid';

import type { RoomChatMessage } from '../types.js';

type PostMessageInput = {
  roomId: string;
  participantId: string | null;
  body: string;
};

type ChatServiceOptions = {
  now?: () => string;
};

export function createChatService(options: ChatServiceOptions = {}) {
  const messagesByRoomId = new Map<string, RoomChatMessage[]>();
  const now = options.now ?? (() => new Date().toISOString());

  function cloneMessage(message: RoomChatMessage): RoomChatMessage {
    return { ...message };
  }

  return {
    postMessage(input: PostMessageInput): RoomChatMessage {
      const message: RoomChatMessage = {
        messageId: `message_${nanoid(10)}`,
        roomId: input.roomId,
        participantId: input.participantId,
        body: input.body,
        status: 'sent',
        createdAt: now(),
      };

      const roomMessages = messagesByRoomId.get(input.roomId) ?? [];
      roomMessages.push(message);
      messagesByRoomId.set(input.roomId, roomMessages);

      return cloneMessage(message);
    },

    listMessages(roomId: string): RoomChatMessage[] {
      return (messagesByRoomId.get(roomId) ?? []).map(cloneMessage);
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
