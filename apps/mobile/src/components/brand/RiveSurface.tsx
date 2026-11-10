import type { ReactNode } from 'react';

export type RiveAsset = { uri: string; artboardName: string; stateMachineName: string };

export function RiveSurface({ fallback }: { asset: RiveAsset; fallback: ReactNode }) {
  return fallback;
}
