import { useRef, useState, type ComponentRef } from 'react';
import { router } from 'expo-router';
import { View, type TextInput } from 'react-native';
import { Screen } from '../../src/components/ui/Screen';
import { AppText } from '../../src/components/ui/AppText';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Notice } from '../../src/components/ui/Notice';
import { Mascot } from '../../src/components/brand/Mascot';

export default function StudioScreen() {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <AppText variant="label" colour="muted">
          NIVVI / MOBILE FOUNDATION
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          A little, further.
        </AppText>
        <AppText colour="muted">
          Your design system, now native. Phase 2 preview — no financial records.
        </AppText>
      </View>
      <Card>
        <Mascot />
        <AppText variant="heading" accessibilityRole="header">
          Meet Nim.
        </AppText>
        <AppText>
          Original static artwork. Authored Rive assets and native animation validation are still
          pending.
        </AppText>
        <Button
          label="About this foundation"
          variant="secondary"
          onPress={() => router.push('/about')}
        />
      </Card>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Made for everyday moments.
        </AppText>
        <Input
          ref={inputRef}
          label="Preview name"
          hint="A component example, not a saved profile."
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError('');
          }}
          error={error}
        />
        <Button
          label="Check preview field"
          onPress={() => {
            const valid = Boolean(name.trim());
            setError(valid ? '' : 'Add a name to try this preview.');
            setFeedback(valid ? 'Looks good. Nothing was stored.' : 'Check the preview name.');
            if (!valid) inputRef.current?.focus();
          }}
        />
        <Button label="Unavailable in this foundation" disabled />
        <AppText variant="caption" colour="muted" accessibilityLiveRegion="polite">
          {feedback || 'Theme, text and interaction samples only.'}
        </AppText>
      </Card>
      <Notice
        kind="warning"
        title="Local is not the same as synced."
        detail="Later phases will distinguish saved-to-device records from server-confirmed transactions. No storage or sync runs in this build."
      />
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          A readable starting point.
        </AppText>
        <AppText>
          Body text starts at 16sp. Labels and supporting text start at 14sp. System font scaling
          stays enabled.
        </AppText>
        <AppText variant="amount">₹1,23,456.78</AppText>
        <AppText variant="caption" colour="muted">
          Typography sample, not an account balance.
        </AppText>
      </Card>
    </Screen>
  );
}
