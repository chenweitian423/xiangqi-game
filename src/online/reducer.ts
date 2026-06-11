import type { MatchRejectedReason, RoomChatMessage, RoomMatch, RoomSnapshot } from './types';

export type OnlineConnectionState =
  | 'idle'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'roomExpired'
  | 'roomEnded'
  | 'error'
  | 'disconnected';

export type OnlineRoomState = {
  connectionState: OnlineConnectionState;
  snapshot: RoomSnapshot | null;
  error: string | null;
  needsResync: boolean;
  lastRejectedReason: MatchRejectedReason | null;
};

export type OnlineRoomAction =
  | { type: 'connecting'; reconnecting: boolean }
  | { type: 'snapshot.received'; snapshot: RoomSnapshot }
  | { type: 'match.updated'; match: RoomMatch }
  | { type: 'room.chat.posted'; revision: number; message: RoomChatMessage }
  | {
      type: 'match.rejected';
      reason: MatchRejectedReason;
      message: string;
    }
  | { type: 'room.error'; message: string; code?: 'room-unavailable' | 'invalid-token' }
  | { type: 'disconnected' };

export function createInitialOnlineRoomState(): OnlineRoomState {
  return {
    connectionState: 'idle',
    snapshot: null,
    error: null,
    needsResync: false,
    lastRejectedReason: null,
  };
}

export function onlineRoomReducer(
  state: OnlineRoomState,
  action: OnlineRoomAction,
): OnlineRoomState {
  switch (action.type) {
    case 'connecting':
      return {
        ...state,
        connectionState: action.reconnecting ? 'reconnecting' : 'connecting',
        error: null,
      };
    case 'snapshot.received':
      return {
        connectionState:
          action.snapshot.room.status === 'finished' ? 'roomEnded' : 'connected',
        snapshot: action.snapshot,
        error: null,
        needsResync: false,
        lastRejectedReason: null,
      };
    case 'match.updated':
      if (!state.snapshot) {
        return state;
      }

      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          room: {
            ...state.snapshot.room,
            activeMatchId: action.match.matchId,
            status: 'active',
          },
          match: action.match,
        },
      };
    case 'room.chat.posted':
      if (!state.snapshot) {
        return state;
      }

      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          room: {
            ...state.snapshot.room,
            revision: Math.max(state.snapshot.room.revision, action.revision),
          },
          messages: [...state.snapshot.messages, action.message],
        },
      };
    case 'match.rejected':
      return {
        ...state,
        error: action.message,
        needsResync: true,
        lastRejectedReason: action.reason,
      };
    case 'room.error':
      return {
        ...state,
        connectionState:
          action.code === 'room-unavailable' ? 'roomExpired' : 'error',
        error: action.message,
      };
    case 'disconnected':
      return {
        ...state,
        connectionState: state.connectionState === 'idle' ? 'idle' : 'disconnected',
      };
  }
}
