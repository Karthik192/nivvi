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

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigation() {
  const { colours, mode } = useTheme();
  const { reduced } = useMotion();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colours.canvas },
          headerTintColor: colours.ink,
          contentStyle: { backgroundColor: colours.canvas },
          animation: reduced ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
