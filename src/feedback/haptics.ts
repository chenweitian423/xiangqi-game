export type HapticEvent = 'move' | 'capture' | 'check';

export function supportsHaptics(): boolean {
  return typeof navigator.vibrate === 'function';
}

function patternFor(event: HapticEvent): number | number[] {
  switch (event) {
    case 'move':
      return 10;
    case 'capture':
      return [16, 22, 12];
    case 'check':
      return [22, 40, 20, 40, 22];
  }
}

export function triggerHaptic(event: HapticEvent, enabled: boolean): void {
  if (!enabled || !supportsHaptics()) {
    return;
  }

  try {
    navigator.vibrate(patternFor(event));
  } catch {
    // Ignore unsupported vibration failures.
  }
}
