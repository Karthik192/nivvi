import { Redirect } from 'expo-router';

import { useAppStore } from '../src/data/store';

export default function Entry() {
  const profile = useAppStore((s) => s.profile);
  const onboarded = useAppStore((s) => s.onboarded);
  return <Redirect href={!onboarded ? '/onboarding' : !profile ? '/sign-in' : '/home'} />;
}
