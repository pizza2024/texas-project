'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_SOUND_SETTINGS,
  SOUND_SETTINGS_KEY,
  SoundSettings,
  loadSoundSettings,
  normalizeSoundVolume,
  parseSoundSettings,
  saveSoundSettings,
} from '@/lib/sound-settings';

export function useSoundSettings() {
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSoundSettings(loadSoundSettings());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    saveSoundSettings(soundSettings);
  }, [loaded, soundSettings]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SOUND_SETTINGS_KEY) {
        return;
      }

      setSoundSettings(parseSoundSettings(event.newValue));
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleSoundSetting = (key: keyof Omit<SoundSettings, 'volume'>) => {
    setSoundSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleVolumeChange = (value: number) => {
    setSoundSettings((prev) => ({
      ...prev,
      volume: normalizeSoundVolume(value),
    }));
  };

  return {
    soundSettings,
    setSoundSettings,
    toggleSoundSetting,
    handleVolumeChange,
  };
}
