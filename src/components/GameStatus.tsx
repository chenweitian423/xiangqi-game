import type { GameOver, GameState, Side } from '../game/types';
import { sideNames } from './pieceLabels';

export type GameStatusProps = { state: GameState; aiThinking: boolean };

function gameOverReason(reason: GameOver['reason']): string {
  switch (reason) {
    case 'checkmate':
      return '将死';
    case 'king-captured':
      return '将帅被吃';
    case 'no-legal-moves':
      return '无子可走';
  }
}

function getTurnDetail(currentSide: Side, playerSide: Side, aiThinking: boolean): string {
  if (aiThinking) {
    return 'AI思考中';
  }

  return currentSide === playerSide ? '轮到你' : 'AI走棋';
}

function currentSideTitle(currentSide: Side, playerSide: Side): string {
  return currentSide === playerSide ? '红方走棋' : '电脑走棋';
}

function currentSideLabel(currentSide: Side, playerSide: Side): string {
  return currentSide === playerSide ? sideNames[playerSide] : '电脑';
}

export function GameStatus({ state, aiThinking }: GameStatusProps) {
  const title = state.gameOver ? `${sideNames[state.gameOver.winner]}获胜` : currentSideTitle(state.currentSide, state.playerSide);
  const detail = state.gameOver
    ? `对局结束：${gameOverReason(state.gameOver.reason)}`
    : getTurnDetail(state.currentSide, state.playerSide, aiThinking);

  return (
    <header className="game-status" aria-live="polite">
      <div>
        <p className="eyebrow">中国象棋</p>
        <h1>{title}</h1>
      </div>
      <div className="status-pills" aria-label="棋局状态">
        <span className={`status-pill side-${state.currentSide}`}>轮到：{currentSideLabel(state.currentSide, state.playerSide)}</span>
        <span className={`status-pill${aiThinking ? ' is-active' : ''}`}>{aiThinking ? 'AI思考中' : 'AI就绪'}</span>
        <span className={`status-pill${state.check ? ' is-warning' : ''}`}>
          {state.check ? `${sideNames[state.check]}被将军` : '未将军'}
        </span>
        <span className={`status-pill${state.gameOver ? ' is-warning' : ''}`}>{state.gameOver ? '对局结束' : detail}</span>
      </div>
    </header>
  );
}
