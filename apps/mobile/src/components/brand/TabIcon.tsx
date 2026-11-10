import Svg, { Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

const paths = {
  studio: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
  motion: 'M3 12h4l3-8 4 16 3-8h4',
  settings: 'M4 7h16M4 17h16M9 4v6M15 14v6',
};

export function TabIcon({ name, color }: { name: keyof typeof paths; color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={paths[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
