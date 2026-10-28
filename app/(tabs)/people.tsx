import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { Field, GlanceMark, Icon, Row, Screen, Title } from '@/src/ui/components';
import { formatIstDay } from '@/src/lib/time';
import { geoLabel } from '@/src/data/weekTags';

export default function PeopleScreen() {
  const { theme, repo, revision } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  void revision;
  const people = repo ? (query.trim() ? repo.search(query) : repo.allPeople()) : [];
  const context = repo?.listContext(people.map((person) => person.id)) ?? new Map();
  return (
    <Screen theme={theme}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Title theme={theme}>People</Title>
          <Text style={{ color: theme.text3, fontSize: 13, fontFamily: 'JetBrainsMono_500Medium', marginBottom: 6 }}>{people.length} {query.trim() ? 'found' : 'total'}</Text>
        </View>
        <View>
          <Field theme={theme} value={query} onChangeText={setQuery} placeholder="Who was that…" accessibilityLabel="Search people" clearButtonMode="while-editing" style={{ paddingLeft: 44 }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}><Icon name="magnifyingglass" color={theme.text3} size={17} /></View>
        </View>
      </View>
      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<View style={{ alignItems: 'center', gap: 12, marginTop: 72, marginHorizontal: 32 }}><GlanceMark size={72} color={theme.surface2} eye={theme.text3} /><Text style={{ color: theme.text2, textAlign: 'center', fontSize: 16, lineHeight: 22 }}>{query.trim() ? 'No one matches that.' : 'No one saved yet. Scan a profile when you meet them.'}</Text></View>}
        renderItem={({ item }) => {
          const card = context.get(item.id);
          const when = card?.at ? formatIstDay(card.at) : '';
          const where = card ? geoLabel(card.lat, card.lng) : '';
          const handle = card?.value ? (card.platform === 'whatsapp' ? card.value : `@${card.value}`) : '';
          return (
            <Row
              theme={theme}
              title={item.display_name || 'Unknown'}
              image={card?.face}
              ring={card?.platform ? 'confirmed' : 'pending'}
              subtitle={[handle, when, card?.tag, where === 'No location' ? '' : where].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })}
            />
          );
        }}
      />
    </Screen>
  );
}
