export interface SoundSettings {
  deal: boolean;
  countdown: boolean;
  winner: boolean;
  volume: number;
}

export const SOUND_SETTINGS_KEY = 'texas-sound-settings';

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  deal: true,
  countdown: true,
  winner: true,
  volume: 0.7,
};

export function normalizeSoundVolume(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SOUND_SETTINGS.volume;
  }

  return Math.min(1, Math.max(0, value));
}

export function parseSoundSettings(value: string | null | undefined): SoundSettings {
  if (!value) {
    return DEFAULT_SOUND_SETTINGS;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SoundSettings>;
    return {
      deal: parsed.deal ?? DEFAULT_SOUND_SETTINGS.deal,
      countdown: parsed.countdown ?? DEFAULT_SOUND_SETTINGS.countdown,
      winner: parsed.winner ?? DEFAULT_SOUND_SETTINGS.winner,
      volume: normalizeSoundVolume(parsed.volume),
    };
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function loadSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SOUND_SETTINGS;
  }

  return parseSoundSettings(window.localStorage.getItem(SOUND_SETTINGS_KEY));
}

export function saveSoundSettings(settings: SoundSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
}
