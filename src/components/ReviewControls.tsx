export type ReviewControlsProps = {
  currentPly: number;
  maxPly: number;
  active: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onExit: () => void;
};

export function ReviewControls({
  currentPly,
  maxPly,
  active,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onExit,
}: ReviewControlsProps) {
  if (maxPly === 0) {
    return null;
  }

  return (
    <section className={`review-controls${active ? ' is-active' : ''}`} aria-label="复盘控制">
      <div className="review-summary">
        <p className="review-title">{active ? `复盘至第 ${currentPly} 手` : '实战进行中'}</p>
        <p className="review-detail">共 {maxPly} 手{active ? '，棋盘已切换到对应局面。' : '，可随时翻步回看。'}</p>
      </div>
      <div className="review-buttons" role="group" aria-label="复盘操作">
        <button type="button" className="control-button subtle-control" onClick={onFirst} disabled={currentPly === 0}>
          回到开局
        </button>
        <button type="button" className="control-button subtle-control" onClick={onPrevious} disabled={currentPly === 0}>
          上一步
        </button>
        <button type="button" className="control-button subtle-control" onClick={onNext} disabled={currentPly >= maxPly}>
          下一步
        </button>
        <button type="button" className="control-button subtle-control" onClick={onLast} disabled={currentPly >= maxPly}>
          回到终局
        </button>
        {active ? (
          <button type="button" className="control-button" onClick={onExit}>
            回到实战
          </button>
        ) : null}
      </div>
    </section>
  );
}
