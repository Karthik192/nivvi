import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { Mascot } from '../../components/brand/Mascot';
import { tokens, useTheme } from '../../design/theme';
import { useMotion } from '../../design/useMotion';
import { useAppStore } from '../../data/store';
import { ReloadAccount } from '../../data/Provider';
import { isPreview, session } from '../../data/runtime';
import { monthName, progressPercent, shiftMonth } from './finance';

export function Row({ children }: PropsWithChildren) {
  return <View style={styles.row}>{children}</View>;
}
export function PageHeader({
  title,
  subtitle,
  back = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
}) {
  const { colours } = useTheme();
  const notice = useAppStore((state) => state.notice);
  const profile = useAppStore((state) => state.profile);
  const expired = session((s) => s.expired);
  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" colour="primary">
            nivvi.
          </AppText>
          <AppText variant="caption" colour="muted">
            {isPreview ? 'Design preview · session only' : 'Your Nivvi account'}
          </AppText>
        </View>
        {back ? (
          <Button
            label="Back"
            variant="quiet"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : (
          profile && (
            <Button label="Profile" variant="quiet" onPress={() => router.push('/profile')} />
          )
        )}
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle && <AppText colour="muted">{subtitle}</AppText>}
      </View>
      {notice ? (
        <View style={[styles.feedback, { backgroundColor: colours.positiveSurface }]}>
          <AppText
            colour="positive"
            variant="caption"
            style={{ flex: 1 }}
            accessibilityLiveRegion="polite"
          >
            {notice}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            onPress={() => useAppStore.getState().dismissNotice()}
            style={{
              minWidth: 48,
              minHeight: 48,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="heading" colour="positive" accessible={false}>
              ×
            </AppText>
          </Pressable>
        </View>
      ) : null}
      {!isPreview && expired && (
        <Button
          label="Sign in again to save your draft"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
        />
      )}
    </>
  );
}
export function Page({
  title,
  subtitle,
  back = false,
  children,
  footer,
}: PropsWithChildren<{ title: string; subtitle?: string; back?: boolean; footer?: ReactNode }>) {
  return (
    <Screen footer={footer}>
      <PageHeader title={title} subtitle={subtitle} back={back} />
      {children}
    </Screen>
  );
}
export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ gap: 16 }}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colours } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colours.primary : colours.outline,
        backgroundColor: selected ? colours.accent : pressed ? colours.raised : colours.surface,
        justifyContent: 'center',
      })}
    >
      <AppText variant="label" colour={selected ? 'onAccent' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}
export function Meter({
  label,
  value,
  limit,
  detail,
}: {
  label: string;
  value: number;
  limit: number;
  detail?: string;
}) {
  const { colours } = useTheme();
  const { reduced } = useMotion();
  const percent = progressPercent(value, limit);
  const progress = useSharedValue(percent);
  useEffect(() => {
    progress.set(withTiming(percent, { duration: reduced ? 0 : tokens.motion.transition }));
  }, [percent, reduced, progress]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.get()}%` }));
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{label}</AppText>
      <View
        accessibilityRole="progressbar"
        accessible
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(percent),
          text: detail ?? `${Math.round(percent)} percent`,
        }}
        style={{
          height: 10,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: colours.outline,
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              backgroundColor: value > limit ? colours.warning : colours.primary,
              borderRadius: 999,
            },
            animated,
          ]}
        />
      </View>
      {detail && (
        <AppText variant="caption" colour="muted">
          {detail}
        </AppText>
      )}
    </View>
  );
}
export function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      <Mascot state="empty" size={96} />
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <AppText colour="muted">{detail}</AppText>
      {action && onAction && <Button label={action} onPress={onAction} />}
    </Card>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <AppText colour="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </AppText>
  ) : null;
}
export function Confirmation({
  visible,
  title,
  detail,
  onConfirm,
  onCancel,
  confirmLabel = 'Remove',
}: {
  visible: boolean;
  title: string;
  detail: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [failure, setFailure] = useState('');
  const { colours } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: colours.surface }]}
        >
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText>{detail}</AppText>
          <ErrorText message={failure} />
          <Button
            label={confirmLabel}
            variant="destructive"
            busy={busy}
            onPress={async () => {
              if (locked.current) return;
              locked.current = true;
              setBusy(true);
              try {
                await onConfirm();
              } catch (error) {
                setFailure((error as Error).message);
              } finally {
                locked.current = false;
                setBusy(false);
              }
            }}
          />
          <Button label="Cancel" variant="secondary" disabled={busy} onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="heading">{monthName(month)}</AppText>
      <Row>
        <Button
          label="Previous month"
          variant="secondary"
          onPress={() => onChange(shiftMonth(month, -1))}
        />
        <Button
          label="Next month"
          variant="secondary"
          onPress={() => onChange(shiftMonth(month, 1))}
        />
      </Row>
    </View>
  );
}
export function Resource({ children }: PropsWithChildren) {
  const scenario = useAppStore((state) => state.scenario);
  const { reduced } = useMotion();
  const { colours } = useTheme();
  if (!isPreview && scenario === 'loading')
    return (
      <Card>
        <ActivityIndicator color={colours.primary} />
        <AppText>Loading your account...</AppText>
      </Card>
    );
  if (!isPreview && scenario === 'error') return <ReloadAccount />;
  if (scenario === 'loading')
    return (
      <Card>
        <ActivityIndicator color={colours.primary} animating={!reduced} />
        <AppText accessibilityLiveRegion="polite">Loading your overview…</AppText>
        <AppText colour="muted">Preview of the loading state.</AppText>
        <Button
          label="Finish loading preview"
          onPress={() => useAppStore.getState().setScenario('ready')}
        />
      </Card>
    );
  if (scenario === 'error')
    return (
      <Card>
        <AppText variant="heading">A little pause.</AppText>
        <ErrorText message="We couldn’t load this view. Your preview entries are still here." />
        <Button label="Try again" onPress={() => useAppStore.getState().setScenario('ready')} />
      </Card>
    );
  return children;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  feedback: { padding: 16, borderRadius: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  scrim: { flex: 1, backgroundColor: '#00000099', padding: 24, justifyContent: 'center' },
  dialog: {
    padding: 24,
    borderRadius: 24,
    gap: 16,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
});
