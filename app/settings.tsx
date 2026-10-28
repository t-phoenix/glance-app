import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '@/src/state/AppContext';
import { Button, Card, Field, Label, Screen } from '@/src/ui/components';
import { backupKeyFromSecret, encryptBackup } from '@/src/services/backupCrypto';
import { getSecret, SECRET, setSecret } from '@/src/services/secrets';
import { createId } from '@/src/lib/id';
import { MIN_PASSWORD } from '@/src/services/appLock';
import type { Theme } from '@/src/ui/theme';

export default function SettingsScreen() {
  const { theme, repo, themeName, setThemeName, bump, showToast } = useApp();
  const [anthropic, setAnthropic] = useState('');
  const [groq, setGroq] = useState('');
  const [twitter, setTwitter] = useState('');
  const [watch, setWatch] = useState('');
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    void getSecret(SECRET.anthropic).then((value) => setAnthropic(value ?? ''));
    void getSecret(SECRET.groq).then((value) => setGroq(value ?? ''));
    void getSecret(SECRET.twitter).then((value) => setTwitter(value ?? ''));
  }, []);

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <AppLock theme={theme} />
        <Label theme={theme}>AI and voice keys</Label>
        <Card theme={theme} style={{ gap: 10 }}>
          {([['Anthropic key', anthropic, setAnthropic, 'For notes, matching and drafts'], ['Groq key, for voice notes', groq, setGroq, 'Free from console.groq.com. Expo Go cannot transcribe audio on the phone.'], ['twitterapi.io key', twitter, setTwitter, 'Searches X by name']] as const).map(([label, value, set, hint]) => (
            <View key={label} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
                <View style={{ minHeight: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: value.trim() ? `${theme.sea}26` : theme.surface2 }}>
                  <Text style={{ color: value.trim() ? theme.linked : theme.text3, fontSize: 12, fontWeight: '700' }}>{value.trim() ? 'Added' : 'Not set'}</Text>
                </View>
              </View>
              <Field theme={theme} value={value} onChangeText={set} autoCapitalize="none" autoCorrect={false} placeholder={label} secureTextEntry={!showKeys} accessibilityLabel={label.split(',')[0]} style={{ backgroundColor: theme.surface2 }} />
              <Text style={{ color: theme.text3, fontSize: 13 }}>{hint}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button theme={theme} kind="secondary" size="small" icon={showKeys ? 'eye.slash' : 'eye'} label={showKeys ? 'Hide' : 'Show'} onPress={() => setShowKeys((value) => !value)} />
            <Button theme={theme} size="small" icon="checkmark" label="Save keys" style={{ flex: 1 }} onPress={() => {
              void setSecret(SECRET.anthropic, anthropic.trim());
              void setSecret(SECRET.groq, groq.trim());
              void setSecret(SECRET.twitter, twitter.trim());
              showToast('Keys saved');
            }} />
          </View>
        </Card>
        <Text style={{ color: theme.text3, fontSize: 13 }}>Keys stay in the iPhone Keychain. They are not in backups.</Text>
        <Label theme={theme}>Appearance</Label>
        <Card theme={theme} style={{ flexDirection: 'row', gap: 8, padding: 6 }}>
          {(['dark', 'light'] as const).map((name) => (
            <Button key={name} theme={theme} kind={themeName === name ? 'light' : 'ghost'} size="small" icon={name === 'dark' ? 'moon' : 'sun.max'} label={name === 'dark' ? 'Dark' : 'Light'} onPress={() => setThemeName(name)} style={{ flex: 1, borderWidth: 0 }} />
          ))}
        </Card>
        <Label theme={theme}>People you want to meet</Label>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Field theme={theme} value={watch} onChangeText={setWatch} placeholder="Add someone you want to meet" accessibilityLabel="Want to meet" style={{ flex: 1 }} />
          <Button theme={theme} kind="secondary" size="small" icon="plus" label="Add" onPress={() => {
            if (!watch.trim() || !repo) return;
            repo.addWatch(watch.trim());
            setWatch('');
            bump();
          }} />
        </View>
        <Label theme={theme}>Your data</Label>
        <View>
          <Button
            theme={theme}
            kind="secondary"
            icon="square.and.arrow.up"
            label="Export a backup"
            onPress={() => {
            void (async () => {
              if (!repo) return;
              let secret = await getSecret(SECRET.backup);
              if (!secret) {
                secret = createId('bak');
                await setSecret(SECRET.backup, secret);
              }
              const payload = encryptBackup({
                version: 1,
                exportedAt: new Date().toISOString(),
                address: repo.setting('wallet_address') || null,
                database: repo.dump(),
                media: [],
              }, backupKeyFromSecret(secret));
              const path = `${FileSystem.documentDirectory}recall-backup.txt`;
              await FileSystem.writeAsStringAsync(path, payload);
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
              else showToast('Backup written in the app documents folder.');
            })();
          }}
          />
        </View>
        <Text style={{ color: theme.text3, fontSize: 13, lineHeight: 19 }}>A free Apple ID cannot write an automatic iCloud container. Export here, then save the file to iCloud Drive. The wallet key is not in the file. Restore needs this phone's backup secret.</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AppLock({ theme }: { theme: Theme }) {
  const { lock, setFaceLock, setAppPassword, enterPassword, showToast } = useApp();
  const [mode, setMode] = useState<'set' | 'remove' | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setMode(null);
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  }

  async function save() {
    // changing or removing an existing password needs the old one
    if (lock.passcode) {
      const problem = await enterPassword(current);
      if (problem) return setError(problem === 'That password is not right.' ? 'Your current password is not right.' : problem);
    }
    if (mode === 'remove') {
      await setAppPassword(null);
      showToast('App password removed');
      return close();
    }
    if (next.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (next !== confirm) return setError('The two passwords do not match.');
    await setAppPassword(next);
    showToast(lock.passcode ? 'App password changed' : 'App password set');
    close();
  }

  const status = (on: boolean) => (
    <View style={{ minHeight: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: on ? `${theme.sea}26` : theme.surface2 }}>
      <Text style={{ color: on ? theme.linked : theme.text3, fontSize: 12, fontWeight: '700' }}>{on ? 'On' : 'Off'}</Text>
    </View>
  );

  return (
    <>
      <Label theme={theme}>App lock</Label>
      <Card theme={theme} style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>Face ID</Text>
            <Text style={{ color: theme.text3, fontSize: 13 }}>Scan your face when Glance opens</Text>
          </View>
          <Switch
            value={lock.face}
            accessibilityLabel="Face ID lock"
            trackColor={{ true: theme.tide, false: theme.surface2 }}
            onValueChange={(on) => void setFaceLock(on).then((done) => { if (!done) showToast('Face ID lock is still on'); })}
          />
        </View>
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>App password</Text>
              <Text style={{ color: theme.text3, fontSize: 13 }}>{lock.face ? 'Used when Face ID fails' : 'Asked for when Glance opens'}</Text>
            </View>
            {status(lock.passcode)}
          </View>
          {mode ? (
            <View style={{ gap: 8 }}>
              {lock.passcode ? <Field theme={theme} value={current} onChangeText={(value) => { setCurrent(value); setError(null); }} placeholder="Current password" accessibilityLabel="Current password" secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: theme.surface2 }} /> : null}
              {mode === 'set' ? (
                <>
                  <Field theme={theme} value={next} onChangeText={(value) => { setNext(value); setError(null); }} placeholder="New password" accessibilityLabel="New password" secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: theme.surface2 }} />
                  <Field theme={theme} value={confirm} onChangeText={(value) => { setConfirm(value); setError(null); }} placeholder="New password again" accessibilityLabel="Confirm new password" secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: theme.surface2 }} />
                </>
              ) : null}
              {error ? <Text accessibilityLiveRegion="polite" style={{ color: theme.danger, fontSize: 14 }}>{error}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button theme={theme} kind="secondary" size="small" label="Cancel" onPress={close} />
                <Button theme={theme} kind={mode === 'remove' ? 'danger' : 'primary'} size="small" icon={mode === 'remove' ? 'trash' : 'checkmark'} label={mode === 'remove' ? 'Remove password' : 'Save password'} onPress={() => void save()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button theme={theme} kind="secondary" size="small" icon="key" label={lock.passcode ? 'Change' : 'Set a password'} onPress={() => setMode('set')} style={{ flex: 1 }} />
              {lock.passcode ? <Button theme={theme} kind="ghost" size="small" label="Remove" onPress={() => setMode('remove')} /> : null}
            </View>
          )}
        </View>
      </Card>
      <Text style={{ color: theme.text3, fontSize: 13, lineHeight: 19 }}>{lock.face || lock.passcode ? 'Glance locks when it opens and after 5 minutes in the background.' : 'No lock is on. Anyone holding this phone can open Glance.'}</Text>
    </>
  );
}
