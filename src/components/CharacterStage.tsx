import type { GameState, Side } from '../game/types';

type CharacterStageProps = {
  state: GameState;
  aiThinking: boolean;
  celebratingSide?: Side | null;
};

type CharacterCardProps = {
  side: Side;
  name: string;
  title: string;
  accentClass: 'is-player' | 'is-ai';
  active: boolean;
  thinking?: boolean;
  checked?: boolean;
  celebrating?: boolean;
  defeated?: boolean;
};

function statusLabel(active: boolean, thinking: boolean, celebrating: boolean, defeated: boolean): string {
  if (celebrating) {
    return '胜势';
  }

  if (defeated) {
    return '收势';
  }

  if (thinking) {
    return '思考中';
  }

  return active ? '行动中' : '等待';
}

function NarutoPortrait() {
  return (
    <div className="character-portrait is-player" aria-hidden="true">
      <span className="character-aura player-aura" />
      <svg viewBox="0 0 240 210" className="character-svg">
        <defs>
          <linearGradient id="naruto-panel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff7dc" />
            <stop offset="100%" stopColor="#ffd18a" />
          </linearGradient>
          <linearGradient id="naruto-hair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff17d" />
            <stop offset="100%" stopColor="#f3aa31" />
          </linearGradient>
          <linearGradient id="naruto-band" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#677480" />
            <stop offset="100%" stopColor="#39444d" />
          </linearGradient>
        </defs>
        <rect x="22" y="12" width="196" height="182" rx="48" fill="url(#naruto-panel)" />
        <path d="M54 88c7-42 39-68 69-68 39 0 67 17 81 53-10-3-18-3-24-1 10 7 17 16 21 28-10-4-21-4-31-1 4 7 6 14 6 21-18-8-37-12-59-12-26 0-50 5-72 14-15-10-20-22-20-36 0-9 2-17 7-24 5 1 10 2 15 2-1-7 1-15 7-24Z" fill="url(#naruto-hair)" />
        <rect x="80" y="63" width="84" height="26" rx="13" fill="url(#naruto-band)" />
        <rect x="107" y="67" width="30" height="18" rx="5" fill="#d9e0e3" />
        <circle cx="122" cy="76" r="4.2" fill="#8c969c" />
        <ellipse cx="123" cy="111" rx="44" ry="50" fill="#f8debf" />
        <ellipse cx="79" cy="111" rx="10" ry="16" fill="#f6d8b7" />
        <ellipse cx="167" cy="111" rx="10" ry="16" fill="#f6d8b7" />
        <path d="M88 95c9-14 22-23 36-26 18-4 35-1 49 8-12-18-29-28-50-28-20 0-36 8-49 22Z" fill="url(#naruto-hair)" />
        <path d="M102 102c7-4 14-5 21-3" stroke="#6a5139" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M131 99c8-3 15-1 22 3" stroke="#6a5139" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <ellipse cx="108" cy="114" rx="6.3" ry="7.5" fill="#2d2826" />
        <ellipse cx="140" cy="114" rx="6.3" ry="7.5" fill="#2d2826" />
        <circle cx="110" cy="112" r="2.2" fill="#ffffff" opacity="0.86" />
        <circle cx="142" cy="112" r="2.2" fill="#ffffff" opacity="0.86" />
        <path d="M122 116c1 7 1 15-4 20" stroke="#d5a787" strokeWidth="3.7" strokeLinecap="round" fill="none" />
        <path d="M107 146c6 5 17 5 24 0" stroke="#ba5a4b" strokeWidth="3.8" strokeLinecap="round" fill="none" />
        <path d="M109 150c5 2 12 2 19 0" stroke="#8a4438" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        <path d="M111 156c5 4 17 4 22 0" stroke="#efcfb8" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
        <path d="M84 111h14" stroke="#b67947" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M83 121h15" stroke="#b67947" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M84 131h14" stroke="#b67947" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M147 111h14" stroke="#b67947" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M148 121h15" stroke="#b67947" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M148 131h14" stroke="#b67947" strokeWidth="3.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SasukePortrait() {
  return (
    <div className="character-portrait is-ai" aria-hidden="true">
      <span className="character-aura ai-aura" />
      <svg viewBox="0 0 240 210" className="character-svg">
        <defs>
          <linearGradient id="sasuke-panel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#eff2ff" />
            <stop offset="100%" stopColor="#d4ddff" />
          </linearGradient>
          <linearGradient id="sasuke-hair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#23252f" />
            <stop offset="100%" stopColor="#535f84" />
          </linearGradient>
          <linearGradient id="sasuke-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7e79ff" />
            <stop offset="100%" stopColor="#58b8ff" />
          </linearGradient>
        </defs>
        <rect x="22" y="12" width="196" height="182" rx="48" fill="url(#sasuke-panel)" />
        <path d="M52 90c4-44 37-70 70-70 39 0 67 19 79 55-12-5-22-6-32-3 14 10 22 24 22 41 0 4 0 7-1 11-19-13-41-20-61-20-28 0-53 8-75 23-15-11-19-24-19-39 0-9 2-18 7-25 8 2 16 2 23 0-8-8-11-16-13-23Z" fill="url(#sasuke-hair)" />
        <path d="M78 93c7-23 24-39 46-39 23 0 40 13 52 38-10-13-25-20-47-20s-39 7-51 21Z" fill="url(#sasuke-hair)" />
        <ellipse cx="124" cy="112" rx="43" ry="51" fill="#f4dbc3" />
        <ellipse cx="81" cy="112" rx="9" ry="15" fill="#f2d7bc" />
        <ellipse cx="167" cy="112" rx="9" ry="15" fill="#f2d7bc" />
        <path d="M79 87c9-10 23-16 39-19-11 9-19 20-25 35-6 14-8 31-7 50-10-11-16-25-16-42 0-9 3-17 9-24Z" fill="url(#sasuke-hair)" />
        <path d="M170 83c-8-10-21-15-38-17 11 11 19 26 24 45 4 16 4 29 2 39 13-11 21-27 21-46 0-8-3-15-9-21Z" fill="url(#sasuke-hair)" />
        <path d="M104 101c7-4 14-5 20-3" stroke="#5f5868" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M133 99c7-3 14-2 21 2" stroke="#5f5868" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <ellipse cx="109" cy="113" rx="6" ry="7.4" fill="#26252b" />
        <ellipse cx="141" cy="113" rx="6" ry="7.4" fill="#7f3350" />
        <circle cx="111" cy="111" r="2" fill="#ffffff" opacity="0.84" />
        <circle cx="143" cy="111" r="2" fill="#ffe5ef" opacity="0.84" />
        <path d="M123 116c1 7 1 15-4 20" stroke="#d1a78d" strokeWidth="3.7" strokeLinecap="round" fill="none" />
        <path d="M108 146c5 4 16 4 22 0" stroke="#5c617a" strokeWidth="3.6" strokeLinecap="round" fill="none" />
        <path d="M111 150c4 2 11 2 16 0" stroke="#404459" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M112 156c5 3 16 3 21 0" stroke="#ecdcd3" strokeWidth="4.8" strokeLinecap="round" opacity="0.46" />
        <path d="M160 70c10 12 13 29 9 48" stroke="url(#sasuke-glow)" strokeWidth="4.5" strokeLinecap="round" opacity="0.76" />
      </svg>
    </div>
  );
}

function CharacterPortrait({ accentClass }: Pick<CharacterCardProps, 'accentClass'>) {
  return accentClass === 'is-player' ? <NarutoPortrait /> : <SasukePortrait />;
}

function CharacterCard({
  side,
  name,
  title,
  accentClass,
  active,
  thinking = false,
  checked = false,
  celebrating = false,
  defeated = false,
}: CharacterCardProps) {
  return (
    <section
      className={`character-card ${accentClass}${active ? ' is-active' : ''}${thinking ? ' is-thinking' : ''}${checked ? ' is-checked' : ''}${celebrating ? ' is-celebrating' : ''}${defeated ? ' is-defeated' : ''}`}
    >
      <div className="character-header">
        <div>
          <p className="character-role">{title}</p>
          <h2>{name}</h2>
        </div>
        <span className={`character-state${active ? ' is-active' : ''}${thinking ? ' is-thinking' : ''}${celebrating ? ' is-celebrating' : ''}`}>
          {statusLabel(active, thinking, celebrating, defeated)}
        </span>
      </div>
      <CharacterPortrait accentClass={accentClass} />
      <div className="character-meta">
        <span className="character-chip">{side === 'red' ? '红方视角' : '黑方阵营'}</span>
        {checked ? <span className="character-warning">被将军</span> : null}
      </div>
    </section>
  );
}

export function CharacterStage({ state, aiThinking, celebratingSide = null }: CharacterStageProps) {
  const playerActive = state.currentSide === state.playerSide;
  const aiActive = !playerActive && !state.gameOver;
  const aiSide = state.playerSide === 'red' ? 'black' : 'red';
  const playerCelebrating = celebratingSide === state.playerSide;
  const aiCelebrating = celebratingSide === aiSide;

  return (
    <section className="character-stage" aria-label="对弈角色">
      <CharacterCard
        side={state.playerSide}
        name="鸣人"
        title="我方棋手"
        accentClass="is-player"
        active={playerActive && !state.gameOver}
        checked={state.check === state.playerSide}
        celebrating={playerCelebrating}
        defeated={Boolean(celebratingSide && !playerCelebrating)}
      />
      <CharacterCard
        side={aiSide}
        name="佐助"
        title="电脑对手"
        accentClass="is-ai"
        active={aiActive}
        thinking={aiThinking}
        checked={state.check === aiSide}
        celebrating={aiCelebrating}
        defeated={Boolean(celebratingSide && !aiCelebrating)}
      />
    </section>
  );
}
