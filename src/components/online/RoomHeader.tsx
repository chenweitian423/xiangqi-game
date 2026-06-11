type RoomHeaderProps = {
  shortCode: string;
  status: string;
  connectionState: string;
  title: string;
  notice?: string | null;
};

function formatLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function translateStatus(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'waiting':
      return '等待中';
    case 'active':
      return '进行中';
    case 'finished':
      return '已结束';
    case 'connected':
      return '已连接';
    case 'reconnecting':
      return '重连中';
    case 'resyncing':
      return '同步中';
    case 'room expired':
    case 'roomexpired':
      return '房间失效';
    case 'room ended':
    case 'roomended':
      return '房间结束';
    default:
      return formatLabel(value);
  }
}

function RoomHeader({
  shortCode,
  status,
  connectionState,
  title,
  notice = null,
}: RoomHeaderProps) {
  return (
    <header className="game-status online-room-header" aria-live="polite">
      <div>
        <p className="eyebrow">联机对弈</p>
        <h1>{title}</h1>
        <p className="control-note">
          {notice ?? '房间成员、座位状态和对局进度都会在这里实时同步。'}
        </p>
      </div>
      <div className="status-pills" aria-label="房间状态摘要">
        <span className="status-pill">房间号：{shortCode}</span>
        <span className="status-pill">状态：{translateStatus(status)}</span>
        <span className="status-pill">连接：{translateStatus(connectionState)}</span>
      </div>
    </header>
  );
}

export default RoomHeader;
