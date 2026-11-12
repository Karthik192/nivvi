import 'tsx/cjs';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { readEnvironment } from './src/config/environment.ts';

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = readEnvironment({
    APP_VARIANT: process.env.APP_VARIANT,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  });
  const development = environment.environment === 'development';
  return {
    ...config,
    name: development ? 'Nivvi Dev' : 'Nivvi',
    slug: 'nivvi',
    version: '0.1.0',
    scheme: development ? 'nivvi-dev' : 'nivvi',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    plugins: [
      'expo-router',
      'expo-font',
      'expo-secure-store',
      'expo-splash-screen',
      'expo-status-bar',
      ['expo-sqlite', { useSQLCipher: true }],
      'expo-background-task',
      'expo-dev-client',
      './plugins/with-font-scale.cjs',
      './plugins/with-windows-cmake.cjs',
    ],
    android: {
      package: development ? 'com.nivvi.app.dev' : 'com.nivvi.app',
      allowBackup: false,
      // Keep the supported legacy callback on Android 13–15; verify API 36 separately.
      predictiveBackGestureEnabled: false,
    },
    ios: {
      bundleIdentifier: development ? 'com.nivvi.app.dev' : 'com.nivvi.app',
      supportsTablet: false,
    },
    web: { bundler: 'metro', output: 'static', favicon: './assets/icon.png' },
    experiments: { typedRoutes: true },
    extra: {
      environment: environment.environment,
      ...(environment.apiBaseUrl ? { apiBaseUrl: environment.apiBaseUrl } : {}),
      phase: 7,
      previewOnly: development && process.env.EXPO_PUBLIC_DATA_MODE === 'preview',
      originalRiveAssetReady: false,
    },
  };
};
