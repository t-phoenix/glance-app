import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/src/state/AppContext';
import { ActionBar, Button, Card, Field, Icon, Label, Screen } from '@/src/ui/components';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { emptyNote, parseStructuredNote, type StructuredNote } from '@/src/ai/structure';
import { heuristicNote, structureWithClaude } from '@/src/services/anthropic';
import { getSecret, SECRET } from '@/src/services/secrets';
import { estimateNoteCost } from '@/src/services/notes';

export default function ReviewScreen() {
  const { theme, repo, bump, showToast } = useApp();
  const { encounterId } = useLocalSearchParams<{ encounterId: string }>();
  const encounter = repo?.encounter(encounterId);
  const existing = encounter?.ai_json ? parseStructuredNote(JSON.parse(encounter.ai_json)) : null;
  const initial = existing ?? (encounter?.transcript ? heuristicNote(encounter.transcript) : emptyNote());
  const [note, setNote] = useState<StructuredNote>(initial);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const person = encounter ? repo?.person(encounter.person_id) : undefined;
  const source = encounter?.transcript ?? '';
  const estimate = estimateNoteCost(source || ' ');
  const insets = useSafeAreaInsets();
  const fromAi = Boolean(existing);

  function setPersonField(key: keyof StructuredNote['person'], value: string) {
    setNote({ ...note, person: { ...note.person, [key]: value } });
  }

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Card theme={theme} tone="dusk" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: `${theme.dusk}1F` }}>
          <Icon name="sparkles" color={theme.dusk} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{fromAi ? 'Structured by AI from your note' : 'Read from your note on this phone'}</Text>
            <Text style={{ color: theme.text2, fontSize: 14 }}>Edit anything before it is saved. Fields only stay if they came from your note.</Text>
          </View>
        </Card>
        {([['name', 'Name'], ['company', 'Company'], ['role', 'Role']] as const).map(([key, label]) => (
          <View key={key} style={{ gap: 6 }}>
            <Label theme={theme}>{label}</Label>
            <Field theme={theme} value={note.person[key]} onChangeText={(value) => setPersonField(key, value)} placeholder={label} accessibilityLabel={label} />
          </View>
        ))}
        <View style={{ gap: 6 }}>
          <Label theme={theme}>What they do</Label>
          <Field theme={theme} value={note.person.what_they_do} onChangeText={(value) => setPersonField('what_they_do', value)} placeholder="What they do" multiline style={{ minHeight: 100, textAlignVertical: 'top', lineHeight: 22 }} accessibilityLabel="What they do" />
        </View>
        {note.actions.length > 0 ? <Label theme={theme}>Promises</Label> : null}
        {note.actions.map((action, index) => (
          <View key={index} style={{ backgroundColor: theme.surface1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ minHeight: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: `${action.owner === 'me' ? theme.butter : theme.glacier}26` }}>
              <Text style={{ color: action.owner === 'me' ? theme.warning : theme.glacier, fontSize: 12, fontWeight: '700' }}>{action.owner === 'me' ? 'You' : 'They'}</Text>
            </View>
            <Text style={{ color: theme.text, flex: 1, fontSize: 15 }}>{action.text}</Text>
          </View>
        ))}
        <View style={{ gap: 6 }}>
          <Label theme={theme} color={theme.dusk}>Draft follow-up</Label>
          <Field theme={theme} value={note.draft_followup} onChangeText={(value) => setNote({ ...note, draft_followup: value })} placeholder="Draft follow-up" multiline style={{ minHeight: 80, textAlignVertical: 'top', lineHeight: 22, borderColor: `${theme.dusk}55` }} accessibilityLabel="Draft follow-up" />
        </View>
        <AiConfirm
          theme={theme}
          visible={ask}
          title={estimate.title}
          detail={estimate.detail}
          estimate={estimate.estimate}
          busy={busy}
          canRun={canRun}
          onCancel={() => setAsk(false)}
          onFree={() => { setNote(heuristicNote(source)); setAsk(false); }}
          onRun={() => {
            void (async () => {
              setBusy(true);
              try {
                const key = await getSecret(SECRET.anthropic);
                if (!key) { showToast('Add an Anthropic key in Settings.'); return; }
                const next = await structureWithClaude(key, source);
                if (!next) { showToast('AI returned nothing usable.'); return; }
                setNote(next);
                if (repo && encounterId) repo.finishAi('structure_note', encounterId);
                setAsk(false);
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'AI did not run.');
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      </ScrollView>
      <ActionBar theme={theme} bottom={Math.max(16, insets.bottom)}>
        <Button theme={theme} kind="ai" icon="sparkles" label="Analyse" onPress={() => {
          if (!source.trim()) { showToast('There is no note to read.'); return; }
          void getSecret(SECRET.anthropic).then((key) => { setCanRun(Boolean(key)); setAsk(true); });
        }} />
        <Button
          theme={theme}
          icon="checkmark"
          label="Save"
          style={{ flex: 1 }}
          onPress={() => {
            if (!repo) return;
            repo.saveReview(encounterId, note);
            bump();
            showToast(`Saved to ${note.person.name || person?.display_name || 'them'}`);
            router.back();
          }}
        />
      </ActionBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}
