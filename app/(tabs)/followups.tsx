import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Card, Chip, GlanceMark, Screen, Title } from '@/src/ui/components';
import { deepLink, type Channel } from '@/src/services/followupLinks';

export default function FollowupsScreen() {
  const { theme, repo, revision, bump, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const [bucket, setBucket] = useState<'overdue' | 'week' | 'waiting'>('week');
  const [ask, setAsk] = useState<string | null>(null);
  void revision;
  const rows = repo?.actions(bucket) ?? [];
  const counts = { overdue: repo?.actions('overdue').length ?? 0, week: repo?.actions('week').length ?? 0, waiting: repo?.actions('waiting').length ?? 0 };
  const context = repo?.listContext(rows.map((action) => action.person_id)) ?? new Map();
  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 140, gap: 12 }}>
        <Title theme={theme}>Follow-ups</Title>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['overdue', 'week', 'waiting'] as const).map((item) => (
            <Chip key={item} theme={theme} label={item === 'week' ? 'This week' : item === 'overdue' ? 'Overdue' : 'Waiting'} count={counts[item]} tone={item === 'overdue' ? 'butter' : undefined} active={bucket === item} onPress={() => setBucket(item)} />
          ))}
        </View>
        {rows.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 12, marginTop: 40 }}>
            <GlanceMark size={72} color={theme.surface2} eye={theme.text3} />
            <Text style={{ color: theme.text2, fontSize: 16 }}>Nothing in this list.</Text>
          </View>
        ) : null}
        {rows.map((action) => {
          const person = repo?.person(action.person_id);
          const card = context.get(action.person_id);
          return (
            <Card key={action.id} theme={theme} tone={bucket === 'overdue' ? 'butter' : undefined} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar theme={theme} uri={card?.face} name={person?.display_name || 'Unknown'} size={44} ring={card?.platform ? 'confirmed' : undefined} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }} numberOfLines={1}>{person?.display_name}</Text>
                  {action.due ? <Text style={{ color: bucket === 'overdue' ? theme.warning : theme.text3, fontSize: 13 }}>{bucket === 'overdue' ? 'Overdue · ' : 'Due '}{action.due}</Text> : null}
                </View>
              </View>
              <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}>{action.text}</Text>
              {action.draft ? <Text style={{ color: theme.text2, backgroundColor: theme.surface2, padding: 12, borderRadius: 14, fontSize: 15, lineHeight: 21 }}>{action.draft}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  theme={theme}
                  kind="secondary"
                  size="small"
                  icon="arrow.up.right"
                  label="Open"
                  style={{ flex: 1 }}
                  onPress={() => {
                    const link = deepLink((action.channel as Channel) ?? (card?.platform as Channel) ?? null, card?.value ?? '', action.draft ?? action.text);
                    if (link.copyDraft) void Clipboard.setStringAsync(action.draft || action.text);
                    if (link.url) void Linking.openURL(link.url);
                    setAsk(action.id);
                  }}
                />
                <Button theme={theme} kind="done" size="small" icon="checkmark" label="Done" accessibilityLabel={`Mark ${action.text} done`} style={{ flex: ask === action.id ? 1.6 : 1.2 }} onPress={() => { repo?.completeAction(action.id); bump(); setAsk(null); showToast('Done. That loop is closed.'); }} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
