type ToneSpec = {
  frequency: number;
  durationMs: number;
  startOffsetMs?: number;
  gain?: number;
  type?: OscillatorType;
};

export type SoundEvent = 'move' | 'capture' | 'check';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioCtor();
  }

  return audioContext;
}

function tonesFor(event: SoundEvent): ToneSpec[] {
  switch (event) {
    case 'move':
      return [
        { frequency: 330, durationMs: 84, gain: 0.05, type: 'triangle' },
        { frequency: 220, durationMs: 115, startOffsetMs: 22, gain: 0.042, type: 'sine' },
      ];
    case 'capture':
      return [
        { frequency: 330, durationMs: 60, gain: 0.035, type: 'triangle' },
        { frequency: 220, durationMs: 120, startOffsetMs: 18, gain: 0.04, type: 'square' },
      ];
    case 'check':
      return [
        { frequency: 659, durationMs: 80, gain: 0.04, type: 'triangle' },
        { frequency: 784, durationMs: 90, startOffsetMs: 78, gain: 0.04, type: 'triangle' },
      ];
  }
}

function scheduleTone(context: AudioContext, tone: ToneSpec): void {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + (tone.startOffsetMs ?? 0) / 1000;
  const endTime = startTime + tone.durationMs / 1000;
  const peakGain = tone.gain ?? 0.03;

  oscillator.type = tone.type ?? 'sine';
  oscillator.frequency.setValueAtTime(tone.frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}

export async function playSound(event: SoundEvent, enabled: boolean): Promise<void> {
  if (!enabled) {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  for (const tone of tonesFor(event)) {
    scheduleTone(context, tone);
  }
}
