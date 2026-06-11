import type { GameOver, Side } from '../game/types';
import { sideNames } from './pieceLabels';

export type GameOverDialogProps = {
  gameOver: GameOver;
  moveCount: number;
  playerSide: Side;
  onRestart: () => void;
  onClose: () => void;
};

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

function summaryLabel(gameOver: GameOver, playerSide: Side): string {
  return gameOver.winner === playerSide ? '本局胜利' : '本局失利';
}

function closingLine(gameOver: GameOver, playerSide: Side): string {
  if (gameOver.winner === playerSide) {
    return `你执${sideNames[playerSide]}稳稳收下这局。`;
  }

  return `这局由${sideNames[gameOver.winner]}拿下，先留在棋盘上复盘也很合适。`;
}

export function GameOverDialog({ gameOver, moveCount, playerSide, onRestart, onClose }: GameOverDialogProps) {
  const title = `${sideNames[gameOver.winner]}获胜`;
  const playerSeat = `你执${sideNames[playerSide]}`;

  return (
    <div className="game-over-backdrop">
      <section
        className={`game-over-dialog is-${gameOver.winner}-win`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
      >
        <div className="game-over-flourish" aria-hidden="true">
          <span className="game-over-kicker">胜负已定</span>
          <span className="game-over-burst" />
        </div>
        <p className="eyebrow">{summaryLabel(gameOver, playerSide)}</p>
        <h2 id="game-over-title">{title}</h2>
        <p className="game-over-summary">{closingLine(gameOver, playerSide)}</p>

        <dl className="game-over-stats" aria-label="结算信息">
          <div className="game-over-stat">
            <dt>总步数</dt>
            <dd>{moveCount}</dd>
          </div>
          <div className="game-over-stat">
            <dt>终局方式</dt>
            <dd>{gameOverReason(gameOver.reason)}</dd>
          </div>
          <div className="game-over-stat">
            <dt>执子</dt>
            <dd>{playerSeat}</dd>
          </div>
        </dl>

        <div className="game-over-actions">
          <button type="button" className="control-button" onClick={onClose}>
            继续复盘
          </button>
          <button type="button" className="control-button primary-control" onClick={onRestart}>
            再来一局
          </button>
        </div>
      </section>
    </div>
  );
}
