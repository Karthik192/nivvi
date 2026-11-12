import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { resetBody, verifyBody } from '@nivvi/contracts';
import { api } from '../src/data/runtime';
import { Page, ErrorText } from '../src/features/preview/ui';
import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { AppText } from '../src/components/ui/AppText';
export default function AccountAction() {
  const params = useLocalSearchParams<{ mode?: string; token?: string }>();
  const reset = params.mode === 'reset';
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = reset
        ? resetBody.parse({ resetToken: token.trim(), newPassword: password })
        : verifyBody.parse({ verificationToken: token.trim() });
      await api.request(
        reset ? '/auth/password/reset' : '/auth/email/verify',
        { method: 'POST', body: JSON.stringify(body) },
        false,
      );
      setToken('');
      setPassword('');
      setMessage(reset ? 'Password changed. Sign in with your new password.' : 'Email verified.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title={reset ? 'Choose a fresh password' : 'Verify your email'} back>
      <AppText>Use the token from your account instructions. Never share it.</AppText>
      <Input
        label="Account token"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        secureTextEntry
        editable={!busy}
      />
      {reset && (
        <Input
          label="New password"
          hint="At least 12 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!busy}
        />
      )}
      <ErrorText message={error} />
      {message ? (
        <>
          <AppText accessibilityLiveRegion="polite">{message}</AppText>
          <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <Button label={reset ? 'Reset password' : 'Verify email'} busy={busy} onPress={submit} />
      )}
    </Page>
  );
}
