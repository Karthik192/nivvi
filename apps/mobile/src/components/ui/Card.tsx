import { View, StyleSheet, type ViewProps } from 'react-native';
import { tokens, useTheme } from '../../design/theme';

export function Card({ style, ...props }: ViewProps) {
  const { colours } = useTheme();
  return <View {...props} style={[styles.card, { backgroundColor: colours.surface }, style]} />;
}

const styles = StyleSheet.create({
  card: { padding: tokens.space[6], borderRadius: tokens.radius.card, gap: tokens.space[4] },
});
