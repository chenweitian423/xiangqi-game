import type { RoomParticipant, RoomSeatState } from '../../online/types';

type SeatPanelProps = {
  seats: [RoomSeatState, RoomSeatState];
  participants: RoomParticipant[];
  viewerParticipantId?: string | null;
};

function getSeatLabel(seat: RoomSeatState['seat']): string {
  return seat === 'red' ? '红方座位' : '黑方座位';
}

function getSeatParticipant(
  participants: RoomParticipant[],
  participantId: string | null,
): RoomParticipant | null {
  if (!participantId) {
    return null;
  }

  return participants.find((participant) => participant.participantId === participantId) ?? null;
}

function SeatPanel({ seats, participants, viewerParticipantId = null }: SeatPanelProps) {
  const viewerParticipant = viewerParticipantId
    ? participants.find((participant) => participant.participantId === viewerParticipantId) ?? null
    : null;
  const viewerIsSpectator = viewerParticipant?.seat === null;

  return (
    <section className="info-panel online-room-panel" aria-label="座位信息">
      <div className="panel-heading">
        <h2>座位信息</h2>
      </div>
      <div className="online-presence-list">
        {seats.map((seatState) => {
          const occupant = getSeatParticipant(participants, seatState.participantId);
          const isViewer = occupant?.participantId === viewerParticipantId;
          const seatName = seatState.status === 'occupied' && occupant ? occupant.displayName : '空位待入座';
          const roleLabel =
            seatState.status === 'occupied' && occupant
              ? occupant.role === 'host'
                ? '房主'
                : '房客'
              : null;
          const relationshipLabel =
            seatState.status === 'occupied' && occupant
              ? isViewer
                ? '你'
                : viewerIsSpectator
                  ? '对局玩家'
                  : '你的对手'
              : '等待玩家加入';

          return (
            <article key={seatState.seat} className="online-presence-card">
              <div className="online-presence-card-header">
                <h3>{getSeatLabel(seatState.seat)}</h3>
                <span className={`status-pill${seatState.status === 'occupied' ? ' is-active' : ''}`}>
                  {seatState.status === 'occupied' ? '已入座' : '空位'}
                </span>
              </div>
              <p className="online-presence-name">{seatName}</p>
              <p className="online-presence-meta">{relationshipLabel}</p>
              {roleLabel ? <p className="online-presence-meta">{roleLabel}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default SeatPanel;
