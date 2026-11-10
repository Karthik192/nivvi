import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { useTheme } from '../../design/theme';
import type { CategoryIcon as IconKey } from './model';

const paths: Record<IconKey, string> = {
  food: 'M5 3v7M8 3v7M2 3v7h6M5 10v11M18 3c-4 0-5 8 0 8V3ZM18 11v10',
  groceries: 'M3 8h18l-2 12H5L3 8ZM8 8l4-6 4 6M9 12v4M15 12v4',
  shopping: 'M4 7h16l1 14H3L4 7ZM8 7V5a4 4 0 0 1 8 0v2',
  transport: 'M4 16V6c0-3 16-3 16 0v10H4ZM4 11h16M7 20v-4M17 20v-4M7 14h1M16 14h1',
  entertainment: 'm8 4 12 8-12 8V4Z',
  bills: 'M5 3h14v18l-4-2-3 2-3-2-4 2V3ZM9 8h6M9 12h6',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  education: 'm2 8 10-5 10 5-10 5L2 8ZM6 10v7c4 3 8 3 12 0v-7M22 8v9',
  travel: 'm3 13 7-2V4c0-3 4-3 4 0v7l7 2v3l-7-1v4l3 2H7l3-2v-4l-7 1v-3Z',
  subscriptions: 'M4 8h16v13H4V8ZM7 3h10M5 5h14M10 12l5 3-5 3v-6Z',
  other: 'M4 12h1M11 12h1M18 12h1',
  salary: 'M3 7h18v14H3V7ZM8 7V3h8v4M3 12h18M10 12v3h4v-3',
  freelance: 'M4 4h16v12H4V4ZM2 20h20M8 8l-2 2 2 2M16 8l2 2-2 2',
  investments: 'M3 20h18M5 16l5-6 4 3 6-9M15 4h5v5',
  gifts: 'M3 9h18v4H3V9ZM5 13v8h14v-8M12 9v12M12 9C2 9 5 0 10 5l2 4ZM12 9c10 0 7-9 2-4l-2 4Z',
};
export function CategoryIcon({ name, compact = false }: { name: IconKey; compact?: boolean }) {
  const { colours } = useTheme();
  return (
    <View
      style={{
        width: compact ? 32 : 48,
        height: compact ? 32 : 48,
        borderRadius: 16,
        backgroundColor: colours.raised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
        <Path
          d={paths[name]}
          fill="none"
          stroke={colours.primary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
