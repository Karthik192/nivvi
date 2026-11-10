import { Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { Page } from '../src/features/preview/ui';
import { usePreferences, type ThemePreference } from '../src/state/preferences';
import { useTheme } from '../src/design/theme';
import { useMotion } from '../src/design/useMotion';

export default function SettingsScreen() {
  const { theme, setTheme, reduceMotion, setReduceMotion } = usePreferences();
  const { mode, fontsReady, colours } = useTheme();
  const { reduced } = useMotion();
  return (
    <Page title="Make room for you." subtitle="Settings" back>
      <AppText colour="muted">
        Make the space feel yours. These preferences last for this preview session.
      </AppText>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Appearance
        </AppText>
        {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
          <Button
            key={option}
            label={`${option[0]?.toUpperCase()}${option.slice(1)} theme${theme === option ? ' · selected' : ''}`}
            variant={theme === option ? 'primary' : 'secondary'}
            accessibilityState={{ selected: theme === option }}
            onPress={() => setTheme(option)}
          />
        ))}
        <AppText variant="caption" colour="muted">
          Current resolved theme: {mode}.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Motion and readability
        </AppText>
        <View style={{ gap: 12 }}>
          <AppText>Reduce decorative motion</AppText>
          <Switch
            value={reduceMotion}
            onValueChange={setReduceMotion}
            accessibilityLabel="Reduce decorative motion"
            trackColor={{ true: colours.primary, false: colours.outline }}
          />
        </View>
        <AppText variant="caption" colour="muted">
          {reduced
            ? 'Reduced motion is active. Android’s preference always takes priority.'
            : 'Standard motion is active.'}
        </AppText>
        <AppText>
          Text follows your Android font-size setting without an app-imposed cap. Increase it in
          Android Settings to test reflow.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Build information
        </AppText>
        <AppText variant="caption">
          Environment: {String(Constants.expoConfig?.extra?.environment ?? 'unknown')}
        </AppText>
        <AppText variant="caption">
          Fonts: {fontsReady ? 'bundled Manrope' : 'system fallback'}
        </AppText>
        <AppText variant="caption">Nim: static original art. Original Rive asset pending.</AppText>
        <AppText variant="caption">
          This is a development preview. No banking connection or durable storage is active.
        </AppText>
      </Card>
      <Button
        label="Preview tools"
        variant="secondary"
        onPress={() => router.push('/preview-tools')}
      />
      <Button
        label="About Nivvi and font licence"
        variant="quiet"
        onPress={() => router.push('/about')}
      />
    </Page>
  );
}
