import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useApp } from '@/src/state/AppContext';
import { Banner, Card, GlanceMark, Icon, Label, Row, Screen, Title } from '@/src/ui/components';
import { EventTags } from '@/src/ui/EventTags';
import { geoLabel } from '@/src/data/weekTags';
import { formatIstDay, formatIstTime } from '@/src/lib/time';
import { matchEvents } from '@/src/services/eventMatcher';

export default function TodayScreen() {
  const { theme, repo, revision, banner, bump } = useApp();
  const insets = useSafeAreaInsets();
  const people = repo?.peopleToday() ?? [];
  const context = repo?.listContext(people.map((person) => person.id)) ?? new Map();
  const now = new Date().toISOString();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const event = repo ? matchEvents(repo.events(), now, coords?.lat ?? null, coords?.lng ?? null)[0]?.event : undefined;
  const currentTag = repo?.setting('current_tag') || null;
  const open = repo?.actions('open').length ?? 0;
  const overdue = repo?.actions('overdue').length ?? 0;
  void revision;
  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().then(async (permission) => {
      if (!permission.granted) return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    }).catch(() => undefined);
  }, []);
  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120, gap: 14 }}>
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: theme.text2, fontSize: 15 }}>{formatIstDay(now)}</Text>
            <Title theme={theme}>Today</Title>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gearshape" color={theme.text2} size={20} />
          </Pressable>
        </View>
        {banner ? <Banner theme={theme} text={banner} /> : null}
        <Card theme={theme} tone="tide" style={{ marginHorizontal: 16, backgroundColor: `${theme.tide}17` }}>
          <Label theme={theme} color={theme.link}>You're at</Label>
          <Text style={{ color: theme.text, fontSize: 24, fontFamily: 'BricolageGrotesque_700Bold', letterSpacing: -0.3 }}>{currentTag || event?.name || 'Pick an event'}</Text>
          <Text style={{ color: theme.text2, fontSize: 15 }}>{formatIstDay(now)} · {geoLabel(coords?.lat, coords?.lng)}</Text>
          <Text style={{ color: theme.text3, fontSize: 13 }}>{event ? `Nearby schedule: ${event.name}` : 'No schedule event matched this time and place.'}</Text>
          <EventTags theme={theme} value={currentTag} onChange={(tag) => { repo?.setSetting('current_tag', tag); bump(); }} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          <Stat theme={theme} value={people.length} label="met today" color={theme.glacier} />
          <Stat theme={theme} value={open} label="loops open" color={theme.butter} onPress={() => router.navigate('/(tabs)/followups')} />
          <Stat theme={theme} value={overdue} label="overdue" color={overdue ? theme.danger : theme.sea} onPress={() => router.navigate('/(tabs)/followups')} />
        </View>
        <View style={{ paddingHorizontal: 16 }}><Label theme={theme}>Met today</Label></View>
        {people.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 12, marginTop: 24, marginHorizontal: 32 }}>
            <GlanceMark size={72} color={theme.surface2} eye={theme.text3} />
            <Text style={{ color: theme.text2, textAlign: 'center', fontSize: 16, lineHeight: 22 }}>No one yet today. Tap Scan when you meet someone.</Text>
          </View>
        ) : <View>{people.map((person) => {
          const card = context.get(person.id);
          return (
            <Row
              key={person.id}
              theme={theme}
              title={person.display_name || 'Unknown'}
              image={card?.face}
              ring={card?.platform ? 'confirmed' : 'pending'}
              subtitle={[person.role, person.company].filter(Boolean).join(' · ') || person.state}
              trailing={formatIstTime(person.updated_at)}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: person.id } })}
            />
          );
        })}</View>}
      </ScrollView>
    </Screen>
  );
}

function Stat({ theme, value, label, color, onPress }: { theme: ReturnType<typeof useApp>['theme']; value: number; label: string; color: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${value} ${label}`} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flex: 1, backgroundColor: theme.surface1, borderRadius: 18, padding: 12, opacity: pressed ? 0.8 : 1 })}>
      <Text style={{ color, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30 }}>{value}</Text>
      <Text style={{ color: theme.text2, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
