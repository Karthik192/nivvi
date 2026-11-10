import { useRef, useState, type ComponentRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { tokens, useTheme } from '../../design/theme';
import { CategoryIcon } from '../preview/CategoryIcon';
import {
  iconKeys,
  type Category,
  type CategoryIcon as IconKey,
  type CategoryKind,
} from '../preview/model';
import { usePreviewStore } from '../preview/store';
import {
  Chip,
  Confirmation,
  EmptyState,
  ErrorText,
  Page,
  Resource,
  Row,
  Section,
} from '../preview/ui';
import { useUnsaved } from '../preview/useUnsaved';

export function CategoriesScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; create?: string | string[] }>();
  const categories = usePreviewStore((state) => state.categories);
  const editing = params.id !== undefined;
  const creating = params.create === 'true' && !editing;
  const category = categories.find((item) => item.id === params.id && !item.archived);
  const invalid = (editing && !category) || (params.create !== undefined && !creating && !editing);
  return (
    <Page
      title={
        editing
          ? 'A name that feels right.'
          : creating
            ? 'Make it your own.'
            : 'A place for every little thing.'
      }
      subtitle="Preview categories"
      back
    >
      <Resource>
        {invalid ? (
          <EmptyState
            title="Category unavailable"
            detail="It may have been archived or removed when the preview was reset. Your other categories are still available."
            action="View categories"
            onAction={() => router.replace('/categories')}
          />
        ) : editing || creating ? (
          <CategoryForm key={category?.id ?? 'new'} category={category} />
        ) : (
          <CategoryList />
        )}
      </Resource>
    </Page>
  );
}

function CategoryList() {
  const categories = usePreviewStore((state) => state.categories);
  const archiveCategory = usePreviewStore((state) => state.archiveCategory);
  const saveCategory = usePreviewStore((state) => state.saveCategory);
  const [archive, setArchive] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const restore = (category: Category) => {
    try {
      saveCategory(category.name, category.kind, category.icon, category.id);
      setError('');
      AccessibilityInfo.announceForAccessibility(`${category.name} restored in this preview.`);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'This category could not be restored.';
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  };
  return (
    <>
      <AppText colour="muted">
        Choose the words and little illustrations that make sense to you. Default and custom
        categories can both be edited.
      </AppText>
      <Button
        label="Add a category"
        onPress={() => router.push({ pathname: '/categories', params: { create: 'true' } })}
      />
      <ErrorText message={error} />
      {(['expense', 'income'] as const).map((kind) => {
        const active = categories.filter(
          (category) => category.kind === kind && !category.archived,
        );
        return (
          <Section key={kind} title={kind === 'expense' ? 'Everyday spending' : 'Money coming in'}>
            {active.length ? (
              active.map((category) => (
                <Card key={category.id}>
                  <Row>
                    <CategoryIcon name={category.icon} />
                    <View style={styles.rowText}>
                      <AppText variant="heading">{category.name}</AppText>
                      <AppText variant="caption" colour="muted">
                        {kind === 'expense' ? 'Expense' : 'Income'}
                      </AppText>
                    </View>
                  </Row>
                  <Row>
                    <Button
                      label={`Edit ${category.name}`}
                      variant="secondary"
                      onPress={() =>
                        router.push({ pathname: '/categories', params: { id: category.id } })
                      }
                    />
                    <Button
                      label={`Archive ${category.name}`}
                      variant="quiet"
                      onPress={() => setArchive(category)}
                    />
                  </Row>
                </Card>
              ))
            ) : (
              <AppText colour="muted">
                No active {kind} categories. Add one or restore an archived category.
              </AppText>
            )}
          </Section>
        );
      })}
      <Section title="Archived categories">
        <AppText colour="muted">
          Existing entries keep their category. Restore a category to use it again. If its name is
          already in use for the same kind, rename the active category first.
        </AppText>
        {categories
          .filter((category) => category.archived)
          .map((category) => (
            <Card key={category.id}>
              <Row>
                <CategoryIcon name={category.icon} />
                <View style={styles.rowText}>
                  <AppText variant="heading">{category.name}</AppText>
                  <AppText variant="caption" colour="muted">
                    {category.kind === 'expense' ? 'Expense' : 'Income'} · Archived
                  </AppText>
                </View>
              </Row>
              <Button
                label={`Restore ${category.name}`}
                variant="secondary"
                onPress={() => restore(category)}
              />
            </Card>
          ))}
        {!categories.some((category) => category.archived) && (
          <AppText colour="muted">Nothing archived. Your categories are all here.</AppText>
        )}
      </Section>
      <Confirmation
        visible={archive !== null}
        title={`Archive ${archive?.name ?? 'category'}?`}
        detail="This hides the category from new entries. Existing entries and their category stay intact. You can restore it from the archived list."
        confirmLabel="Archive category"
        onCancel={() => setArchive(null)}
        onConfirm={() => {
          if (archive) archiveCategory(archive.id);
          setArchive(null);
          setError('');
        }}
      />
    </>
  );
}

function CategoryForm({ category }: { category?: Category }) {
  const { colours } = useTheme();
  const saveCategory = usePreviewStore((state) => state.saveCategory);
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense');
  const [icon, setIcon] = useState<IconKey>(category?.icon ?? 'other');
  const [error, setError] = useState('');
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dirty =
    name !== (category?.name ?? '') ||
    kind !== (category?.kind ?? 'expense') ||
    icon !== (category?.icon ?? 'other');
  const unsaved = useUnsaved(dirty);
  const save = () => {
    try {
      saveCategory(name, kind, icon, category?.id);
      unsaved.allowNavigation();
      router.replace('/categories');
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Check the category details and try again.';
      setError(message);
      nameRef.current?.focus();
      AccessibilityInfo.announceForAccessibility(message);
    }
  };
  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        {category ? 'Edit category' : 'New category'}
      </AppText>
      <Input
        ref={nameRef}
        label="Category name"
        placeholder="e.g. Weekend treats"
        hint="1–30 characters. Active names must be unique within each kind, ignoring letter case."
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError('');
        }}
        error={error}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {category ? (
        <AppText colour="muted">
          Kind: {category.kind === 'expense' ? 'Expense' : 'Income'}. The kind stays fixed so
          existing entries keep their meaning.
        </AppText>
      ) : (
        <>
          <AppText variant="label">Category kind</AppText>
          <Row>
            {(['expense', 'income'] as const).map((option) => (
              <Chip
                key={option}
                label={option === 'expense' ? 'Expense' : 'Income'}
                selected={kind === option}
                onPress={() => {
                  setKind(option);
                  setError('');
                }}
              />
            ))}
          </Row>
        </>
      )}
      <AppText variant="label">Choose an illustration</AppText>
      <Row>
        {iconKeys.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${key} illustration`}
            accessibilityState={{ selected: key === icon }}
            onPress={() => setIcon(key)}
            style={[
              styles.iconChoice,
              {
                backgroundColor: key === icon ? colours.accent : colours.surface,
                borderColor: key === icon ? colours.primary : colours.outline,
              },
            ]}
          >
            <CategoryIcon name={key} />
            <AppText variant="label" colour={key === icon ? 'onAccent' : 'ink'}>
              {key[0]?.toUpperCase()}
              {key.slice(1)}
            </AppText>
          </Pressable>
        ))}
      </Row>
      <AppText variant="caption" colour="muted">
        Changes live only in this preview session. No storage or backend is connected.
      </AppText>
      <Button label={category ? 'Save category changes' : 'Add category'} onPress={save} />
      {unsaved.dialog}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowText: { flex: 1, minWidth: 100, gap: tokens.space[1] },
  iconChoice: {
    minHeight: tokens.size.tap,
    padding: tokens.space[3],
    gap: tokens.space[2],
    borderWidth: 2,
    borderRadius: tokens.radius.control,
    alignItems: 'center',
    maxWidth: '100%',
  },
});
