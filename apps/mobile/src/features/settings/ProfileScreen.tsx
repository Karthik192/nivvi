import { isPreview, api } from '../../data/runtime';
import { useRef, useState, type ComponentRef } from 'react';
import { router, type Href } from 'expo-router';
import { AccessibilityInfo, type TextInput } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Mascot } from '../../components/brand/Mascot';
import type { Profile } from '../preview/model';
import { useAppStore } from '../../data/store';
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
  const profile = useAppStore((state) => state.profile);
  return (
    <Page
      title="A little space for you."
      subtitle={isPreview ? 'Your preview profile' : 'Your profile'}
      back
    >
      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <EmptyState
          title={isPreview ? 'No preview profile yet' : 'Profile unavailable'}
          detail={
            isPreview
              ? 'Enter the design preview to try editing a temporary profile. No real account is created.'
              : 'Sign in again to load your account profile.'
          }
          action={isPreview ? 'Enter preview' : 'Sign in again'}
          onAction={() => router.replace('/sign-in')}
        />
      )}
    </Page>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const version = useRef(profile.version);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const signOut = useAppStore((state) => state.signOut);
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [destination, setDestination] = useState<Href | null>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dirty = name !== profile.name;
  const unsaved = useUnsaved(dirty);
  const save = async () => {
    try {
      await updateProfile(name, version.current);
      version.current = useAppStore.getState().profile?.version;
      setName(name.trim());
      setError('');
      AccessibilityInfo.announceForAccessibility('Profile name updated.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Check your name and try again.';
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
          {isPreview
            ? 'Design preview. These details stay in memory.'
            : 'Your profile is stored with your Nivvi account.'}
        </AppText>
        <Input
          ref={nameRef}
          label="Your name"
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
          label="Email address"
          value={profile.email}
          editable={false}
          hint="Email address changes are not available here."
        />
        <Button label="Save name" onPress={save} />
      </Card>
      {!isPreview && (
        <Card>
          <AppText variant="heading">Account email</AppText>
          <Button
            label="Resend verification instructions"
            variant="secondary"
            onPress={async () => {
              try {
                await api.request('/auth/email/resend', { method: 'POST', body: '{}' });
                setError('Verification instructions requested.');
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          />
          <Button
            label="I have a verification token"
            variant="quiet"
            onPress={() => router.push({ pathname: '/account-action', params: { mode: 'verify' } })}
          />
        </Card>
      )}
      <Section title="Make this space yours">
        {links
          .filter((link) => isPreview || link.path !== '/preview-tools')
          .map((link) => (
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
          Ready to take a break?
        </AppText>
        <AppText colour="muted">
          {isPreview
            ? 'Signing out resets the sample preview.'
            : 'Signing out removes this device?s session. Saved records remain in your account.'}
        </AppText>
        <Button label="Sign out" variant="destructive" onPress={() => setSigningOut(true)} />
      </Card>
      <Confirmation
        visible={signingOut}
        title="Sign out of Nivvi?"
        detail="Unsaved changes on this screen will be discarded. Saved account records will remain."
        confirmLabel="Sign out"
        onCancel={() => setSigningOut(false)}
        onConfirm={async () => {
          unsaved.allowNavigation();
          try {
            await signOut();
            router.replace('/');
          } catch (error) {
            setError((error as Error).message);
            setSigningOut(false);
          }
        }}
      />
      <Confirmation
        visible={destination !== null}
        title="Leave these name changes?"
        detail="Your unsaved preview name will be discarded. Your other sample data stays as it is."
        confirmLabel="Discard name changes"
        onCancel={() => setDestination(null)}
        onConfirm={async () => {
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
