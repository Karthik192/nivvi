import { useState, type ReactNode } from 'react';
import { RiveView, useRiveFile } from '@rive-app/react-native';

export type RiveAsset = { uri: string; artboardName: string; stateMachineName: string };

export function RiveSurface({ asset, fallback }: { asset: RiveAsset; fallback: ReactNode }) {
  const { riveFile, error } = useRiveFile({ uri: asset.uri });
  const [failed, setFailed] = useState(false);
  if (failed || error || !riveFile) return fallback;
  return (
    <RiveView
      file={riveFile}
      artboardName={asset.artboardName}
      stateMachineName={asset.stateMachineName}
      autoPlay
      onError={() => setFailed(true)}
      accessible={false}
      style={{ width: 144, height: 144 }}
    />
  );
}
