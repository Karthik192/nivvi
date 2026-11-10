import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { ThemeProvider, useTheme } from '../src/design/theme';
import { useMotion } from '../src/design/useMotion';
import { MotionProvider } from '../src/design/MotionProvider';
import { usePreviewStore } from '../src/features/preview/store';

export { ErrorBoundary } from 'expo-router';
// Preserve a return route when a form/detail is opened by a deep link.
export const unstable_settings = { anchor: 'index' };

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigation() {
  const { colours, mode } = useTheme();
  const { reduced } = useMotion();
  const profile = usePreviewStore((state) => state.profile);
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: 'card',
          headerStyle: { backgroundColor: colours.canvas },
          headerTintColor: colours.ink,
          contentStyle: { backgroundColor: colours.canvas },
          animation: reduced ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={__DEV__ && !profile}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="register" />
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__ && !!profile}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
          <Stack.Screen name="transaction-detail" />
          <Stack.Screen name="categories" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="goal" />
          <Stack.Screen name="goal-detail" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="preview-tools" />
          <Stack.Screen name="studio" />
          <Stack.Screen name="motion" />
        </Stack.Protected>
        <Stack.Screen
          name="about"
          options={{ presentation: 'modal', title: 'About this foundation' }}
        />
        <Stack.Screen name="+not-found" options={{ title: 'Page not found' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsReady, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  useEffect(() => {
    if (fontsReady || error) void SplashScreen.hideAsync();
  }, [fontsReady, error]);
  if (!fontsReady && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider fontsReady={fontsReady}>
          <MotionProvider>
            <Navigation />
          </MotionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
