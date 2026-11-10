import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../../src/components/ui/AppText';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Screen } from '../../src/components/ui/Screen';
import { useTheme, tokens } from '../../src/design/theme';
import { useMotion } from '../../src/design/useMotion';

export default function MotionScreen() {
  const { colours } = useTheme();
  const { reduced } = useMotion();
  const [value, setValue] = useState(40);
  const progress = useSharedValue(40);
  const offset = useSharedValue(0);
  const fill = useAnimatedStyle(() => ({ width: `${progress.get()}%` }));
  const movement = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const gesture = Gesture.Pan()
    .enabled(!reduced)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      offset.set(Math.max(-32, Math.min(32, event.translationX)));
    })
    .onFinalize(() => {
      offset.set(withTiming(0, { duration: tokens.motion.transition }));
    });
  const update = (next: number) => {
    setValue(next);
    progress.set(withTiming(next, { duration: reduced ? 0 : tokens.motion.transition }));
  };
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Motion, with purpose.
      </AppText>
      <AppText colour="muted">
        Native Reanimated and Gesture Handler checks. No financial calculations or records.
      </AppText>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Progress sample
        </AppText>
        <AppText accessibilityLiveRegion="polite">{value}% · illustrative progress</AppText>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Illustrative progress"
          accessibilityValue={{ min: 0, max: 100, now: value }}
          style={[styles.track, { backgroundColor: colours.outline }]}
        >
          <Animated.View style={[styles.fill, { backgroundColor: colours.primary }, fill]} />
        </View>
        <Button label="Set progress to 80 percent" onPress={() => update(80)} />
        <Button
          label="Reset progress to 40 percent"
          variant="secondary"
          onPress={() => update(40)}
        />
      </Card>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          A gentle gesture.
        </AppText>
        <AppText>
          Drag the leaf card sideways and release. The button offers the same preview without
          dragging.
        </AppText>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.tile, { backgroundColor: colours.accent }, movement]}>
            <AppText colour="onAccent" variant="heading">
              A little room to move.
            </AppText>
          </Animated.View>
        </GestureDetector>
        <Button
          label={reduced ? 'Movement off · reduced motion' : 'Preview card movement'}
          disabled={reduced}
          variant="secondary"
          onPress={() => {
            offset.set(
              reduced
                ? 0
                : withSequence(withTiming(24, { duration: 180 }), withTiming(0, { duration: 180 })),
            );
          }}
        />
        <AppText variant="caption" colour="muted">
          {reduced
            ? 'Reduced motion is active. Movement is disabled; progress updates immediately.'
            : 'Movement is active. Reduce it in Settings or Android accessibility settings.'}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: tokens.radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: tokens.radius.pill },
  tile: { minHeight: 96, padding: 20, borderRadius: tokens.radius.card, justifyContent: 'center' },
});
