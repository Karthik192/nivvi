import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '../state/preferences';
import tokens from '../../../../design/tokens.json';

export { tokens };
export type ColourRole = keyof typeof tokens.themes.light;
export type TypeRole = Exclude<keyof typeof tokens.type, 'family'>;

export function resolveTheme(preference: 'system' | 'light' | 'dark', system: string | null) {
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
}

const ThemeContext = createContext({
  mode: 'light' as 'light' | 'dark',
  colours: tokens.themes.light,
  fontsReady: false,
});

export function ThemeProvider({
  children,
  fontsReady,
}: PropsWithChildren<{ fontsReady: boolean }>) {
  const preference = usePreferences((state) => state.theme);
  const system = useColorScheme();
  const mode = resolveTheme(preference, system);
  return (
    <ThemeContext.Provider value={{ mode, colours: tokens.themes[mode], fontsReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export const fontFamilies: Record<number, string> = {
  400: 'Manrope_400Regular',
  500: 'Manrope_500Medium',
  600: 'Manrope_600SemiBold',
  700: 'Manrope_700Bold',
};
