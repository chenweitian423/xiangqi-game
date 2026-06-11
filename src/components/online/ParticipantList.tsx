import type { RoomParticipant } from '../../online/types';

type ParticipantListProps = {
  participants: RoomParticipant[];
  viewerParticipantId?: string | null;
};

function ParticipantList({ participants, viewerParticipantId = null }: ParticipantListProps) {
  const seatedParticipants = participants.filter((participant) => participant.seat !== null);
  const spectators = participants.filter((participant) => participant.seat === null);
  const liveSpectators = spectators.filter((participant) => participant.status !== 'left');

  return (
    <section className="info-panel online-room-panel" aria-label="房间成员">
      <div className="panel-heading">
        <h2>房间成员</h2>
      </div>
      <p className="online-presence-summary">已入座玩家 {seatedParticipants.length} 人</p>
      <p className="online-presence-summary">观战成员 {liveSpectators.length} 人</p>
      <div className="online-presence-list">
        {[...seatedParticipants, ...spectators].map((participant) => (
          <article key={participant.participantId} className="online-presence-card">
            <div className="online-presence-card-header">
              <h3>{participant.displayName}</h3>
              <span className="status-pill">
                {participant.status === 'left'
                  ? '已离线'
                  : participant.seat === null
                    ? '观战中'
                    : participant.role === 'host'
                      ? '房主'
                      : '对局中'}
              </span>
            </div>
            {participant.participantId === viewerParticipantId ? (
              <p className="online-presence-meta">你</p>
            ) : null}
            {participant.seat === null && participant.status !== 'left' ? (
              <p className="online-presence-meta">正在实时观战</p>
            ) : null}
          </article>
        ))}
        {spectators.length === 0 ? (
          <article className="online-presence-card">
            <div className="online-presence-card-header">
              <h3>暂无观战成员</h3>
            </div>
            <p className="online-presence-meta">后续进入房间的旁观者会显示在这里。</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}

export default ParticipantList;
