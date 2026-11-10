import { router } from 'expo-router';
import { useState } from 'react';
import manrope from '../assets/manrope-license.json';
import { Screen } from '../src/components/ui/Screen';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { Notice } from '../src/components/ui/Notice';

export default function AboutScreen() {
  const [licenceVisible, setLicenceVisible] = useState(false);
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        A foundation to grow from.
      </AppText>
      <AppText>
        Nivvi is a personal finance companion in development. This phase establishes the native
        design system, navigation, themes and animation boundaries.
      </AppText>
      <Notice
        kind="warning"
        title="A preview, not a ledger."
        detail="No login, transactions, account balances or financial persistence exist in this foundation."
      />
      <AppText variant="caption" colour="muted">
        Manrope font · SIL Open Font License 1.1.
      </AppText>
      <Button
        label={licenceVisible ? 'Hide font licence' : 'Read font licence'}
        variant="secondary"
        accessibilityState={{ expanded: licenceVisible }}
        onPress={() => setLicenceVisible((visible) => !visible)}
      />
      {licenceVisible && <AppText variant="caption">{manrope.license}</AppText>}
      <Button label="Back to Studio" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}
