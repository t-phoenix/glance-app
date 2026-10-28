import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Card, GlanceMark, Icon, Label, Screen, Title } from '@/src/ui/components';

export default function RecapScreen() {
  const { theme, repo, revision, bump } = useApp();
  void revision;
  const insets = useSafeAreaInsets();
  const people = (repo?.allPeople() ?? []).filter((person) => person.state === 'stub' || person.state === 'needs_review');
  const context = repo?.listContext(people.map((person) => person.id)) ?? new Map();
  const failed = (repo?.jobs() ?? []).filter((job) => job.status === 'dead' || job.status === 'failed');
  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 + insets.bottom }}>
        <View style={{ gap: 4 }}>
          <Title theme={theme} size={30}>{people.length === 0 ? 'All settled' : `${people.length} to settle`}</Title>
          <Text style={{ color: theme.text2, fontSize: 15 }}>{people.length === 0 ? 'Everyone has a keep or drop.' : 'People still need a keep or drop.'}</Text>
        </View>
        {people.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}><GlanceMark size={88} color={theme.sea} eye={theme.onColor} /></View>
        ) : null}
        {people.map((person) => (
          <Card key={person.id} theme={theme} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar theme={theme} uri={context.get(person.id)?.face} name={person.display_name || 'Unknown'} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 20, fontFamily: 'BricolageGrotesque_700Bold' }} numberOfLines={1}>{person.display_name}</Text>
                <Text style={{ color: theme.text2, fontSize: 14 }} numberOfLines={3}>{person.summary || 'No note yet'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button theme={theme} kind="secondary" size="small" icon="xmark" label="Drop" onPress={() => { repo?.setState(person.id, 'dropped'); bump(); }} style={{ flex: 1 }} />
              <Button theme={theme} kind="done" size="small" icon="checkmark" label="Keep" onPress={() => { repo?.setState(person.id, 'kept'); bump(); }} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}
        <Label theme={theme}>Background jobs</Label>
        <Card theme={theme} style={{ gap: 8 }}>
          {failed.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="checkmark.circle.fill" color={theme.linked} size={18} />
              <Text style={{ color: theme.text, fontSize: 15 }}>No failed jobs.</Text>
            </View>
          ) : failed.map((job) => (
            <Text key={job.id} style={{ color: theme.warning, fontSize: 14, fontFamily: 'JetBrainsMono_500Medium' }}>{job.kind} · {job.error_code ?? job.status}</Text>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
