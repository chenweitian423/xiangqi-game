const SOUND_ENABLED_KEY = 'xiangqi-feedback-sound';
const HAPTICS_ENABLED_KEY = 'xiangqi-feedback-haptics';

function readBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return value === 'true';
  } catch {
    return fallback;
  }
}

function writeBooleanPreference(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Preference saving is best-effort.
  }
}

export function loadSoundEnabled(): boolean {
  return readBooleanPreference(SOUND_ENABLED_KEY, true);
}

export function saveSoundEnabled(value: boolean): void {
  writeBooleanPreference(SOUND_ENABLED_KEY, value);
}

export function loadHapticsEnabled(): boolean {
  return readBooleanPreference(HAPTICS_ENABLED_KEY, true);
}

export function saveHapticsEnabled(value: boolean): void {
  writeBooleanPreference(HAPTICS_ENABLED_KEY, value);
}
