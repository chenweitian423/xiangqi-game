import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { RoomChatMessage, RoomParticipant } from '../../online/types';

type ChatPanelProps = {
  messages: RoomChatMessage[];
  participants: RoomParticipant[];
  disabled: boolean;
  onSendMessage: (body: string) => void;
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function resolveAuthorName(message: RoomChatMessage, participants: RoomParticipant[]): string {
  if (!message.participantId) {
    return '房间公告';
  }

  return (
    participants.find((participant) => participant.participantId === message.participantId)
      ?.displayName ?? '房间成员'
  );
}

function ChatPanel({ messages, participants, disabled, onSendMessage }: ChatPanelProps) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const history = document.querySelector<HTMLOListElement>('.online-chat-history');
    if (!history) {
      return;
    }

    history.scrollTop = history.scrollHeight;
  }, [messages.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const body = draft.trim();
    if (!body || disabled) {
      return;
    }

    onSendMessage(body);
    setDraft('');
  }

  return (
    <section className="info-panel online-room-panel" aria-label="房间聊天">
      <div className="panel-heading">
        <h2>房间聊天</h2>
        <span>实时消息</span>
      </div>
      <ol className="online-chat-history" aria-label="聊天记录">
        {messages.map((message) => (
          <li key={message.messageId} className="online-chat-message">
            <div className="online-chat-message-header">
              <strong>{resolveAuthorName(message, participants)}</strong>
              <time dateTime={message.createdAt}>{formatTimestamp(message.createdAt)}</time>
            </div>
            <p>{message.body}</p>
          </li>
        ))}
        {messages.length === 0 ? (
          <li className="online-chat-message">
            <p>还没有聊天消息，发一句招呼吧。</p>
          </li>
        ) : null}
      </ol>
      <form className="online-room-form" onSubmit={handleSubmit}>
        <label className="online-room-field">
          <span>发送消息</span>
          <input
            aria-label="发送消息"
            name="message"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={disabled}
            placeholder="输入你想说的话"
          />
        </label>
        <button className="control-button primary-control" type="submit" disabled={disabled}>
          发送
        </button>
      </form>
    </section>
  );
}

export default ChatPanel;
