import { Tabs } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens, useTheme } from '../../src/design/theme';
import { TabIcon } from '../../src/components/brand/TabIcon';
import { AppText } from '../../src/components/ui/AppText';
export const unstable_settings = { anchor: 'home' };

export default function TabLayout() {
  const { colours } = useTheme();
  const insets = useSafeAreaInsets();
  const [labelHeights, setLabelHeights] = useState<Record<string, number>>({});
  const labelHeight = Math.max(tokens.type.caption.line, ...Object.values(labelHeights));
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colours.primary,
        tabBarInactiveTintColor: colours.muted,
        tabBarStyle: {
          backgroundColor: colours.surface,
          borderTopColor: colours.line,
          minHeight: Math.max(72, 48 + insets.bottom) + labelHeight - tokens.type.caption.line,
        },
        tabBarLabelStyle: { fontSize: 14 },
        tabBarAllowFontScaling: true,
        tabBarLabel: ({ children, color }) => (
          <AppText
            variant="caption"
            style={{ color, textAlign: 'center' }}
            onLayout={(event) => {
              const height = Math.ceil(event.nativeEvent.layout.height);
              setLabelHeights((previous) =>
                previous[children] === height ? previous : { ...previous, [children]: height },
              );
            }}
          >
            {children}
          </AppText>
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="studio" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabIcon name="history" color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <TabIcon name="insights" color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color }) => <TabIcon name="goals" color={color} />,
        }}
      />
    </Tabs>
  );
}
