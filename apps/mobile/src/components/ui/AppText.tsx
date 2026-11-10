import { Text, type TextProps } from 'react-native';
import { fontFamilies, tokens, useTheme, type ColourRole, type TypeRole } from '../../design/theme';

type Props = TextProps & { variant?: TypeRole; colour?: ColourRole };

export function AppText({ variant = 'body', colour = 'ink', style, ...props }: Props) {
  const { colours, fontsReady } = useTheme();
  const spec = tokens.type[variant];
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        {
          color: colours[colour],
          fontSize: spec.size,
          lineHeight: spec.line,
          fontFamily: fontsReady ? fontFamilies[spec.weight] : undefined,
          fontWeight: fontsReady
            ? undefined
            : (String(spec.weight) as '400' | '500' | '600' | '700'),
        },
        style,
      ]}
    />
  );
}
