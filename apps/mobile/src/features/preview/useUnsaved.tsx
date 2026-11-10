import { useCallback, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect, useNavigation, usePreventRemove } from 'expo-router';
import { Confirmation } from './ui';

export function useUnsaved(dirty: boolean) {
  const navigation = useNavigation();
  const [pending, setPending] = useState<{ repeat: () => void } | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const disablePrevention = usePreventRemove(dirty && !discarded, ({ repeat }) =>
    setPending({ repeat }),
  );
  useFocusEffect(
    useCallback(() => {
      setDiscarded(false);
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !dirty || discarded) return;
      // A deep-linked form may be the root: Android exit does not remove a Router route.
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setPending({
          repeat: () => (navigation.canGoBack() ? navigation.goBack() : router.replace('/')),
        });
        return true;
      });
      return () => subscription.remove();
    }, [dirty, discarded, navigation]),
  );
  return {
    allowNavigation: () => {
      setDiscarded(true);
      disablePrevention();
    },
    dialog: (
      <Confirmation
        visible={!!pending}
        title="Leave these changes?"
        detail="Your unsaved changes will be discarded."
        confirmLabel="Discard changes"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          setDiscarded(true);
          disablePrevention();
          pending?.repeat();
          setPending(null);
        }}
      />
    ),
  };
}
