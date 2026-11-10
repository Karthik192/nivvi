import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Mascot } from '../../components/brand/Mascot';
import { CategoryIcon } from '../preview/CategoryIcon';
import { Page, Row, Chip, EmptyState, ErrorText, Section } from '../preview/ui';
import {
  amountInput,
  dateLabel,
  money,
  refundRemaining,
  today,
  validateTransaction,
  validDate,
} from '../preview/finance';
import { paymentMethods, type TransactionDraft, type TransactionType } from '../preview/model';
import { usePreviewStore } from '../preview/store';
import { routeValue } from '../preview/params';
import { useUnsaved } from '../preview/useUnsaved';
import { useTheme } from '../../design/theme';

export function TransactionForm() {
  const params = useLocalSearchParams();
  const { colours } = useTheme();
  const editingId = routeValue(params.id);
  const transactions = usePreviewStore((state) => state.transactions);
  const categories = usePreviewStore((state) => state.categories);
  const existing = transactions.find((record) => record.id === editingId);
  const refundParent = transactions.find(
    (record) => record.id === routeValue(params.originalExpenseId) && record.type === 'expense',
  );
  const initialType: TransactionType =
    existing?.type ??
    (params.type === 'income' ? 'income' : params.type === 'refund' ? 'refund' : 'expense');
  const [initial] = useState<TransactionDraft>(() => ({
    amount: existing ? amountInput(existing.amountPaise) : '',
    type: initialType,
    categoryId:
      existing?.categoryId ??
      refundParent?.categoryId ??
      categories.find(
        (category) =>
          !category.archived && category.kind === (initialType === 'income' ? 'income' : 'expense'),
      )?.id ??
      '',
    merchant: existing?.merchant ?? '',
    description: existing?.description ?? '',
    paymentMethod: existing?.paymentMethod ?? 'UPI',
    date: existing?.date ?? today(),
    originalExpenseId: existing?.originalExpenseId ?? routeValue(params.originalExpenseId),
  }));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionDraft, string>>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(Boolean(editingId));
  const [moreCategories, setMoreCategories] = useState(false);
  const locked = useRef(false);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dateRef = useRef<ComponentRef<typeof TextInput>>(null);
  const unsaved = useUnsaved(JSON.stringify(draft) !== JSON.stringify(initial));
  const change = <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setError('');
  };
  const typeChange = (type: TransactionType) => {
    setDraft((previous) => ({
      ...previous,
      type,
      categoryId:
        categories.find(
          (category) =>
            !category.archived && category.kind === (type === 'income' ? 'income' : 'expense'),
        )?.id ?? '',
      originalExpenseId: undefined,
    }));
    setErrors({});
  };
  const save = () => {
    if (locked.current) return;
    const validated = validateTransaction(draft, categories, transactions, editingId);
    setErrors(validated.errors);
    if (Object.keys(validated.errors).length) {
      if (validated.errors.amount) amountRef.current?.focus();
      else if (validated.errors.date) dateRef.current?.focus();
      AccessibilityInfo.announceForAccessibility(
        Object.values(validated.errors)[0] ?? 'Check your entry.',
      );
      return;
    }
    locked.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      const id = usePreviewStore.getState().saveTransaction(draft, editingId);
      unsaved.allowNavigation();
      router.replace({ pathname: '/transaction-detail', params: { id } });
    } catch (cause) {
      setError((cause as Error).message);
      locked.current = false;
      setSaving(false);
    }
  };
  if (
    (params.id !== undefined && !existing) ||
    (params.type !== undefined &&
      !['expense', 'income', 'refund'].includes(routeValue(params.type) ?? ''))
  )
    return (
      <Page title="Entry unavailable" back>
        <EmptyState
          title="This entry is no longer here."
          detail="It may have been removed when the preview was reset."
          action="Open history"
          onAction={() => router.replace('/transactions')}
        />
      </Page>
    );
  const selectedCategory = categories.find((category) => category.id === draft.categoryId);
  const availableCategories = categories.filter(
    (category) =>
      category.kind === (draft.type === 'income' ? 'income' : 'expense') &&
      (!category.archived || category.id === existing?.categoryId),
  );
  const refundableExpenses = transactions.filter(
    (record) =>
      record.type === 'expense' && refundRemaining(transactions, record.id, editingId) > 0,
  );
  return (
    <Page
      title={
        editingId
          ? 'A little update.'
          : draft.type === 'income'
            ? 'Something coming in.'
            : draft.type === 'refund'
              ? 'A little coming back.'
              : 'A quick note for future you.'
      }
      subtitle={editingId ? 'Edit transaction' : `Add ${draft.type}`}
      back
      footer={
        <View style={{ gap: 8 }}>
          <ErrorText message={error || Object.values(errors).find(Boolean) || ''} />
          <Button
            label={
              saving
                ? 'Adding to preview…'
                : editingId
                  ? 'Update preview entry'
                  : `Add ${draft.type} to preview`
            }
            busy={saving}
            onPress={save}
          />
        </View>
      }
    >
      <Row>
        {(['expense', 'income', 'refund'] as const).map((type) => (
          <Chip
            key={type}
            label={type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Refund'}
            selected={draft.type === type}
            onPress={() => typeChange(type)}
          />
        ))}
      </Row>
      <Card>
        <Input
          ref={amountRef}
          label="Amount in rupees"
          hint="INR · up to two decimal places"
          value={draft.amount}
          onChangeText={(value) => change('amount', value)}
          keyboardType="decimal-pad"
          maxLength={12}
          error={errors.amount}
          autoFocus={!editingId}
        />
        {draft.type === 'refund' ? (
          <Section title="Original expense">
            <AppText colour="muted">
              Choose the entry being refunded. Its category stays linked.
            </AppText>
            {refundableExpenses.map((record) => (
              <Chip
                key={record.id}
                label={`${record.merchant || 'Expense'} · ${money(refundRemaining(transactions, record.id, editingId))} left`}
                selected={draft.originalExpenseId === record.id}
                onPress={() => {
                  setDraft((previous) => ({
                    ...previous,
                    originalExpenseId: record.id,
                    categoryId: record.categoryId,
                  }));
                  setErrors({});
                }}
              />
            ))}
            {!refundableExpenses.length && (
              <AppText colour="muted">
                No refundable expenses yet. Add an expense before recording a refund.
              </AppText>
            )}
            <ErrorText message={errors.originalExpenseId ?? ''} />
            <AppText variant="caption">
              Category: {selectedCategory?.name ?? 'Choose an expense'}
            </AppText>
          </Section>
        ) : (
          <Section title="Category">
            <Row>
              {availableCategories
                .filter(
                  (category, index) =>
                    moreCategories || index < 6 || category.id === draft.categoryId,
                )
                .map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityLabel={category.name}
                    accessibilityState={{ selected: draft.categoryId === category.id }}
                    onPress={() => change('categoryId', category.id)}
                    style={{
                      flexBasis: '42%',
                      flexGrow: 1,
                      minWidth: 112,
                      padding: 12,
                      gap: 8,
                      alignItems: 'center',
                      borderRadius: 16,
                      borderWidth: draft.categoryId === category.id ? 2 : 1,
                      borderColor:
                        draft.categoryId === category.id ? colours.primary : colours.outline,
                      backgroundColor:
                        draft.categoryId === category.id ? colours.accent : colours.surface,
                    }}
                  >
                    <CategoryIcon name={category.icon} compact />
                    <AppText
                      variant="caption"
                      colour={draft.categoryId === category.id ? 'onAccent' : 'ink'}
                      style={{ textAlign: 'center' }}
                    >
                      {category.name}
                    </AppText>
                  </Pressable>
                ))}
            </Row>
            {availableCategories.length > 6 && (
              <Button
                label={moreCategories ? 'Fewer categories' : 'More categories'}
                variant="quiet"
                accessibilityState={{ expanded: moreCategories }}
                onPress={() => setMoreCategories((value) => !value)}
              />
            )}
            {!availableCategories.length && (
              <Button
                label="Create or restore a category"
                variant="secondary"
                onPress={() => router.push('/categories')}
              />
            )}
          </Section>
        )}
        <ErrorText message={errors.categoryId ?? ''} />
      </Card>
      <AppText variant="caption" colour="muted">
        {draft.paymentMethod} ·{' '}
        {validDate(draft.date) ? dateLabel(draft.date) : 'Choose a valid date'}
      </AppText>
      <Button
        label={showDetails ? 'Hide details' : 'Add or change details'}
        variant="secondary"
        accessibilityState={{ expanded: showDetails }}
        onPress={() => setShowDetails((value) => !value)}
      />
      {showDetails && (
        <Card>
          <Input
            label="Merchant or payee (optional)"
            value={draft.merchant}
            onChangeText={(value) => change('merchant', value)}
            maxLength={80}
            error={errors.merchant}
          />
          <Section title="Payment method">
            <Row>
              {paymentMethods.map((method) => (
                <Chip
                  key={method}
                  label={method}
                  selected={draft.paymentMethod === method}
                  onPress={() => change('paymentMethod', method)}
                />
              ))}
            </Row>
          </Section>
          <Input
            ref={dateRef}
            label="Transaction date"
            hint="YYYY-MM-DD · Asia/Kolkata reporting date"
            value={draft.date}
            onChangeText={(value) => change('date', value)}
            error={errors.date}
            maxLength={10}
            keyboardType="numbers-and-punctuation"
          />
          <Button
            label={`Use today · ${dateLabel(today())}`}
            variant="quiet"
            onPress={() => change('date', today())}
          />
          <Input
            label="Note (optional)"
            value={draft.description}
            onChangeText={(value) => change('description', value)}
            error={errors.description}
            maxLength={280}
            multiline
          />
          <Button
            label="Manage categories"
            variant="quiet"
            onPress={() => router.push('/categories')}
          />
        </Card>
      )}
      <AppText variant="caption" colour="muted">
        This updates the session preview only. Nothing is stored on your device or synced.
      </AppText>
      {saving && <Mascot state="saving" />}
      {unsaved.dialog}
    </Page>
  );
}
