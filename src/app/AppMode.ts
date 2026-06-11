export type AppMode =
  | { kind: 'single-player' }
  | { kind: 'online'; roomId?: string | null };
