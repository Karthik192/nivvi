import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { AccessibilityInfo, Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { Mascot } from '../../components/brand/Mascot';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { tokens, useTheme } from '../../design/theme';
import { usePreviewStore } from '../preview/store';

type Mode = 'sign-in' | 'register' | 'reset-password';
type Field = 'name' | 'email' | 'password' | 'confirm';
type Errors = Partial<Record<Field, string>>;

const copy = {
  'sign-in': {
    title: 'A little clarity starts here.',
    action: 'Enter preview',
  },
  register: {
    title: 'Make room for a little progress.',
    action: 'Create preview profile',
  },
  'reset-password': {
    title: 'A fresh start, gently.',
    action: 'Preview password reset',
  },
};

export function AuthScreen({ mode }: { mode: Mode }) {
  const { colours } = useTheme();
  const signIn = usePreviewStore((state) => state.signIn);
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

  const submit = () => {
    if (submitting.current) return;
    const next: Errors = {};
    if (registration && !name.trim()) next.name = 'Tell us what to call you in this preview.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Enter an email like you@example.com.';
    if (!reset && password.length < 8)
      next.password = 'Use at least 8 characters for this sample password.';
    if (registration && confirm !== password) next.confirm = 'The sample passwords need to match.';
    setErrors(next);
    const first = (['name', 'email', 'password', 'confirm'] as const).find((field) => next[field]);
    if (first) {
      const refs = { name: nameRef, email: emailRef, password: passwordRef, confirm: confirmRef };
      refs[first].current?.focus();
      AccessibilityInfo.announceForAccessibility(next[first] ?? 'Check the highlighted field.');
      return;
    }
    Keyboard.dismiss();
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    setStatus(reset ? 'Checking the sample email on this screen…' : 'Preparing your preview…');
    // A short local UI transition, with no network request or credential persistence.
    timer.current = setTimeout(() => {
      setPassword('');
      setConfirm('');
      setShowPassword(false);
      setBusy(false);
      submitting.current = false;
      if (reset) {
        const message =
          'Reset preview complete. Your email format looks valid. No email was sent and no password was changed.';
        setStatus(message);
        AccessibilityInfo.announceForAccessibility(message);
        return;
      }
      try {
        signIn(registration ? name.trim() : 'Preview explorer', email.trim());
        AccessibilityInfo.announceForAccessibility(
          'Your preview is ready. No real account was created.',
        );
        router.replace('/');
      } catch {
        setFailed(true);
        setStatus('The preview could not open. Please try again. No real account was created.');
        AccessibilityInfo.announceForAccessibility('The preview could not open. Please try again.');
        emailRef.current?.focus();
      }
    }, tokens.motion.transition * 2);
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
            Design preview. No real account. Use sample details; nothing persists.
          </AppText>
        </View>
        {registration && (
          <Input
            ref={nameRef}
            label="Preview name"
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
              label="Sample password"
              hint="8+ characters; use a sample password."
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
                label="Confirm sample password"
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
              label={showPassword ? 'Hide sample password' : 'Show sample password'}
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
      </Card>
      <Button
        label={registration || reset ? 'Back to sign in' : 'Create a preview profile'}
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
