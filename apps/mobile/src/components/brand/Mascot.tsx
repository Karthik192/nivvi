import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useMotion } from '../../design/useMotion';
import { tokens } from '../../design/theme';
import { NimStill, type NimState } from './NimStill';
import type { RiveAsset } from './RiveSurface';

const RiveSurface = lazy(() =>
  import('./RiveSurface').then((module) => ({ default: module.RiveSurface })),
);

class MascotBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Mascot({
  state = 'idle',
  approvedAsset,
  size = 144,
}: {
  state?: NimState;
  approvedAsset?: RiveAsset;
  size?: number;
}) {
  const { reduced } = useMotion();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) =>
      setActive(status === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const still = (
    <Animated.View
      key={state}
      entering={reduced ? undefined : FadeIn.duration(tokens.motion.feedback)}
    >
      <NimStill state={state} size={size} />
    </Animated.View>
  );
  if (!approvedAsset || reduced || !active || !focused) return still;
  return (
    <MascotBoundary fallback={still}>
      <Suspense fallback={still}>
        <RiveSurface asset={approvedAsset} fallback={still} size={size} />
      </Suspense>
    </MascotBoundary>
  );
}
