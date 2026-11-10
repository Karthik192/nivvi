import { useRef, useState, type ComponentRef } from 'react';
import { router, type Href } from 'expo-router';
import { AccessibilityInfo, type TextInput } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Mascot } from '../../components/brand/Mascot';
import type { Profile } from '../preview/model';
import { usePreviewStore } from '../preview/store';
import { Confirmation, EmptyState, Page, Section } from '../preview/ui';
import { useUnsaved } from '../preview/useUnsaved';

const links = [
  { label: 'Appearance and accessibility', path: '/settings' },
  { label: 'Manage categories', path: '/categories' },
  { label: 'Monthly budgets', path: '/budgets' },
  { label: 'Preview tools', path: '/preview-tools' },
  { label: 'About Nivvi', path: '/about' },
] as const satisfies readonly { label: string; path: Href }[];

export function ProfileScreen() {
  const profile = usePreviewStore((state) => state.profile);
  return (
    <Page title="A little space for you." subtitle="Your preview profile" back>
      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <EmptyState
          title="No preview profile yet"
          detail="Enter the design preview to try editing a temporary profile. No real account is created."
          action="Enter preview"
          onAction={() => router.replace('/sign-in')}
        />
      )}
    </Page>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = usePreviewStore((state) => state.updateProfile);
  const signOut = usePreviewStore((state) => state.signOut);
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [destination, setDestination] = useState<Href | null>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dirty = name !== profile.name;
  const unsaved = useUnsaved(dirty);
  const save = () => {
    try {
      updateProfile(name);
      setName(name.trim());
      setError('');
      AccessibilityInfo.announceForAccessibility('Profile name updated for this preview session.');
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Check your preview name and try again.';
      setError(message);
      nameRef.current?.focus();
      AccessibilityInfo.announceForAccessibility(message);
    }
  };
  return (
    <>
      <Card>
        <Mascot />
        <AppText variant="heading" accessibilityRole="header">
          Your name, your pace.
        </AppText>
        <AppText colour="muted">
          Design preview. No real account is created. These details stay in memory for this session.
        </AppText>
        <Input
          ref={nameRef}
          label="Preview name"
          hint="Use a name between 1 and 60 characters."
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError('');
          }}
          error={error}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Input
          label="Demo email address"
          value={profile.email}
          editable={false}
          hint="Read-only preview detail. No email verification or account service is connected."
        />
        <Button label="Save preview name" onPress={save} />
      </Card>
      <Section title="Make this space yours">
        {links.map((link) => (
          <Button
            key={link.path}
            label={link.label}
            variant="secondary"
            onPress={() => (dirty ? setDestination(link.path) : router.push(link.path))}
          />
        ))}
      </Section>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Ready to leave the preview?
        </AppText>
        <AppText colour="muted">
          Signing out clears your preview profile and resets sample entries, categories, budgets and
          goals. Nothing was stored or synced.
        </AppText>
        <Button
          label="Sign out of preview"
          variant="destructive"
          onPress={() => setSigningOut(true)}
        />
      </Card>
      <Confirmation
        visible={signingOut}
        title="Leave and reset this preview?"
        detail="Your profile, unsaved name changes and edits to sample data will be discarded. The starting sample entries, categories, budgets and goals will be restored. This does not sign out of a real account."
        confirmLabel="Sign out and reset preview"
        onCancel={() => setSigningOut(false)}
        onConfirm={() => {
          unsaved.allowNavigation();
          signOut();
          router.replace('/');
        }}
      />
      <Confirmation
        visible={destination !== null}
        title="Leave these name changes?"
        detail="Your unsaved preview name will be discarded. Your other sample data stays as it is."
        confirmLabel="Discard name changes"
        onCancel={() => setDestination(null)}
        onConfirm={() => {
          const next = destination;
          setDestination(null);
          setName(profile.name);
          setError('');
          if (next) router.push(next);
        }}
      />
      {unsaved.dialog}
    </>
  );
}
