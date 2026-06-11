/* eslint-disable react-refresh/only-export-components */
import type { AppMode } from './app/AppMode';
import OnlineMatchApp from './app/OnlineMatchApp';
import SinglePlayerApp from './app/SinglePlayerApp';
import './styles/theme.css';

type AppProps = {
  mode?: AppMode;
};

export function resolveModeFromLocation(location: Pick<Location, 'pathname' | 'search'>): AppMode {
  const searchParams = new URLSearchParams(location.search);
  const shortCode =
    searchParams.get('room') ??
    searchParams.get('roomId') ??
    searchParams.get('code');

  if (shortCode?.trim()) {
    return {
      kind: 'online',
      roomId: shortCode.trim().toUpperCase(),
    };
  }

  const normalizedPath = location.pathname.replace(/\/+$/, '');
  const roomMatch = normalizedPath.match(/^\/online\/([^/]+)$/i);
  if (roomMatch?.[1]) {
    return {
      kind: 'online',
      roomId: decodeURIComponent(roomMatch[1]).trim().toUpperCase(),
    };
  }

  if (normalizedPath === '/online') {
    return { kind: 'online' };
  }

  return { kind: 'single-player' };
}

export function resolveAppMode(mode?: AppMode): AppMode {
  if (mode) {
    return mode;
  }

  if (typeof window !== 'undefined' && window.location) {
    return resolveModeFromLocation(window.location);
  }

  return { kind: 'single-player' };
}

function App({ mode }: AppProps) {
  const resolvedMode = resolveAppMode(mode);

  if (resolvedMode.kind === 'online') {
    return <OnlineMatchApp {...resolvedMode} />;
  }

  return <SinglePlayerApp />;
}

export default App;
