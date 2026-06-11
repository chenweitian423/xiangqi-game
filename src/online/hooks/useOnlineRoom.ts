import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { Move } from '../../game/types';
import {
  createOnlineClient,
  resolveOnlineClientOptions,
  resolveRoomSocketPath,
  type ConnectRoomSocket,
  type RoomSocketConnection,
} from '../client';
import { createInitialOnlineRoomState, onlineRoomReducer } from '../reducer';
import type { RoomSnapshot, ServerSocketEvent } from '../types';

type UseOnlineRoomOptions = {
  roomId: string;
  shortCode: string;
  displayName: string;
  participantId?: string | null;
  token?: string | null;
  enabled?: boolean;
  connect?: ConnectRoomSocket;
};

const defaultClientOptions = resolveOnlineClientOptions();
const defaultClient = createOnlineClient(defaultClientOptions);

function getJoinToken(token: UseOnlineRoomOptions['token']): string | null {
  if (typeof token !== 'string') {
    return null;
  }

  const normalizedToken = token.trim();
  return normalizedToken.length > 0 ? normalizedToken : null;
}

function joinEvent(options: UseOnlineRoomOptions) {
  const token = getJoinToken(options.token);
  if (!token) {
    return null;
  }

  return {
    type: 'room.join' as const,
    roomId: options.roomId,
    shortCode: options.shortCode,
    displayName: options.displayName,
    token,
  };
}

export function useOnlineRoom(options: UseOnlineRoomOptions) {
  const {
    roomId,
    shortCode,
    displayName,
    participantId = null,
    token = null,
    enabled: enabledOption = true,
    connect: customConnect,
  } = options;
  const [state, dispatch] = useReducer(onlineRoomReducer, undefined, createInitialOnlineRoomState);
  const connectionRef = useRef<RoomSocketConnection | null>(null);
  const websocketHealthyRef = useRef(true);
  const connect = customConnect ?? defaultClient.connectRoomSocket;
  const enabled = enabledOption;
  const socketPath = useMemo(
    () => resolveRoomSocketPath(defaultClientOptions.socketUrl, shortCode),
    [shortCode],
  );
  const joinRequest = useMemo(
    () => joinEvent({ roomId, shortCode, displayName, token }),
    [displayName, roomId, shortCode, token],
  );

  useEffect(() => {
    if (!enabled || !joinRequest) {
      return;
    }

    dispatch({
      type: 'connecting',
      reconnecting: Boolean(token),
    });

    const connection = connect(socketPath);
    connectionRef.current = connection;
    connection.send(joinRequest);

    const socket = (connection as RoomSocketConnection & { socket?: WebSocket | null }).socket;
    if (socket) {
      socket.addEventListener('error', () => {
        websocketHealthyRef.current = false;
        dispatch({
          type: 'room.error',
          message: '实时连接不可用，正在切换为轮询同步。',
        });
      });
      socket.addEventListener('close', () => {
        websocketHealthyRef.current = false;
      });
      socket.addEventListener('open', () => {
        websocketHealthyRef.current = true;
      });
    }

    const unsubscribe = connection.subscribe((event: ServerSocketEvent) => {
      switch (event.type) {
        case 'room.snapshot':
          dispatch({ type: 'snapshot.received', snapshot: event.snapshot });
          break;
        case 'match.updated':
          dispatch({ type: 'match.updated', match: event.match });
          break;
        case 'room.chat.posted':
          dispatch({
            type: 'room.chat.posted',
            revision: event.revision,
            message: event.message,
          });
          break;
        case 'match.rejected':
          dispatch({
            type: 'match.rejected',
            reason: event.reason,
            message: event.message,
          });
          if (joinRequest) {
            connection.send(joinRequest);
          }
          break;
        case 'room.error':
          dispatch({
            type: 'room.error',
            message: event.message,
            code: event.code,
          });
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      connection.close();
      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }
      dispatch({ type: 'disconnected' });
    };
  }, [connect, enabled, joinRequest, socketPath, token]);

  const submitMove = useCallback((move: Move): void => {
    const match = state.snapshot?.match;
    if (!match) {
      return;
    }

    if (connectionRef.current && websocketHealthyRef.current) {
      connectionRef.current.send({
        type: 'match.move',
        revision: match.revision,
        move,
      });
      return;
    }

    const joinToken = getJoinToken(token);
    if (!joinToken) {
      return;
    }

    void defaultClient
      .submitRoomMove({
        code: shortCode,
        callerToken: joinToken,
        revision: match.revision,
        move,
      })
      .then((response) => {
        if (response.snapshot) {
          dispatch({ type: 'snapshot.received', snapshot: response.snapshot });
        }
      })
      .catch((error) => {
        dispatch({
          type: 'room.error',
          message: error instanceof Error ? error.message : '提交走子失败。',
        });
      });
  }, [shortCode, state.snapshot?.match, token]);

  const hydrateSnapshot = useCallback((snapshot: RoomSnapshot): void => {
    dispatch({ type: 'snapshot.received', snapshot });
  }, []);

  const sendChatMessage = useCallback((body: string): void => {
    const normalizedBody = body.trim();
    if (!normalizedBody) {
      return;
    }

    if (connectionRef.current && websocketHealthyRef.current && state.connectionState === 'connected') {
      connectionRef.current.send({
        type: 'room.chat.send',
        body: normalizedBody,
      });
      return;
    }

    const joinToken = getJoinToken(token);
    if (!joinToken) {
      return;
    }

    void defaultClient
      .sendRoomChat({
        code: shortCode,
        callerToken: joinToken,
        body: normalizedBody,
      })
      .then((response) => {
        if (response.snapshot) {
          dispatch({ type: 'snapshot.received', snapshot: response.snapshot });
        }
      })
      .catch((error) => {
        dispatch({
          type: 'room.error',
          message: error instanceof Error ? error.message : '发送消息失败。',
        });
      });
  }, [shortCode, state.connectionState, token]);

  return useMemo(
    () => ({
      connectionState: state.connectionState,
      snapshot: state.snapshot,
      error: state.error,
      needsResync: state.needsResync,
      lastRejectedReason: state.lastRejectedReason,
      participantId,
      submitMove,
      sendChatMessage,
      hydrateSnapshot,
    }),
    [hydrateSnapshot, participantId, sendChatMessage, state, submitMove],
  );
}
