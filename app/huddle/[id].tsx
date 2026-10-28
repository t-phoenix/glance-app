import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { estimateNoteCost } from '@/src/services/notes';
import { getSecret, SECRET } from '@/src/services/secrets';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Card, Field, Icon, Screen, Title } from '@/src/ui/components';
import { splitGroupNote } from '@/src/ai/split';

export default function HuddleScreen() {
  const { theme, repo, bump, showToast } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const people = repo?.huddlePeople(id) ?? [];
  const context = repo?.listContext(people.map((person) => person.id)) ?? new Map();
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [ask, setAsk] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const estimate = estimateNoteCost(note || ' ');
  const stubs = people.map((person) => ({
    id: person.id,
    name: person.display_name ?? '',
    handle: context.get(person.id)?.value ?? '',
  }));
  const split = done ? splitGroupNote(note, stubs) : null;

  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Title theme={theme} size={30}>Say who's who</Title>
            <Text style={{ color: theme.text2, fontSize: 15 }}>{people.length} people in this huddle</Text>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${theme.glacier}26`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person.3" color={theme.glacier} size={22} />
          </View>
        </View>
        <Text style={{ color: theme.text3, fontSize: 14, lineHeight: 20 }}>Paid lookups run only for starred people and people you mention.</Text>
        {people.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {people.map((person) => (
              <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface1, borderRadius: 20, paddingLeft: 4, paddingRight: 12, minHeight: 40 }}>
                <Avatar theme={theme} uri={context.get(person.id)?.face} name={person.display_name || 'Unknown'} size={32} />
                <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>{person.display_name || 'Unknown'}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Field theme={theme} value={note} onChangeText={setNote} multiline placeholder="Priya is building proofs. Karan runs a fund." style={{ minHeight: 140, textAlignVertical: 'top', lineHeight: 22 }} accessibilityLabel="Group note" />
        <Button
          theme={theme}
          icon="person.2"
          label="Split into people"
          onPress={() => {
            if (!repo) return;
            repo.endHuddle(id, note);
            const result = splitGroupNote(note, stubs);
            for (const assignment of result.assignments) {
              repo.markMentioned(assignment.stubId);
              const encounter = repo.encounters(assignment.stubId).find((item) => true);
              if (encounter) repo.patchEncounter(encounter.id, { transcript: assignment.text });
            }
            setDone(true);
            bump();
            showToast('Split saved');
            if (note.trim()) void getSecret(SECRET.anthropic).then((key) => { setCanRun(Boolean(key)); setAsk(true); });
          }}
        />
        {split ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>Mentioned {split.assignments.length}. Unmentioned {split.unmentioned.length}.</Text>
            {split.unmentioned.map((personId) => {
              const person = repo?.person(personId);
              return (
                <Card key={personId} theme={theme} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                  <Avatar theme={theme} uri={context.get(personId)?.face} name={person?.display_name || 'Unknown'} size={42} />
                  <Text style={{ color: theme.text, flex: 1, fontSize: 15 }} numberOfLines={2}>{person?.display_name} was not mentioned.</Text>
                  <Button theme={theme} kind="secondary" size="small" label="Drop" onPress={() => { repo?.setState(personId, 'dropped'); bump(); }} />
                  <Button theme={theme} kind="done" size="small" label="Keep" onPress={() => { repo?.setState(personId, 'kept'); bump(); }} />
                </Card>
              );
            })}
          </View>
        ) : null}
        <AiConfirm
          theme={theme}
          visible={ask}
          title="Structure the huddle notes"
          detail={`${estimate.detail} This runs once per person you mentioned.`}
          estimate={estimate.estimate}
          canRun={canRun}
          onCancel={() => setAsk(false)}
          onRun={() => {
            if (!repo || !canRun) return;
            for (const person of people) {
              const encounter = repo.encounters(person.id)[0];
              if (!encounter?.transcript) continue;
              repo.allowAi('structure_note', encounter.id);
              repo.enqueue('structure_note', encounter.id, 'network');
            }
            setAsk(false);
            showToast('AI will draft those notes. You can edit each one after.');
            bump();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
