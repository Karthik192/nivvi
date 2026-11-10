import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens, useTheme } from '../../design/theme';

export function Screen({ children }: PropsWithChildren) {
  const { colours } = useTheme();
  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: colours.canvas }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: tokens.size.pageInset,
    gap: tokens.space[6],
    paddingBottom: tokens.space[12],
  },
});
