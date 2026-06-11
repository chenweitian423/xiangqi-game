import type { AiDifficulty, Side } from '../game/types';

export type GameControlsProps = {
  difficulty: AiDifficulty;
  openingSide: Side;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
  onOpeningSideChange: (side: Side) => void;
  onHint: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  hapticsSupported: boolean;
  disabled: boolean;
  hintDisabled?: boolean;
  hintBusy?: boolean;
};

export function GameControls({
  difficulty,
  openingSide,
  onDifficultyChange,
  onOpeningSideChange,
  onHint,
  onUndo,
  onRestart,
  onToggleSound,
  onToggleHaptics,
  soundEnabled,
  hapticsEnabled,
  hapticsSupported,
  disabled,
  hintDisabled = false,
  hintBusy = false,
}: GameControlsProps) {
  return (
    <div className="game-controls" aria-label="棋局操作">
      <label className="difficulty-control">
        <span>AI难度</span>
        <select
          value={difficulty}
          onChange={(event) => onDifficultyChange(event.target.value as AiDifficulty)}
          disabled={disabled}
          aria-label="AI难度"
        >
          <option value="easy">简单</option>
          <option value="normal">普通</option>
          <option value="hard">困难</option>
        </select>
      </label>
      <div className="starter-control" role="group" aria-label="开局方">
        <span className="starter-label">开局方</span>
        <div className="starter-options">
          <button
            type="button"
            className={`control-button subtle-control${openingSide === 'red' ? ' is-active' : ''}`}
            onClick={() => onOpeningSideChange('red')}
            aria-pressed={openingSide === 'red'}
            disabled={disabled}
          >
            我先手
          </button>
          <button
            type="button"
            className={`control-button subtle-control${openingSide === 'black' ? ' is-active' : ''}`}
            onClick={() => onOpeningSideChange('black')}
            aria-pressed={openingSide === 'black'}
            disabled={disabled}
          >
            电脑先手
          </button>
        </div>
      </div>
      <div className="feedback-toggles-wrap">
        <div className="feedback-toggles" role="group" aria-label="声音与震动">
          <button
            type="button"
            className={`control-button subtle-control${soundEnabled ? ' is-active' : ''}`}
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
          >
            声音
          </button>
          <button
            type="button"
            className={`control-button subtle-control${hapticsEnabled ? ' is-active' : ''}`}
            onClick={onToggleHaptics}
            aria-pressed={hapticsEnabled}
            disabled={!hapticsSupported}
            title={hapticsSupported ? undefined : '当前浏览器不支持震动'}
          >
            震动
          </button>
        </div>
        {!hapticsSupported ? <p className="control-note">当前浏览器不支持震动</p> : null}
      </div>
      <button type="button" className="control-button" onClick={onHint} disabled={disabled || hintDisabled}>
        {hintBusy ? '提示中…' : '提示一步'}
      </button>
      <button type="button" className="control-button" onClick={onUndo} disabled={disabled}>
        悔棋
      </button>
      <button type="button" className="control-button primary-control" onClick={onRestart} disabled={disabled}>
        重开
      </button>
    </div>
  );
}
