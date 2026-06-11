import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { chooseAiMoveAsync, chooseHintMoveAsync } from '../ai/asyncSearch';
import { Board } from '../components/Board';
import { CapturedPieces } from '../components/CapturedPieces';
import { CharacterStage } from '../components/CharacterStage';
import { GameControls } from '../components/GameControls';
import { GameOverDialog } from '../components/GameOverDialog';
import { GameStatus } from '../components/GameStatus';
import { MoveList } from '../components/MoveList';
import { ReviewControls } from '../components/ReviewControls';
import { playSound } from '../feedback/audio';
import { supportsHaptics, triggerHaptic } from '../feedback/haptics';
import {
  loadHapticsEnabled,
  loadSoundEnabled,
  saveHapticsEnabled,
  saveSoundEnabled,
} from '../feedback/preferences';
import { applyMove } from '../game/applyMove';
import { createInitialGameState, getPieceAt } from '../game/initialState';
import { generateLegalMoves, getCheckSide, getWinner } from '../game/legality';
import { oppositeSide, samePosition } from '../game/types';
import type { AiDifficulty, GameState, Move, Position, Side } from '../game/types';
import { loadGameState, saveGameState } from '../storage/localSave';
import { gameReducer } from './gameReducer';

const AI_DEPTH_BY_DIFFICULTY: Record<AiDifficulty, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
};

type NoticeTone = 'pending' | 'success' | 'warning';

type Notice = {
  text: string;
  tone: NoticeTone;
};

type OpeningCeremony = {
  title: string;
  detail: string;
};

function createOpeningCeremony(openingSide: Side): OpeningCeremony {
  return openingSide === 'red'
    ? { title: '对局开始', detail: '你执红方先行' }
    : { title: '对局开始', detail: '电脑先行，你执红方应对' };
}

function hasKing(state: GameState, side: Side): boolean {
  return state.board.flat().some((piece) => piece?.side === side && piece.type === 'king');
}

function buildReplayState(state: GameState, moveCount: number): GameState {
  const replayedState = state.moveHistory
    .slice(0, moveCount)
    .reduce(
      (nextState, move) => applyMove(nextState, move),
      createInitialGameState({
        playerSide: state.playerSide,
        openingSide: state.openingSide,
        aiDifficulty: state.aiDifficulty,
      }),
    );

  const winner = getWinner(replayedState);
  const loser = winner ? oppositeSide(winner) : null;

  return {
    ...replayedState,
    check: getCheckSide(replayedState),
    gameOver: winner
      ? {
          winner,
          reason: loser && hasKing(replayedState, loser) ? 'no-legal-moves' : 'king-captured',
        }
      : null,
  };
}

function isCompactViewport(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches;
}

function useCompactLayout(): boolean {
  const [isCompact, setIsCompact] = useState(isCompactViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(max-width: 700px)');
    const updateLayout = () => setIsCompact(query.matches);

    updateLayout();
    query.addEventListener('change', updateLayout);

    return () => {
      query.removeEventListener('change', updateLayout);
    };
  }, []);

  return isCompact;
}

function SinglePlayerApp() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => loadGameState() ?? createInitialGameState());
  const [aiThinking, setAiThinking] = useState(false);
  const [hintThinking, setHintThinking] = useState(false);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [openingCeremony, setOpeningCeremony] = useState<OpeningCeremony | null>(() =>
    createOpeningCeremony((loadGameState() ?? createInitialGameState()).openingSide),
  );
  const [dismissedGameOverKey, setDismissedGameOverKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled);
  const [hapticsEnabled, setHapticsEnabled] = useState(loadHapticsEnabled);
  const [hapticsSupported] = useState(supportsHaptics);
  const isCompact = useCompactLayout();
  const aiThinkingRef = useRef(false);
  const previousStateRef = useRef<GameState | null>(null);
  const handledMoveIdRef = useRef<string | null>(null);
  const reviewActive = reviewPly !== null;
  const currentReviewPly = reviewPly ?? state.moveHistory.length;
  const displayState = useMemo(
    () => (reviewActive ? buildReplayState(state, currentReviewPly) : state),
    [currentReviewPly, reviewActive, state],
  );

  useEffect(() => {
    saveGameState(state);
  }, [state]);

  useEffect(() => {
    if (!openingCeremony) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOpeningCeremony(null);
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [openingCeremony]);

  useEffect(() => {
    const previousState = previousStateRef.current;

    if (previousState?.lastMove?.id !== state.lastMove?.id && state.lastMove) {
      const alreadyHandled = handledMoveIdRef.current === state.lastMove.id;

      if (!alreadyHandled) {
        const soundType = state.lastMove.captured ? 'capture' : 'move';
        void playSound(soundType, soundEnabled);
        triggerHaptic(soundType, hapticsEnabled);
      }

      handledMoveIdRef.current = null;
    }

    if (previousState?.check !== state.check && state.check) {
      void playSound('check', soundEnabled);
      triggerHaptic('check', hapticsEnabled);
    }

    previousStateRef.current = state;
  }, [state, soundEnabled, hapticsEnabled]);

  useEffect(() => {
    if (reviewActive || state.currentSide === state.playerSide || state.gameOver || aiThinkingRef.current) {
      return;
    }

    let cancelled = false;
    let abortController: AbortController | null = null;
    aiThinkingRef.current = true;

    window.queueMicrotask(() => {
      if (!cancelled) {
        setAiThinking(true);
      }
    });

    const timer = window.setTimeout(() => {
      abortController = new AbortController();

      void chooseAiMoveAsync(
        state,
        oppositeSide(state.playerSide),
        AI_DEPTH_BY_DIFFICULTY[state.aiDifficulty],
        abortController.signal,
      )
        .then((move) => {
          if (!cancelled && move) {
            dispatch({ type: 'apply-move', move });
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }

          console.error('AI move failed', error);
        })
        .finally(() => {
          if (!cancelled) {
            aiThinkingRef.current = false;
            setAiThinking(false);
          }
        });
    }, 450);

    return () => {
      cancelled = true;
      abortController?.abort();
      aiThinkingRef.current = false;
      window.clearTimeout(timer);
    };
  }, [reviewActive, state]);

  function clearHint(): void {
    setHintMove(null);
  }

  function pushNotice(text: string, tone: NoticeTone): void {
    setNotice({ text, tone });
  }

  function handleSquareClick(position: Position): void {
    clearHint();
    setNotice(null);

    if (reviewActive || aiThinking || hintThinking || state.currentSide !== state.playerSide) {
      return;
    }

    const plannedMove = state.selectedPieceId
      ? generateLegalMoves(state, state.selectedPieceId).find((move) => samePosition(move.to, position)) ?? null
      : null;

    if (plannedMove) {
      const targetPiece = getPieceAt(state, position);
      const feedbackType = targetPiece && targetPiece.side !== plannedMove.side ? 'capture' : 'move';
      handledMoveIdRef.current = plannedMove.id;
      void playSound(feedbackType, soundEnabled);
      triggerHaptic(feedbackType, hapticsEnabled);
    }

    dispatch({ type: 'select-square', position });
  }

  function handleHint(): void {
    if (reviewActive || aiThinking || hintThinking || state.currentSide !== state.playerSide || state.gameOver) {
      return;
    }

    const abortController = new AbortController();
    setHintThinking(true);
    setHintMove(null);
    pushNotice('提示分析中…', 'pending');

    void chooseHintMoveAsync(
      state,
      state.playerSide,
      Math.max(1, AI_DEPTH_BY_DIFFICULTY[state.aiDifficulty]),
      abortController.signal,
    )
      .then((move) => {
        if (!move) {
          pushNotice('当前局面暂时没有合适提示。', 'warning');
          return;
        }

        setHintMove(move);
        pushNotice('提示：试试这一步。', 'success');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        console.error('Hint move failed', error);
        pushNotice('提示暂时不可用。', 'warning');
      })
      .finally(() => {
        setHintThinking(false);
      });
  }

  function handleUndo(): void {
    clearHint();
    setNotice(null);
    setReviewPly(null);

    if (state.moveHistory.length === 0) {
      pushNotice('当前还没有可悔的回合。', 'warning');
      return;
    }

    dispatch({ type: 'undo-full-round' });
    pushNotice('已悔棋，回到上一回合。', 'success');
  }

  function handleRestart(): void {
    clearHint();
    setReviewPly(null);
    setOpeningCeremony(createOpeningCeremony(state.openingSide));
    setDismissedGameOverKey(null);
    dispatch({ type: 'restart' });
    pushNotice('棋局已重开。', 'success');
  }

  function handleOpeningSideChange(side: Side): void {
    if (side === state.openingSide) {
      return;
    }

    clearHint();
    setNotice(null);
    setReviewPly(null);
    setOpeningCeremony(createOpeningCeremony(side));
    dispatch({ type: 'set-opening-side', side });
    pushNotice(side === 'red' ? '已切换为我先手。' : '已切换为电脑先手。', 'success');
  }

  function openReplayAt(targetPly: number): void {
    clearHint();
    setNotice(null);
    setReviewPly(Math.max(0, Math.min(targetPly, state.moveHistory.length)));
  }

  function toggleSound(): void {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    saveSoundEnabled(nextValue);
    pushNotice(nextValue ? '已开启声音反馈。' : '已关闭声音反馈。', 'success');
  }

  function toggleHaptics(): void {
    if (!hapticsSupported) {
      pushNotice('当前浏览器不支持震动。', 'warning');
      return;
    }

    const nextValue = !hapticsEnabled;
    setHapticsEnabled(nextValue);
    saveHapticsEnabled(nextValue);
    pushNotice(nextValue ? '已开启震动反馈。' : '已关闭震动反馈。', 'success');
  }

  const gameOverKey = state.gameOver ? `${state.gameOver.winner}:${state.gameOver.reason}:${state.moveHistory.length}` : null;

  return (
    <main className="app-shell">
      <section className="play-table" aria-label="中国象棋">
        <GameStatus state={displayState} aiThinking={reviewActive ? false : aiThinking} />
        {openingCeremony ? (
          <section className="opening-ceremony" aria-live="polite">
            <p className="opening-ceremony-title">{openingCeremony.title}</p>
            <p className="opening-ceremony-detail">{openingCeremony.detail}</p>
          </section>
        ) : null}
        <CharacterStage
          state={displayState}
          aiThinking={reviewActive ? false : aiThinking}
          celebratingSide={!reviewActive ? state.gameOver?.winner ?? null : null}
        />
        {state.gameOver && !reviewActive && dismissedGameOverKey !== gameOverKey ? (
          <GameOverDialog
            gameOver={state.gameOver}
            moveCount={state.moveHistory.length}
            playerSide={state.playerSide}
            onClose={() => setDismissedGameOverKey(gameOverKey)}
            onRestart={handleRestart}
          />
        ) : null}
        <div className="game-layout">
          {!isCompact ? (
            <aside className="side-panel side-panel-left" aria-label="被吃棋子">
              <CapturedPieces captured={displayState.captured} />
            </aside>
          ) : null}
          <div className="board-column">
            <Board state={displayState} onSquareClick={handleSquareClick} hintMove={reviewActive ? null : hintMove} disabled={reviewActive} />
            {notice ? <p className={`hint-banner is-${notice.tone}`}>{notice.text}</p> : null}
            <ReviewControls
              currentPly={currentReviewPly}
              maxPly={state.moveHistory.length}
              active={reviewActive}
              onFirst={() => openReplayAt(0)}
              onPrevious={() => openReplayAt(currentReviewPly - 1)}
              onNext={() => openReplayAt(currentReviewPly + 1)}
              onLast={() => openReplayAt(state.moveHistory.length)}
              onExit={() => setReviewPly(null)}
            />
            <GameControls
              difficulty={state.aiDifficulty}
              openingSide={state.openingSide}
              onDifficultyChange={(difficulty) => {
                clearHint();
                setNotice(null);
                dispatch({ type: 'set-ai-difficulty', difficulty });
              }}
              onOpeningSideChange={handleOpeningSideChange}
              onHint={handleHint}
              onUndo={handleUndo}
              onRestart={handleRestart}
              onToggleSound={toggleSound}
              onToggleHaptics={toggleHaptics}
              soundEnabled={soundEnabled}
              hapticsEnabled={hapticsEnabled}
              hapticsSupported={hapticsSupported}
              disabled={aiThinking || reviewActive}
              hintDisabled={reviewActive || hintThinking || state.currentSide !== state.playerSide || state.gameOver !== null}
              hintBusy={hintThinking}
            />
            {isCompact ? (
              <div className="mobile-info-panels" role="group" aria-label="手机信息面板">
                <details className="mobile-info-panel">
                  <summary>被吃棋子</summary>
                  <CapturedPieces captured={displayState.captured} />
                </details>
                <details className="mobile-info-panel" open>
                  <summary>棋谱</summary>
                  <MoveList
                    moves={state.moveHistory}
                    activeMoveIndex={reviewActive ? currentReviewPly - 1 : state.moveHistory.length - 1}
                    onSelectMove={(index) => openReplayAt(index + 1)}
                  />
                </details>
              </div>
            ) : null}
          </div>
          {!isCompact ? (
            <aside className="side-panel side-panel-right" aria-label="棋谱">
              <MoveList
                moves={state.moveHistory}
                activeMoveIndex={reviewActive ? currentReviewPly - 1 : state.moveHistory.length - 1}
                onSelectMove={(index) => openReplayAt(index + 1)}
              />
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default SinglePlayerApp;
