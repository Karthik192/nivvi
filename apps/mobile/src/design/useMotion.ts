import { useContext } from 'react';
import { usePreferences } from '../state/preferences';
import { MotionContext } from './MotionProvider';

export const shouldReduceMotion = (user: boolean, system: boolean) => user || system;

export function useMotion() {
  const userReduced = usePreferences((state) => state.reduceMotion);
  const systemReduced = useContext(MotionContext);
  return { reduced: shouldReduceMotion(userReduced, systemReduced) };
}
