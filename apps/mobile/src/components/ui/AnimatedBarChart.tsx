import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { tokens } from '../../design/theme';
import { useMotion } from '../../design/useMotion';

export type BarChartPoint = { label: string; value: number; colour: string };

function Bar({
  point,
  index,
  count,
  max,
  reduced,
}: {
  point: BarChartPoint;
  index: number;
  count: number;
  max: number;
  reduced: boolean;
}) {
  const progress = useSharedValue(0);
  const target = Math.max(0, Math.min(1, point.value / max));
  useEffect(() => {
    progress.set(
      withDelay(
        reduced ? 0 : index * 32,
        withTiming(target, { duration: reduced ? 0 : tokens.motion.feedback + 180 }),
      ),
    );
  }, [index, progress, reduced, target]);
  const animatedStyle = useAnimatedStyle(() => {
    const amount = progress.get();
    return {
      transform: [
        { translateY: (target * 132 * (1 - amount)) / 2 },
        { scaleY: amount },
      ],
    };
  });
  return (
    <View style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View
        style={[
          {
            width: `${Math.min(44, Math.max(18, 180 / count))}%`,
            height: `${target * 100}%`,
            minHeight: point.value > 0 ? 2 : 0,
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            backgroundColor: point.colour,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

export function AnimatedBarChart({ points, max }: { points: BarChartPoint[]; max: number }) {
  const { reduced } = useMotion();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ height: 132, flexDirection: 'row', alignItems: 'stretch', gap: 8 }}
    >
      {points.map((point, index) => (
        <Bar
          key={`${point.label}-${index}`}
          point={point}
          index={index}
          count={points.length}
          max={max}
          reduced={reduced}
        />
      ))}
    </View>
  );
}
