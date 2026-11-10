import { router } from 'expo-router';
import { Screen } from '../src/components/ui/Screen';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';

export default function NotFoundScreen() {
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        A little off the path.
      </AppText>
      <AppText>This preview page does not exist.</AppText>
      <Button label="Return to Studio" onPress={() => router.replace('/')} />
    </Screen>
  );
}
