import { Redirect } from 'expo-router';
import { usePreviewStore } from '../src/features/preview/store';
import { Screen } from '../src/components/ui/Screen';
import { AppText } from '../src/components/ui/AppText';
export default function Entry() {
  const profile = usePreviewStore((state) => state.profile);
  const onboarded = usePreviewStore((state) => state.onboarded);
  if (!__DEV__)
    return (
      <Screen>
        <AppText variant="title">Development preview only</AppText>
        <AppText>
          This version contains sample product screens. Open a development build to review Nivvi.
          Real accounts and financial storage are not available yet.
        </AppText>
      </Screen>
    );
  return <Redirect href={!onboarded ? '/onboarding' : !profile ? '/sign-in' : '/home'} />;
}
