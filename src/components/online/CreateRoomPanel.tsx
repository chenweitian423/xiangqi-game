import type { FormEvent } from 'react';
import { useState } from 'react';

type CreateRoomPanelProps = {
  onCreateRoom: (payload: { nickname: string; password?: string }) => Promise<void> | void;
  active?: boolean;
};

function CreateRoomPanel({ onCreateRoom, active = false }: CreateRoomPanelProps) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateRoom({
      nickname: nickname.trim(),
      password: password.trim() || undefined,
    });
  }

  return (
    <section
      className={`info-panel online-room-panel online-room-panel-lobby${active ? ' is-active' : ''}`}
      aria-label="创建房间"
    >
      <div className="panel-heading">
        <h2>创建房间</h2>
        <span>房主开局</span>
      </div>
      <form className="online-room-form" onSubmit={handleSubmit}>
        <label className="online-room-field">
          <span>昵称</span>
          <input
            aria-label="昵称"
            name="nickname"
            type="text"
            placeholder="输入你的昵称"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
          />
        </label>
        <label className="online-room-field">
          <span>房间密码（可选）</span>
          <input
            aria-label="房间密码（可选）"
            name="password"
            type="password"
            placeholder="给好友加一道门槛"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="control-button primary-control online-room-submit" type="submit">
          创建房间
        </button>
      </form>
    </section>
  );
}

export default CreateRoomPanel;
