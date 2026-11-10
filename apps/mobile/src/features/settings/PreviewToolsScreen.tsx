import { useState } from 'react';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { PreviewScenario } from '../preview/model';
import { usePreviewStore } from '../preview/store';
import { Confirmation, Page, Section } from '../preview/ui';

type Reset = 'sample' | 'empty';
export function PreviewToolsScreen() {
  const scenario = usePreviewStore((state) => state.scenario);
  const setScenario = usePreviewStore((state) => state.setScenario);
  const resetDemo = usePreviewStore((state) => state.resetDemo);
  const [reset, setReset] = useState<Reset | null>(null);
  const inspect = (next: PreviewScenario) => {
    setScenario(next);
    router.push('/home');
  };
  return (
    <Page title="Room to try things." subtitle="Development preview tools" back>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Explore the different moments.
        </AppText>
        <AppText colour="muted">
          Choose a simulated state and open Home to inspect it. These controls do not make network
          requests or cause real service failures.
        </AppText>
        <AppText variant="label">Current preview state: {scenario}</AppText>
        <Button
          label="Ready preview · open Home"
          variant={scenario === 'ready' ? 'primary' : 'secondary'}
          accessibilityState={{ selected: scenario === 'ready' }}
          onPress={() => inspect('ready')}
        />
        <Button
          label="Loading preview · open Home"
          variant={scenario === 'loading' ? 'primary' : 'secondary'}
          accessibilityState={{ selected: scenario === 'loading' }}
          onPress={() => inspect('loading')}
        />
        <Button
          label="Error preview · open Home"
          variant={scenario === 'error' ? 'primary' : 'secondary'}
          accessibilityState={{ selected: scenario === 'error' }}
          onPress={() => inspect('error')}
        />
      </Card>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Start with a fresh page.
        </AppText>
        <AppText colour="muted">
          Both options replace your edits to sample data and return the simulated state to ready.
          Your preview profile stays in place.
        </AppText>
        <Button label="Reset sample data" variant="secondary" onPress={() => setReset('sample')} />
        <Button label="Empty demo" variant="secondary" onPress={() => setReset('empty')} />
      </Card>
      <Section title="The design workshop">
        <AppText colour="muted">
          The original Phase 2 demonstrations are still here to explore.
        </AppText>
        <Button
          label="Open component studio"
          variant="secondary"
          onPress={() => router.push('/studio')}
        />
        <Button
          label="Open motion demonstrations"
          variant="secondary"
          onPress={() => router.push('/motion')}
        />
      </Section>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          An honest little preview.
        </AppText>
        <AppText>
          All data is temporary and in memory. No durable storage, backend, real authentication,
          email delivery or bank connection is active.
        </AppText>
        <AppText colour="muted">
          Nim uses original static artwork. An approved original Rive asset is still pending; these
          screens do not include an authored Rive animation.
        </AppText>
      </Card>
      <Confirmation
        visible={reset !== null}
        title={reset === 'empty' ? 'Empty this demo?' : 'Restore the starting samples?'}
        detail={
          reset === 'empty'
            ? 'Your sample entries, goals and budgets will be removed, and starting categories restored. Your preview profile stays. No real financial data is affected.'
            : 'Your edits to sample entries, categories, budgets and goals will be replaced by the starting samples. Your preview profile stays. Nothing is stored or synced.'
        }
        confirmLabel={reset === 'empty' ? 'Empty demo' : 'Reset sample data'}
        onCancel={() => setReset(null)}
        onConfirm={() => {
          resetDemo(reset === 'empty');
          AccessibilityInfo.announceForAccessibility(
            reset === 'empty'
              ? 'Empty demo ready. Starting categories restored.'
              : 'Starting sample data restored.',
          );
          setReset(null);
        }}
      />
    </Page>
  );
}
