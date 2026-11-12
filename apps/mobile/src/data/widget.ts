import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';
import { currentMonth, exactTotals } from '../features/preview/finance';
import type { Category, Transaction } from '../features/preview/model';

type WidgetModule = {
  updateSummary(spendPaise: string, syncState: string, categoriesJson: string): Promise<void>;
};

let nativeWidget: WidgetModule | null | undefined;

function getWidgetModule() {
  if (Platform.OS !== 'android') return null;
  if (nativeWidget !== undefined) return nativeWidget;
  try {
    nativeWidget = requireNativeModule<WidgetModule>('NivviQuickWidget');
  } catch {
    nativeWidget = null;
  }
  return nativeWidget;
}

export async function updateWidgetSummary(input: {
  userId: string | null;
  offline: boolean;
  transactions: Transaction[];
  categories: Category[];
}) {
  const module = getWidgetModule();
  if (!module) return;
  const categories = input.categories
    .filter((category) => !category.archived && category.kind === 'expense')
    .slice(0, 4)
    .map(({ name }) => ({ name }));
  const spendPaise = input.userId
    ? exactTotals(input.transactions, currentMonth()).expenses
    : '0';
  const syncState = !input.userId
    ? 'SIGNED_OUT'
    : input.offline || input.transactions.some((record) => record.syncStatus === 'pending' || record.syncStatus === 'conflict')
      ? 'DEVICE_ONLY'
      : 'SYNCED';
  await module.updateSummary(spendPaise, syncState, JSON.stringify(categories));
}
