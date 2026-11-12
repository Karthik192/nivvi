import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tokens, useTheme } from '../../design/theme';
import { useMotion } from '../../design/useMotion';
import { AppText } from './AppText';

type Props = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet';
  busy?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  busy = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  onPress,
  accessibilityState,
  ...props
}: Props) {
  const { colours } = useTheme();
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const pending = useRef(false);
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState('');
  const motionStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const unavailable = disabled || busy || waiting;
  const backgroundColor = unavailable
    ? colours.disabled
    : variant === 'primary'
      ? colours.primary
      : variant === 'destructive'
        ? colours.dangerSurface
        : variant === 'quiet'
          ? 'transparent'
          : colours.raised;
  const colour = unavailable
    ? 'onDisabled'
    : variant === 'primary'
      ? 'onPrimary'
      : variant === 'destructive'
        ? 'danger'
        : variant === 'quiet'
          ? 'primary'
          : 'ink';
  return (
    <Animated.View style={motionStyle}>
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{
          ...accessibilityState,
          disabled: Boolean(unavailable),
          busy: Boolean(busy || waiting),
        }}
        disabled={unavailable}
        onPress={async (event) => {
          if (pending.current) return;
          pending.current = true;
          setWaiting(true);
          setFailure('');
          try {
            await onPress?.(event);
          } catch (error) {
            setFailure(error instanceof Error ? error.message : 'Please try again.');
          } finally {
            pending.current = false;
            setWaiting(false);
          }
        }}
        onPressIn={(event) => {
          scale.set(
            withTiming(reduced ? 1 : tokens.motion.pressScale, {
              duration: reduced ? 0 : tokens.motion.press,
            }),
          );
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withTiming(1, { duration: reduced ? 0 : tokens.motion.press }));
          onPressOut?.(event);
        }}
        style={(state) => [
          styles.button,
          {
            backgroundColor,
            borderColor: variant === 'secondary' ? colours.outline : backgroundColor,
          },
          typeof style === 'function' ? style(state) : style,
        ]}
      >
        {busy && <ActivityIndicator color={colours[colour]} animating={!reduced} />}
        <AppText variant="label" colour={colour} style={{ flexShrink: 1, textAlign: 'center' }}>
          {label}
        </AppText>
      </Pressable>
      {failure && (
        <AppText colour="danger" accessibilityRole="alert">
          {failure}
        </AppText>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: tokens.size.control,
    borderRadius: tokens.radius.control,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[2],
    borderWidth: 1,
  },
});
