import type { AppMode } from './AppMode';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Board } from '../components/Board';
import { CapturedPieces } from '../components/CapturedPieces';
import ChatPanel from '../components/online/ChatPanel';
import CreateRoomPanel from '../components/online/CreateRoomPanel';
import JoinRoomPanel from '../components/online/JoinRoomPanel';
import ParticipantList from '../components/online/ParticipantList';
import RoomHeader from '../components/online/RoomHeader';
import SeatPanel from '../components/online/SeatPanel';
import { createOnlineClient } from '../online/client';
import { useOnlineGame } from '../online/hooks/useOnlineGame';
import { useOnlineRoom } from '../online/hooks/useOnlineRoom';
import { clearRoomSession, loadRoomSession, saveRoomSession } from '../online/sessionStorage';
import { MoveList } from '../components/MoveList';
import { createInitialGameState } from '../game/initialState';

type OnlineMatchAppProps = Extract<AppMode, { kind: 'online' }>;
const onlineClient = createOnlineClient();

function resolveRestoredDisplayName(
  preferredDisplayName: string | null | undefined,
  role: 'host' | 'guest' | null,
  participants:
    | Array<{
        displayName: string;
        role: 'host' | 'guest';
      }>
    | undefined,
): string | null {
  if (!participants || participants.length === 0) {
    return preferredDisplayName ?? null;
  }

  const normalizedPreferred = preferredDisplayName?.trim() ?? '';
  if (normalizedPreferred) {
    const matchingParticipant = participants.find(
      (participant) =>
        participant.displayName === normalizedPreferred &&
        (role === null || participant.role === role),
    );
    if (matchingParticipant) {
      return matchingParticipant.displayName;
    }
  }

  const roleMatch = role ? participants.find((participant) => participant.role === role) : null;
  return roleMatch?.displayName ?? (normalizedPreferred || null);
}

function resolveViewerParticipantId(
  participants:
    | Array<{
        participantId: string;
        displayName: string;
        role: 'host' | 'guest';
      }>
    | undefined,
  displayName: string | null,
  role: 'host' | 'guest' | null,
): string | null {
  if (!participants || !displayName) {
    return null;
  }

  return (
    participants.find(
      (participant) =>
        participant.displayName === displayName &&
        (role === null || participant.role === role),
    )?.participantId ?? null
  );
}

function syncRoomLocation(shortCode: string | null): void {
  if (typeof window === 'undefined' || !shortCode) {
    return;
  }

  const normalizedShortCode = shortCode.trim().toUpperCase();
  if (!normalizedShortCode) {
    return;
  }

  const nextPathname = `/online/${normalizedShortCode}`;
  if (window.location.pathname === nextPathname) {
    return;
  }

  window.history.replaceState({}, '', `${nextPathname}${window.location.search}`);
}

function syncLobbyLocation(): void {
  if (typeof window === 'undefined' || window.location.pathname === '/online') {
    return;
  }

  window.history.replaceState({}, '', '/online');
}

function OnlineMatchApp({ roomId }: OnlineMatchAppProps) {
  const initialSession = roomId ? loadRoomSession(roomId) : null;
  const [notice, setNotice] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState<'create' | 'join'>(roomId ? 'join' : 'create');
  const [activeRoomCode, setActiveRoomCode] = useState(roomId ?? initialSession?.code ?? null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<'host' | 'guest' | null>(initialSession?.role ?? null);
  const [activeToken, setActiveToken] = useState<string | null>(initialSession?.token ?? null);
  const [displayName, setDisplayName] = useState<string | null>(initialSession?.displayName ?? null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const hydrateSnapshotRef = useRef<ReturnType<typeof useOnlineRoom>['hydrateSnapshot'] | null>(null);

  const onlineRoom = useOnlineRoom({
    roomId: activeRoomId ?? '',
    shortCode: activeRoomCode ?? '',
    displayName: displayName ?? '房间成员',
    token: activeToken,
    enabled: Boolean(activeRoomId && activeRoomCode && activeToken && displayName),
  });
  const viewerParticipantId = useMemo(
    () => resolveViewerParticipantId(onlineRoom.snapshot?.participants, displayName, activeRole),
    [activeRole, displayName, onlineRoom.snapshot?.participants],
  );
  const onlineGame = useOnlineGame({
    snapshot: activeRoomId && activeRoomCode && activeToken ? onlineRoom.snapshot : null,
    connectionState: onlineRoom.connectionState,
    needsResync: onlineRoom.needsResync,
    role: activeRole,
    participantId: viewerParticipantId,
    onMove: onlineRoom.submitMove,
  });
  const onlineDisplayState = onlineGame.displayState;
  const roomSnapshot = onlineRoom.snapshot;
  const isHost = activeRole === 'host';
  const boardState = onlineDisplayState ?? createInitialGameState();

  useEffect(() => {
    hydrateSnapshotRef.current = onlineRoom.hydrateSnapshot;
  }, [onlineRoom.hydrateSnapshot]);

  useEffect(() => {
    if (!roomId || !initialSession?.token) {
      return;
    }

    void onlineClient
      .getRoom(roomId, initialSession.token)
      .then((response) => {
        setActiveRoomCode(response.room.shortCode);
        setActiveRoomId(response.room.roomId);
        setActiveToken(initialSession.token);
        setActiveRole((response.callerRole ?? initialSession.role) as 'host' | 'guest');
        const restoredDisplayName = resolveRestoredDisplayName(
          initialSession.displayName ?? null,
          (response.callerRole ?? initialSession.role) as 'host' | 'guest',
          response.snapshot?.participants,
        );
        setDisplayName(restoredDisplayName);
        setPasswordRequired(response.passwordRequired);
        if (response.snapshot) {
          onlineRoom.hydrateSnapshot(response.snapshot);
        }
      })
      .catch(() => {
        setNotice('未能恢复已保存的房间会话。');
      });
  }, [
    initialSession?.displayName,
    initialSession?.role,
    initialSession?.token,
    onlineRoom,
    roomId,
  ]);

  useEffect(() => {
    syncRoomLocation(activeRoomCode);
  }, [activeRoomCode]);

  useEffect(() => {
    if (
      !activeRoomCode ||
      !activeToken ||
      onlineRoom.connectionState === 'roomExpired'
    ) {
      return;
    }

    const roomCode = activeRoomCode;
    const roomToken = activeToken;
    let cancelled = false;

    async function pollRoomSnapshot() {
      try {
        const response = await onlineClient.getRoom(roomCode, roomToken);
        if (cancelled || !response.snapshot) {
          return;
        }

        hydrateSnapshotRef.current?.(response.snapshot);
      } catch {
        if (!cancelled) {
          setNotice((currentNotice) => currentNotice ?? '实时连接不可用，正在轮询同步房间状态。');
        }
      }
    }

    void pollRoomSnapshot();
    const timer = window.setInterval(() => {
      void pollRoomSnapshot();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRoomCode, activeToken, onlineRoom.connectionState]);

  useEffect(() => {
    if (!activeRoomCode || !activeToken || activeRole !== 'host') {
      return;
    }

    if (roomSnapshot?.room.status !== 'waiting') {
      return;
    }

    const roomCode = activeRoomCode;
    const roomToken = activeToken;
    let cancelled = false;

    async function refreshRoomSnapshot() {
      try {
        const response = await onlineClient.getRoom(roomCode, roomToken);
        if (cancelled || !response.snapshot) {
          return;
        }

        onlineRoom.hydrateSnapshot(response.snapshot);
      } catch {
        if (!cancelled) {
          setNotice((currentNotice) => currentNotice ?? '正在重新同步房间状态，请稍候。');
        }
      }
    }

    void refreshRoomSnapshot();
    const timer = window.setInterval(() => {
      void refreshRoomSnapshot();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRole, activeRoomCode, activeToken, onlineRoom, roomSnapshot?.room.status]);

  async function handleCreateRoom(payload: { nickname: string; password?: string }) {
    const response = await onlineClient.createRoom(payload);
    saveRoomSession({
      code: response.room.shortCode,
      token: response.callerToken ?? null,
      role: 'host',
      displayName: payload.nickname.trim(),
    });
    setActiveRoomCode(response.room.shortCode);
    setActiveRoomId(response.room.roomId);
    setActiveToken(response.callerToken ?? null);
    setActiveRole('host');
    setDisplayName(payload.nickname.trim());
    setPasswordRequired(response.passwordRequired);
    if (response.snapshot) {
      onlineRoom.hydrateSnapshot(response.snapshot);
    }
    setNotice(
      response.passwordRequired
        ? '房间已创建，把房间号和密码一起发给好友吧。'
        : '房间已创建，把房间号发给好友即可开局。',
    );
  }

  async function handleJoinRoom(payload: { code: string; nickname: string; password?: string }) {
    try {
      const existingSession = loadRoomSession(payload.code);
      const response = await onlineClient.joinRoom({
        ...payload,
        callerToken: existingSession?.token ?? undefined,
      });
      saveRoomSession({
        code: response.room.shortCode,
        token: response.callerToken ?? null,
        role: (response.callerRole ?? existingSession?.role ?? 'guest') as 'host' | 'guest',
        displayName: payload.nickname.trim(),
      });
      setActiveRoomCode(response.room.shortCode);
      setActiveRoomId(response.room.roomId);
      setActiveToken(response.callerToken ?? existingSession?.token ?? null);
      setActiveRole((response.callerRole ?? existingSession?.role ?? 'guest') as 'host' | 'guest');
      setDisplayName(payload.nickname.trim());
      setPasswordRequired(response.passwordRequired);
      setSetupMode('join');
      if (response.snapshot) {
        onlineRoom.hydrateSnapshot(response.snapshot);
      }
      setNotice(
        response.passwordRequired
          ? '已进入加密房间。'
          : '加入房间成功。',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '加入房间失败。';
      setPasswordRequired(message === 'The room password is incorrect.');
      setNotice(message);
    }
  }

  async function handleEndRoom() {
    if (!activeRoomCode || !activeToken) {
      return;
    }

    try {
      const response = await onlineClient.endRoom({
        code: activeRoomCode,
        callerToken: activeToken,
      });
      if (response.snapshot) {
        onlineRoom.hydrateSnapshot(response.snapshot);
      }
      setNotice('房间已结束，当前棋盘改为只读。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '结束房间失败。';
      setNotice(message);
    }
  }

  async function handleRestartRoom() {
    if (!activeRoomCode || !activeToken) {
      return;
    }

    try {
      const response = await onlineClient.restartRoom({
        code: activeRoomCode,
        callerToken: activeToken,
      });
      if (response.snapshot) {
        onlineRoom.hydrateSnapshot(response.snapshot);
      }
      setNotice('新的一局已经开始。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '再开一局失败。';
      setNotice(message);
    }
  }

  function handleReturnToLobby() {
    if (activeRoomCode) {
      clearRoomSession(activeRoomCode);
    }
    setActiveRoomCode(null);
    setActiveRoomId(null);
    setActiveToken(null);
    setActiveRole(null);
    setDisplayName(null);
    setPasswordRequired(false);
    setSetupMode('create');
    setNotice(null);
    syncLobbyLocation();
  }

  const matchGameOver = roomSnapshot?.match?.state.gameOver ?? null;

  const roomReady = Boolean(activeRoomId && activeRoomCode && activeToken && roomSnapshot);
  const roomLabel = roomId
    ? `房间号：${roomId}`
    : activeRoomCode
      ? `房间号：${activeRoomCode}`
      : '等待生成房间号';
  const lobbyNotice = passwordRequired
    ? '该房间已开启密码保护，请先输入房间密码。'
    : notice;

  return (
    <main className={`app-shell${roomReady ? '' : ' app-shell-online-lobby'}`}>
      <section className={`play-table${roomReady ? '' : ' play-table-online-lobby'}`} aria-label="联机对弈">
        <header className="game-status">
          <div>
            <p className="eyebrow">{roomReady ? '联机对弈' : '好友联机大厅'}</p>
            <h1>{roomReady ? '联机对局' : '欢乐象棋'}</h1>
          </div>
        </header>
        {roomReady ? (
          <>
            <section className="opening-ceremony" aria-live="polite">
              <p className="opening-ceremony-title">私人房间对局</p>
              <p className="opening-ceremony-detail">{roomLabel}</p>
            </section>
            <section className="game-layout" aria-label="联机房间">
            <aside className="side-panel side-panel-left" aria-label="被吃棋子">
              <CapturedPieces captured={boardState.captured} />
              {roomSnapshot ? (
                <>
                  <SeatPanel
                    seats={roomSnapshot.seats}
                    participants={roomSnapshot.participants}
                    viewerParticipantId={viewerParticipantId}
                  />
                  <ParticipantList
                    participants={roomSnapshot.participants}
                    viewerParticipantId={viewerParticipantId}
                  />
                </>
              ) : null}
            </aside>
            <div className="board-column">
              <RoomHeader
                shortCode={activeRoomCode ?? '待生成'}
                status={roomSnapshot?.room.status ?? 'waiting'}
                connectionState={onlineRoom.needsResync ? 'resyncing' : onlineRoom.connectionState}
                title={
                  matchGameOver
                    ? '本局结束'
                    : roomSnapshot?.room.status === 'finished'
                    ? '房间已结束'
                    : onlineGame.isSpectator
                    ? '正在观战'
                    : onlineGame.canControlTurn
                      ? '轮到你走'
                      : '等待对手'
                }
                notice={
                  roomSnapshot?.room.status === 'finished'
                    ? '房间已结束，棋盘和聊天记录会继续保留。'
                    : matchGameOver
                      ? '本局已经分出胜负，棋盘只读。房主可以直接再开一局。'
                    : onlineRoom.connectionState === 'roomExpired'
                      ? '这个房间已经不可用。'
                      : onlineRoom.connectionState === 'reconnecting'
                        ? '正在重新连接实时房间状态。'
                        : passwordRequired && !roomReady
                          ? '这个房间需要密码才能加入。'
                          : onlineGame.isSpectator
                    ? '观战席可实时看棋，但不能落子。'
                    : onlineGame.canControlTurn
                      ? '你的落子会实时同步，房间确认后立即生效。'
                      : '等待另一位玩家行动。'
                }
              />
              {isHost && roomSnapshot?.room.status !== 'finished' ? (
                <button
                  type="button"
                  className="control-button"
                  onClick={matchGameOver ? handleRestartRoom : handleEndRoom}
                >
                  {matchGameOver ? '再开一局' : '结束房间'}
                </button>
              ) : null}
              {roomSnapshot?.room.status === 'finished' ? (
                <button type="button" className="control-button" onClick={handleReturnToLobby}>
                  返回创建房间
                </button>
              ) : null}
              {onlineGame.isSpectator ? (
                <p className="hint-banner">当前为观战模式</p>
              ) : roomSnapshot?.room.status === 'finished' || matchGameOver ? (
                <p className="hint-banner">当前棋盘为只读状态</p>
              ) : null}
              {roomSnapshot?.room.status === 'waiting' && !onlineGame.isSpectator ? (
                <p className="hint-banner">等待第二位玩家加入房间。</p>
              ) : null}
              <Board
                state={boardState}
                onSquareClick={onlineGame.handleSquareClick}
                disabled={!onlineGame.canControlTurn}
                orientation={onlineGame.playerSide ?? 'red'}
              />
              {onlineRoom.error || notice ? (
                <p className="hint-banner is-warning">{onlineRoom.error ?? notice}</p>
              ) : null}
            </div>
            <aside className="side-panel side-panel-right" aria-label="棋谱列表">
              <MoveList moves={boardState.moveHistory} />
              {roomSnapshot ? (
                <ChatPanel
                  messages={roomSnapshot.messages}
                  participants={roomSnapshot.participants}
                  disabled={onlineRoom.connectionState === 'roomExpired'}
                  onSendMessage={onlineRoom.sendChatMessage}
                />
              ) : null}
            </aside>
            </section>
          </>
        ) : (
          <section className="online-lobby" aria-label="房间设置">
            <div className="online-lobby-shell">
              <div className="online-lobby-badge" aria-hidden="true">
                ♞
              </div>
              <p className="online-lobby-kicker">双人对弈，好友开黑</p>
              <p className="online-lobby-subtitle">一键开房，复制房间号就能马上开局。</p>
              <div className="online-lobby-hero">
                <p className="online-lobby-hero-icon" aria-hidden="true">
                  ☯
                </p>
                <h2>{setupMode === 'create' ? '创建私人房间' : '输入房间号开局'}</h2>
                <p>
                  {setupMode === 'create'
                    ? '你来做房主，邀请好友加入这盘象棋。'
                    : '输入好友发来的房间号，立刻接入实时对局。'}
                </p>
              </div>
              <div className="online-lobby-switch" role="tablist" aria-label="房间操作">
                <button
                  type="button"
                  className={`online-lobby-switch-button${setupMode === 'create' ? ' is-active' : ''}`}
                  aria-pressed={setupMode === 'create'}
                  onClick={() => setSetupMode('create')}
                >
                  创建房间
                </button>
                <button
                  type="button"
                  className={`online-lobby-switch-button${setupMode === 'join' ? ' is-active' : ''}`}
                  aria-pressed={setupMode === 'join'}
                  onClick={() => setSetupMode('join')}
                >
                  加入房间
                </button>
              </div>
              {lobbyNotice ? <p className="online-lobby-notice">{lobbyNotice}</p> : null}
              {setupMode === 'create' ? (
                <CreateRoomPanel onCreateRoom={handleCreateRoom} active />
              ) : (
                <JoinRoomPanel
                  onJoinRoom={handleJoinRoom}
                  initialCode={activeRoomCode ?? roomId ?? null}
                  passwordRequired={passwordRequired}
                  notice={notice}
                  active
                />
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default OnlineMatchApp;
