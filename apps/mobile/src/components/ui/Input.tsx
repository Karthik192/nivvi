import { useId, type Ref, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { fontFamilies, tokens, useTheme } from '../../design/theme';
import { AppText } from './AppText';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function Input({ label, hint, error, style, editable = true, ref, ...props }: Props) {
  const id = useId();
  const { colours, fontsReady } = useTheme();
  return (
    <View style={styles.wrapper}>
      <AppText nativeID={`${id}-label`} variant="label">
        {label}
      </AppText>
      <TextInput
        {...props}
        ref={ref}
        editable={editable}
        allowFontScaling
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={error || hint}
        accessibilityState={{ disabled: !editable }}
        aria-invalid={Boolean(error)}
        placeholderTextColor={colours.muted}
        style={[
          styles.input,
          {
            color: colours.ink,
            backgroundColor: editable ? colours.canvas : colours.disabled,
            borderColor: error ? colours.danger : colours.outline,
            fontFamily: fontsReady ? fontFamilies[400] : undefined,
          },
          style,
        ]}
      />
      {hint && (
        <AppText variant="caption" colour="muted">
          {hint}
        </AppText>
      )}
      {error && (
        <AppText variant="caption" colour="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: tokens.space[2] },
  input: {
    minHeight: tokens.size.control,
    padding: tokens.space[4],
    borderWidth: 1,
    borderRadius: tokens.radius.control,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.line,
  },
});
