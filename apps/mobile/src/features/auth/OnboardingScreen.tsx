import { useState } from 'react';
import { router } from 'expo-router';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Mascot } from '../../components/brand/Mascot';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { tokens, useTheme } from '../../design/theme';
import { usePreviewStore } from '../preview/store';

const slides = [
  {
    eyebrow: 'MEET YOUR EVERYDAY COMPANION',
    title: 'Small steps.\nA clearer picture.',
    detail:
      'Meet Nim. A friendly little companion for exploring your everyday money habits, at your own pace.',
    note: 'A little attention can go a long way.',
    surface: 'accent',
    ink: 'onAccent',
    state: 'idle',
  },
  {
    eyebrow: 'NOTICE THE EVERYDAY',
    title: 'From chai breaks\nto the bigger picture.',
    detail:
      'Explore how manually recording everyday spending could help you see where your money goes.',
    note: 'Your pace. Your choices. No judgement.',
    surface: 'peach',
    ink: 'onPeach',
    state: 'saved',
  },
  {
    eyebrow: 'MAKE SPACE FOR WHAT MATTERS',
    title: 'A little today.\nA little further.',
    detail:
      'Discover sample budgets and goals, and imagine the next small step towards something that matters to you.',
    note: 'Start with curiosity. Grow from there.',
    surface: 'lavender',
    ink: 'onLavender',
    state: 'goal',
  },
] as const;

export function OnboardingScreen() {
  const { colours } = useTheme();
  const finishOnboarding = usePreviewStore((state) => state.finishOnboarding);
  const [index, setIndex] = useState(0);
  const slide = slides[index] ?? slides[0];
  const finish = () => {
    finishOnboarding();
    router.replace('/sign-in');
  };
  const move = (next: number) => {
    setIndex(next);
    AccessibilityInfo.announceForAccessibility(
      `Step ${next + 1} of 3. ${slides[next]?.title.replace('\n', ' ') ?? ''}`,
    );
  };

  return (
    <Screen>
      <View style={styles.top}>
        <AppText variant="heading">nivvi</AppText>
        <Button label="Skip introduction" variant="secondary" onPress={finish} />
      </View>
      <View
        style={styles.progress}
        accessible
        accessibilityLabel={`Introduction, step ${index + 1} of 3`}
      >
        {slides.map((_, position) => (
          <View
            key={position}
            style={[
              styles.segment,
              { backgroundColor: position <= index ? colours.primary : colours.line },
            ]}
          />
        ))}
      </View>
      <Card style={[styles.hero, { backgroundColor: colours[slide.surface] }]}>
        <AppText variant="label" colour={slide.ink}>
          {slide.eyebrow}
        </AppText>
        <View style={[styles.art, { backgroundColor: colours.surface }]}>
          <Mascot state={slide.state} />
        </View>
        <AppText variant="heading" colour={slide.ink} style={styles.center}>
          {slide.note}
        </AppText>
      </Card>
      <View style={styles.copy}>
        <AppText variant="caption" colour="muted">{`0${index + 1} / 03`}</AppText>
        <AppText variant="title" accessibilityRole="header">
          {slide.title}
        </AppText>
        <AppText colour="muted">{slide.detail}</AppText>
      </View>
      <View style={styles.copy}>
        <Button
          label={index === slides.length - 1 ? 'Explore the preview' : 'Continue'}
          onPress={() => (index === slides.length - 1 ? finish() : move(index + 1))}
        />
        {index > 0 && <Button label="Back" variant="secondary" onPress={() => move(index - 1)} />}
      </View>
      <AppText variant="caption" colour="muted" style={styles.center}>
        Design preview. No real account is created. Sample screens only; no bank connection or real
        money movement.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[3],
  },
  progress: { flexDirection: 'row', gap: tokens.space[2] },
  segment: { flex: 1, height: tokens.space[1], borderRadius: tokens.radius.pill },
  hero: { borderRadius: tokens.radius.feature, gap: tokens.space[6] },
  art: {
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: tokens.radius.pill,
    padding: tokens.space[4],
  },
  copy: { gap: tokens.space[3] },
  center: { textAlign: 'center' },
});
