import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens, useTheme } from '../../design/theme';

export function Screen({
  children,
  scroll = true,
  footer,
}: PropsWithChildren<{ scroll?: boolean; footer?: ReactNode }>) {
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
        {scroll ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, { paddingHorizontal: tokens.size.pageInset }]}>
            {children}
          </View>
        )}
        {footer && (
          <SafeAreaView
            edges={['bottom']}
            style={{
              paddingHorizontal: tokens.size.pageInset,
              paddingTop: 12,
              paddingBottom: 12,
              backgroundColor: colours.canvas,
            }}
          >
            {footer}
          </SafeAreaView>
        )}
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
