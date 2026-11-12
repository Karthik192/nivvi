import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { Mascot } from '../../components/brand/Mascot';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { authenticate } from '../../data/store';
import { api, isPreview, session } from '../../data/runtime';
import { registerBody, loginBody, forgotBody } from '@nivvi/contracts';
import { tokens, useTheme } from '../../design/theme';
import { useAppStore } from '../../data/store';

type Mode = 'sign-in' | 'register' | 'reset-password';
type Field = 'name' | 'email' | 'password' | 'confirm';
type Errors = Partial<Record<Field, string>>;

const copy = {
  'sign-in': {
    title: 'A little clarity starts here.',
    action: 'Sign in',
  },
  register: {
    title: 'Make room for a little progress.',
    action: 'Create account',
  },
  'reset-password': {
    title: 'A fresh start, gently.',
    action: 'Request reset instructions',
  },
};

export function AuthScreen({ mode }: { mode: Mode }) {
  const { colours } = useTheme();
  const signIn = useAppStore((state) => state.signIn);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  useFocusEffect(
    useCallback(
      () => () => {
        if (timer.current !== null) clearTimeout(timer.current);
        submitting.current = false;
        setBusy(false);
        setPassword('');
        setConfirm('');
        setShowPassword(false);
        setStatus('');
        setErrors({});
        setFailed(false);
      },
      [],
    ),
  );

  const registration = mode === 'register';
  const reset = mode === 'reset-password';
  const content = copy[mode];
  const change = (field: Field, value: string) => {
    const setters = { name: setName, email: setEmail, password: setPassword, confirm: setConfirm };
    setters[field](value);
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setStatus('');
    setFailed(false);
  };

  const submit = async () => {
    if (submitting.current) return;
    const input = reset
      ? { email }
      : registration
        ? { email, password, displayName: name, installationId: 'mobile' }
        : { email, password, installationId: 'mobile' };
    const checked = (reset ? forgotBody : registration ? registerBody : loginBody).safeParse(input);
    const next: Errors = {};
    if (!checked.success)
      for (const issue of checked.error.issues) {
        const field = issue.path[0] === 'displayName' ? 'name' : issue.path[0];
        if (field === 'name' || field === 'email' || field === 'password')
          next[field] = issue.message;
      }
    if (registration && confirm !== password) next.confirm = 'The passwords need to match.';
    setErrors(next);
    const first = (['name', 'email', 'password', 'confirm'] as const).find((f) => next[f]);
    if (first) {
      ({ name: nameRef, email: emailRef, password: passwordRef, confirm: confirmRef })[
        first
      ].current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    setStatus('Connecting securely?');
    Keyboard.dismiss();
    try {
      if (isPreview) {
        signIn(registration ? name : 'Preview explorer', email);
        router.replace('/');
        return;
      }
      if (reset) {
        await api.request(
          '/auth/password/forgot',
          { method: 'POST', body: JSON.stringify(forgotBody.parse({ email })) },
          false,
        );
        setStatus('If the account is eligible, reset instructions will be sent.');
      } else {
        const reauth = session.getState().expired;
        const same = await authenticate(
          mode === 'register' ? 'register' : 'sign-in',
          email,
          password,
          name,
        );
        setPassword('');
        setConfirm('');
        if (reauth && same && router.canGoBack()) router.back();
        else router.replace('/');
      }
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="label" colour="muted">
            nivvi.
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {content.title}
          </AppText>
        </View>
        <View style={[styles.mascot, { backgroundColor: colours.surface }]}>
          <Mascot size={96} state={status && !busy && !failed ? 'saved' : 'idle'} />
        </View>
      </View>
      <Card style={styles.form}>
        <View style={[styles.disclosure, { backgroundColor: colours.raised }]}>
          <AppText variant="caption" colour="muted">
            {isPreview
              ? 'Design preview. Use sample details only.'
              : 'Your account connects to Nivvi. Manual entries only; no bank connection.'}
          </AppText>
        </View>
        {registration && (
          <Input
            ref={nameRef}
            label="Your name"
            value={name}
            onChangeText={(value) => change('name', value)}
            error={errors.name}
            editable={!busy}
            autoComplete="off"
            maxLength={60}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        )}
        <Input
          ref={emailRef}
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={(value) => change('email', value)}
          error={errors.email}
          editable={!busy}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={254}
          returnKeyType={reset ? 'done' : 'next'}
          onSubmitEditing={reset ? submit : () => passwordRef.current?.focus()}
        />
        {!reset && (
          <>
            <Input
              ref={passwordRef}
              label="Password"
              hint={registration ? 'Use at least 12 characters.' : undefined}
              value={password}
              onChangeText={(value) => change('password', value)}
              error={errors.password}
              editable={!busy}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              maxLength={128}
              returnKeyType={registration ? 'next' : 'done'}
              onSubmitEditing={registration ? () => confirmRef.current?.focus() : submit}
            />
            {registration && (
              <Input
                ref={confirmRef}
                label="Confirm password"
                value={confirm}
                onChangeText={(value) => change('confirm', value)}
                error={errors.confirm}
                editable={!busy}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                maxLength={128}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            )}
            <Button
              label={showPassword ? 'Hide password' : 'Show password'}
              variant="quiet"
              style={styles.passwordToggle}
              disabled={busy}
              onPress={() => setShowPassword((value) => !value)}
            />
          </>
        )}
        {status !== '' && (
          <View
            style={[
              styles.disclosure,
              { backgroundColor: failed ? colours.dangerSurface : colours.positiveSurface },
            ]}
          >
            <AppText
              colour={failed ? 'danger' : 'positive'}
              accessibilityLiveRegion="polite"
              accessibilityRole={failed ? 'alert' : undefined}
            >
              {status}
            </AppText>
          </View>
        )}
        <Button label={busy ? 'Please wait…' : content.action} busy={busy} onPress={submit} />
        {!registration && !reset && (
          <Button
            label="Forgot password?"
            variant="secondary"
            disabled={busy}
            onPress={() => router.push('/reset-password')}
          />
        )}
        {reset && (
          <Button
            label="I have a reset token"
            variant="secondary"
            onPress={() => router.push({ pathname: '/account-action', params: { mode: 'reset' } })}
          />
        )}
      </Card>
      <Button
        label={registration || reset ? 'Back to sign in' : 'Create an account'}
        variant="secondary"
        disabled={busy}
        onPress={() =>
          registration || reset ? router.replace('/sign-in') : router.push('/register')
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  heading: { flex: 1, gap: tokens.space[2] },
  form: { padding: tokens.space[4], gap: tokens.space[3] },
  passwordToggle: { minHeight: tokens.size.tap, paddingVertical: tokens.space[2] },
  mascot: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: tokens.radius.feature,
  },
  disclosure: {
    padding: tokens.space[3],
    gap: tokens.space[2],
    borderRadius: tokens.radius.control,
  },
});
