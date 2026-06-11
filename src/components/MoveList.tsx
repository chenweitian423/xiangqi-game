import { formatMove } from '../game/notation';
import type { Move } from '../game/types';

export type MoveListProps = {
  moves: Move[];
  activeMoveIndex?: number | null;
  onSelectMove?: (index: number) => void;
};

export function MoveList({ moves, activeMoveIndex = null, onSelectMove }: MoveListProps) {
  return (
    <section className="info-panel">
      <div className="panel-heading">
        <h2>棋谱</h2>
        <span>{moves.length}</span>
      </div>
      {moves.length === 0 ? (
        <p className="empty-note">暂无走法</p>
      ) : (
        <ol className="move-list">
          {moves.map((move, index) => {
            const isLatest = index === moves.length - 1;
            const isActive = activeMoveIndex === index;

            return (
              <li key={`${index}-${move.id}`} className={`${isLatest ? 'is-latest' : ''}${isActive ? ' is-active' : ''}`.trim()}>
                <button
                  type="button"
                  className="move-entry"
                  onClick={onSelectMove ? () => onSelectMove(index) : undefined}
                  disabled={!onSelectMove}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`回看第 ${index + 1} 手：${formatMove(move)}`}
                >
                  <span className={`move-side side-${move.side}`}>{index + 1}</span>
                  <span className="move-notation">{formatMove(move)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
