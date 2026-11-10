import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { CategoryIcon } from '../preview/CategoryIcon';
import { dateLabel, money } from '../preview/finance';
import { useTheme } from '../../design/theme';
import type { Category, Transaction } from '../preview/model';

export function TransactionRow({
  record,
  categories,
}: {
  record: Transaction;
  categories: Category[];
}) {
  const { colours } = useTheme();
  const category = categories.find((item) => item.id === record.categoryId);
  const title = record.merchant || category?.name || 'Entry';
  const amount = `${record.type === 'expense' ? '−' : '+'}${money(record.amountPaise)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${record.type}, ${money(record.amountPaise)}, ${dateLabel(record.date)}`}
      onPress={() => router.push({ pathname: '/transaction-detail', params: { id: record.id } })}
      style={({ pressed }) => ({
        gap: 12,
        padding: 16,
        borderRadius: 24,
        backgroundColor: pressed ? colours.raised : colours.surface,
        minHeight: 80,
      })}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <CategoryIcon name={category?.icon ?? 'other'} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption" colour="muted">
            {category?.name ?? 'Category'} · {record.paymentMethod}
          </AppText>
        </View>
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}
      >
        <AppText variant="caption" colour="muted">
          {dateLabel(record.date)} · {record.type}
        </AppText>
        <AppText variant="label" colour={record.type === 'expense' ? 'ink' : 'positive'}>
          {amount}
        </AppText>
      </View>
    </Pressable>
  );
}
