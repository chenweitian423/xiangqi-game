import type { GameState, Side } from '../game/types';
import { getPieceLabel, getPieceName, sideNames } from './pieceLabels';

export type CapturedPiecesProps = {
  captured: GameState['captured'];
};

const sides: Side[] = ['red', 'black'];

export function CapturedPieces({ captured }: CapturedPiecesProps) {
  return (
    <section className="info-panel">
      <div className="panel-heading">
        <h2>被吃棋子</h2>
        <span>{captured.red.length + captured.black.length}</span>
      </div>
      <div className="captured-groups">
        {sides.map((side) => (
          <div className="captured-group" key={side}>
            <h3>{sideNames[side]}损失</h3>
            {captured[side].length === 0 ? (
              <p className="empty-note">暂无</p>
            ) : (
              <ul className="captured-list" aria-label={`${sideNames[side]}损失棋子`}>
                {captured[side].map((piece) => (
                  <li key={`${piece.id}-${piece.position.row}-${piece.position.col}`} title={getPieceName(piece)}>
                    <span className={`captured-piece piece-${piece.side}`}>{getPieceLabel(piece)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
