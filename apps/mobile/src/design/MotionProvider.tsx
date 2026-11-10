import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo } from 'react-native';

export const MotionContext = createContext(true);

export function MotionProvider({ children }: PropsWithChildren) {
  const [systemReduced, setSystemReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changed = true;
      setSystemReduced(enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !changed) setSystemReduced(enabled);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return <MotionContext.Provider value={systemReduced}>{children}</MotionContext.Provider>;
}
