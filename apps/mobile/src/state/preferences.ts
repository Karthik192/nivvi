import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type Preferences = {
  theme: ThemePreference;
  reduceMotion: boolean;
  setTheme: (theme: ThemePreference) => void;
  setReduceMotion: (enabled: boolean) => void;
};

export const usePreferences = create<Preferences>((set) => ({
  theme: 'system',
  reduceMotion: false,
  setTheme: (theme) => set({ theme }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
}));
