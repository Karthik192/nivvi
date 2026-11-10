import { StyleSheet, View } from 'react-native';
import { tokens, useTheme } from '../../design/theme';
import { AppText } from './AppText';

export function Notice({
  title,
  detail,
  kind = 'positive',
}: {
  title: string;
  detail: string;
  kind?: 'positive' | 'warning' | 'danger';
}) {
  const { colours } = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colours[`${kind}Surface`] }]}>
      <AppText variant="label" colour={kind}>
        {title}
      </AppText>
      <AppText variant="caption" colour={kind}>
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { padding: tokens.space[4], gap: tokens.space[2], borderRadius: tokens.radius.control },
});
