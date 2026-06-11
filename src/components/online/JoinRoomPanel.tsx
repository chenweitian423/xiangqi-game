import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

type JoinRoomPanelProps = {
  onJoinRoom: (payload: { code: string; nickname: string; password?: string }) => Promise<void> | void;
  initialCode?: string | null;
  passwordRequired?: boolean;
  notice?: string | null;
  active?: boolean;
};

function JoinRoomPanel({
  onJoinRoom,
  initialCode = null,
  passwordRequired = false,
  notice,
  active = false,
}: JoinRoomPanelProps) {
  const [code, setCode] = useState(initialCode?.trim().toUpperCase() ?? '');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const normalizedInitialCode = initialCode?.trim().toUpperCase() ?? '';
    if (normalizedInitialCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(normalizedInitialCode);
    }
  }, [initialCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onJoinRoom({
      code: code.trim().toUpperCase(),
      nickname: nickname.trim(),
      password: password.trim() || undefined,
    });
  }

  return (
    <section
      className={`info-panel online-room-panel online-room-panel-lobby${active ? ' is-active' : ''}`}
      aria-label="加入房间"
    >
      <div className="panel-heading">
        <h2>加入房间</h2>
        <span>好友对局</span>
      </div>
      <form className="online-room-form" onSubmit={handleSubmit}>
        <label className="online-room-field">
          <span>房间号</span>
          <input
            aria-label="房间号"
            name="roomCode"
            type="text"
            placeholder="输入 6 位房间号"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>
        <label className="online-room-field">
          <span>昵称</span>
          <input
            aria-label="昵称"
            name="nickname"
            type="text"
            placeholder="告诉对手你是谁"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
          />
        </label>
        <label className="online-room-field">
          <span>房间密码</span>
          <input
            aria-describedby={passwordRequired ? 'join-room-password-help' : undefined}
            aria-label="房间密码"
            name="password"
            type="password"
            placeholder="有密码就填，没有可留空"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {passwordRequired ? (
          <p id="join-room-password-help" className="control-note">
            这个房间开启了密码保护，请先输入密码。
          </p>
        ) : null}
        {notice ? <p className="control-note">{notice}</p> : null}
        <button className="control-button primary-control online-room-submit" type="submit">
          加入房间
        </button>
      </form>
    </section>
  );
}

export default JoinRoomPanel;
