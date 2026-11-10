import { readEnvironment } from '../config/environment';
import { resolveTheme, tokens } from '../design/theme';
import { usePreferences } from '../state/preferences';
import { shouldReduceMotion } from '../design/useMotion';

describe('environment boundary', () => {
  it('starts offline-independent foundation without an API URL', () => {
    expect(readEnvironment({})).toEqual({ environment: 'development', apiBaseUrl: null });
  });
  it('rejects unknown environments, insecure production URLs and embedded credentials', () => {
    expect(() => readEnvironment({ APP_VARIANT: 'staging' })).toThrow();
    expect(() =>
      readEnvironment({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'http://example.com',
      }),
    ).toThrow();
    expect(() =>
      readEnvironment({ EXPO_PUBLIC_API_BASE_URL: 'https://user:password@example.com' }),
    ).toThrow();
    expect(
      readEnvironment({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com/api/v1',
      }).environment,
    ).toBe('production');
  });
});

describe('theme and preference lifecycle', () => {
  it('never lets the app override enabled system reduced motion', () => {
    expect(shouldReduceMotion(false, true)).toBe(true);
    expect(shouldReduceMotion(true, false)).toBe(true);
    expect(shouldReduceMotion(false, false)).toBe(false);
  });
  afterEach(() => usePreferences.setState({ theme: 'system', reduceMotion: false }));
  it('follows the system unless explicitly overridden', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });
  it('changes preferences without adding financial or authentication state', () => {
    usePreferences.getState().setTheme('dark');
    usePreferences.getState().setReduceMotion(true);
    expect(usePreferences.getState().theme).toBe('dark');
    expect(usePreferences.getState().reduceMotion).toBe(true);
  });
  it('retains readable tokens and matching semantic roles in both themes', () => {
    expect(tokens.type.caption.size).toBeGreaterThanOrEqual(14);
    expect(tokens.type.body.size).toBeGreaterThanOrEqual(16);
    expect(tokens.size.tap).toBeGreaterThanOrEqual(48);
    expect(Object.keys(tokens.themes.dark)).toEqual(Object.keys(tokens.themes.light));
  });
});
