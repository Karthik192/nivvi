import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useMotion } from '../../design/useMotion';
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
  const fallback = <NimStill state={state} size={size} />;
  if (!approvedAsset || reduced || !active || !focused) return fallback;
  return (
    <MascotBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RiveSurface asset={approvedAsset} fallback={fallback} size={size} />
      </Suspense>
    </MascotBoundary>
  );
}
