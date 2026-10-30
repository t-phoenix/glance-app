import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Card, Chip, Field, Icon, Label, List, ListItem, MONO, PlatformMark, Screen, platformName } from '@/src/ui/components';
import { VoiceNote } from '@/src/ui/VoiceNote';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { EventTags } from '@/src/ui/EventTags';
import { geoLabel } from '@/src/data/weekTags';
import { formatIstDay, formatIstTime } from '@/src/lib/time';
import { profileUrl } from '@/src/services/followupLinks';
import { getSecret, SECRET } from '@/src/services/secrets';
import { applyDossier, primaryProfilePhoto, upgradeWebAnchor } from '@/src/services/primaryAccount';
import { parseDossier, profileReady } from '@/src/services/profileDossier';
import { LinkedInProfileFetch } from '@/src/ui/LinkedInProfileFetch';
import { heuristicNote, structureWithClaude } from '@/src/services/anthropic';
import { transcribeRecording } from '@/src/services/transcribe';
import { bulletsFromStructured, bulletsFromText, estimateFollowupCost, estimateVoiceCost, taskDrafts } from '@/src/services/notes';
import { ActionChecklist } from '@/src/ui/ActionChecklist';
import type { GlanceRepository, TaskDraft } from '@/src/db/repository';

function MeetingNote({
  theme,
  repo,
  encounter,
  bump,
  onAnalyse,
}: {
  theme: ReturnType<typeof useApp>['theme'];
  repo: GlanceRepository;
  encounter: ReturnType<GlanceRepository['encounters']>[number];
  bump: () => void;
  onAnalyse: (note: string) => void;
}) {
  const [text, setText] = useState(encounter.transcript ?? '');
  useEffect(() => { setText(encounter.transcript ?? ''); }, [encounter.transcript]);
  const when = `${formatIstDay(encounter.at)} · ${formatIstTime(encounter.at)}`;
  const where = geoLabel(encounter.lat, encounter.lng);
  function save(next = text) {
    repo.patchEncounter(encounter.id, { transcript: next });
    bump();
  }
  return (
    <Card theme={theme} style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{when}</Text>
        <Text style={{ color: theme.text3, fontSize: 13 }}>{encounter.tag || repo.eventName(encounter.event_id) || 'No event tag'} · {where}</Text>
      </View>
      <VoiceNote
        theme={theme}
        audioUri={encounter.audio_uri}
        audioMs={encounter.audio_ms ?? 0}
        onRecorded={(uri, ms) => {
          repo.patchEncounter(encounter.id, { audio_uri: uri, audio_ms: ms });
          bump();
        }}
        onAnalyse={() => onAnalyse(text)}
      />
      <Field theme={theme} value={text} onChangeText={setText} onBlur={() => save()} multiline placeholder="The written note. Type it, or record and tap Analyse." accessibilityLabel="Meeting note" style={{ minHeight: 120, textAlignVertical: 'top', backgroundColor: theme.surface2, lineHeight: 22 }} />
      <EventTags theme={theme} value={encounter.tag} onChange={(tag) => { repo.patchEncounter(encounter.id, { tag }); repo.setSetting('current_tag', tag); bump(); }} />
      <Button theme={theme} size="small" icon="checkmark" label="Save note" onPress={() => save()} />
    </Card>
  );
}

export default function PersonScreen() {
  const { theme, repo, revision, bump, showToast } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = repo?.person(id);
  const handles = repo?.handles(id) ?? [];
  const encounters = repo?.encounters(id) ?? [];
  const suggestions = handles.filter((handle) => handle.status === 'suggested' || handle.status === 'conflict');
  const [ask, setAsk] = useState<{ encounterId: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [followAsk, setFollowAsk] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followCanRun, setFollowCanRun] = useState(false);
  const [drafts, setDrafts] = useState<TaskDraft[] | null>(null);
  const [canRun, setCanRun] = useState(false);
  const [voiceClaude, setVoiceClaude] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const upgraded = useRef(false);
  useEffect(() => {
    if (!repo || upgraded.current) return;
    const anchor = repo.handles(id).find((handle) => handle.status === 'anchor' && handle.platform === 'web');
    if (!anchor) return;
    upgraded.current = true;
    void (async () => {
      const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
      const filled = await upgradeWebAnchor(repo, id, twitter);
      if (filled) bump();
    })();
  }, [repo, id, bump]);
  void revision;
  if (!person || !repo) return <Screen theme={theme}><Text style={{ color: theme.text, padding: 24 }}>This person is gone.</Text></Screen>;
  const linked = handles.filter((handle) => (handle.status === 'confirmed' || handle.status === 'anchor') && handle.platform !== 'web');
  const anchor = linked.find((handle) => handle.status === 'anchor') ?? linked[0];
  const dossier = parseDossier(anchor?.raw_json);
  const face = primaryProfilePhoto(person.photo_uri, handles);
  const photos = encounters.flatMap((encounter) => repo.encounterPhotos(encounter.id).map((uri) => ({ uri, encounterId: encounter.id })));
  const latest = encounters[0];
  const estimate = estimateVoiceCost(voiceClaude);

  function openProfile(platform: string, value: string, url: string | null) {
    void Linking.openURL(url || profileUrl(platform, value));
  }

  async function beginAnalyse(encounterId: string, note: string) {
    const encounter = repo?.encounters(id).find((item) => item.id === encounterId);
    if (!encounter?.audio_uri) {
      showToast('Record a voice note first. Typed notes stay as you wrote them.');
      return;
    }
    const [groq, anthropic] = await Promise.all([getSecret(SECRET.groq), getSecret(SECRET.anthropic)]);
    setCanRun(Boolean(groq));
    setVoiceClaude(Boolean(anthropic));
    setAsk({ encounterId, note });
  }

  function writeNote(encounterId: string, current: string, bullets: string) {
    if (!repo) return;
    const next = current.trim() ? `${current.trim()}\n${bullets}` : bullets;
    repo.patchEncounter(encounterId, { transcript: next });
    bump();
    setAsk(null);
    showToast('Added to the note.');
  }

  async function runAnalyse() {
    if (!repo || !ask) return;
    setBusy(true);
    try {
      const encounter = repo.encounters(id).find((item) => item.id === ask.encounterId);
      const groq = await getSecret(SECRET.groq);
      if (!groq || !encounter?.audio_uri) {
        showToast('Add a Groq key in Settings so the recording can be transcribed.');
        return;
      }
      const transcript = await transcribeRecording(encounter.audio_uri, groq);
      const anthropic = await getSecret(SECRET.anthropic);
      let bullets = '';
      if (anthropic) {
        try {
          const structured = await structureWithClaude(anthropic, transcript);
          bullets = structured ? bulletsFromStructured(structured) : '';
          if (structured) {
            repo.saveDraft(ask.encounterId, structured);
            repo.finishAi('structure_note', ask.encounterId);
          }
        } catch {
          bullets = '';
        }
      }
      if (!bullets) bullets = bulletsFromText(transcript);
      writeNote(ask.encounterId, ask.note, bullets);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The analysis did not finish.');
    } finally {
      setBusy(false);
    }
  }

  const noteText = encounters.map((encounter) => encounter.transcript?.trim()).filter(Boolean).join('\n\n');
  const followEstimate = estimateFollowupCost(noteText);

  async function beginFollowups() {
    const anthropic = await getSecret(SECRET.anthropic);
    setFollowCanRun(Boolean(anthropic));
    setFollowAsk(true);
  }

  function showProposed(next: TaskDraft[]) {
    setFollowBusy(false);
    setFollowAsk(false);
    if (!next.length) {
      showToast('No promises in these notes.');
      return;
    }
    setDrafts(next);
  }

  async function runFollowups() {
    const anthropic = await getSecret(SECRET.anthropic);
    if (!anthropic || !noteText) return;
    setFollowBusy(true);
    try {
      const structured = await structureWithClaude(anthropic, noteText);
      showProposed(structured ? taskDrafts(structured) : []);
    } catch (error) {
      setFollowBusy(false);
      showToast(error instanceof Error ? error.message : 'The read did not finish.');
    }
  }

  function saveFollowups() {
    if (!repo || !drafts) return;
    const saved = repo.saveTasks(id, drafts);
    bump();
    setDrafts(null);
    showToast(saved ? `Saved ${saved}.` : 'Nothing saved.');
  }

  const role = [person.role, person.company].filter(Boolean).join(' · ') || person.state;
  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ backgroundColor: `${theme.glacier}22`, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, padding: 20, paddingTop: 8, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
            <Avatar theme={theme} uri={face} name={person.display_name || 'Unknown'} size={84} ring={linked.length ? 'confirmed' : 'pending'} />
            <View style={{ flex: 1, gap: 2, paddingBottom: 4 }}>
              <Text accessibilityRole="header" style={{ color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, letterSpacing: -0.5 }} numberOfLines={2}>{person.display_name}</Text>
              <Text style={{ color: theme.text2, fontSize: 15 }} numberOfLines={2}>{role}</Text>
            </View>
          </View>
          {person.recognise_hint ? <Text style={{ color: theme.text3, fontSize: 14 }}>{person.recognise_hint}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {linked.map((handle) => {
              const primary = handle.id === (linked.find((item) => item.status === 'anchor') ?? linked[0])?.id;
              const label = handle.platform === 'whatsapp' ? handle.value : `@${handle.value}`;
              return (
                <View key={handle.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface1, borderRadius: 18, minHeight: 40 }}>
                  <Pressable accessibilityLabel={`Open ${platformName(handle.platform)}`} onPress={() => openProfile(handle.platform, handle.value, handle.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: primary ? 12 : 4, minHeight: 40 }}>
                    <PlatformMark platform={handle.platform} size={30} />
                    <Text style={{ color: theme.text, fontSize: 13, fontFamily: MONO }} numberOfLines={1}>{label}</Text>
                  </Pressable>
                  {primary ? null : (
                    <Pressable
                      accessibilityLabel={`Remove ${label}`}
                      onPress={() => {
                        Alert.alert(`Remove ${label}?`, undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => { repo.rejectHandle(handle.id); bump(); showToast('Account removed.'); } },
                        ]);
                      }}
                      hitSlop={6}
                      style={{ minWidth: 36, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingRight: 8 }}
                    >
                      <Icon name="xmark" color={theme.text3} size={14} />
                    </Pressable>
                  )}
                </View>
              );
            })}
            <Chip theme={theme} label={suggestions.length ? `${suggestions.length} to review` : 'Find accounts'} onPress={() => router.push({ pathname: '/identity/[personId]', params: { personId: id } })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button theme={theme} kind={person.starred ? 'primary' : 'secondary'} size="small" icon={person.starred ? 'star.fill' : 'star'} label={person.starred ? 'Starred' : 'Star'} onPress={() => { repo.setStar(id, !person.starred); bump(); }} style={{ flex: 1 }} />
            <Button
              theme={theme}
              kind="secondary"
              size="small"
              icon="camera.fill"
              label="Photo"
              style={{ flex: 1 }}
              onPress={() => {
                if (!latest) {
                  showToast('There is no meeting to attach a photo to.');
                  return;
                }
                void ImagePicker.launchCameraAsync({ quality: 0.8 }).then((result) => {
                  const uri = result.canceled ? '' : result.assets[0]?.uri;
                  if (!uri) return;
                  repo.addEncounterPhoto(latest.id, uri);
                  bump();
                });
              }}
            />
          </View>
        </View>
        <View style={{ padding: 16, gap: 16 }}>
          {person.summary && !dossier ? <Text style={{ color: theme.text2, lineHeight: 22, fontSize: 16 }}>{person.summary}</Text> : null}
          {anchor?.platform === 'linkedin' && (dossier?.photoSource !== 'profile' || !profileReady(dossier) || (!dossier?.about && !dossier?.experience.length)) ? (
            <LinkedInProfileFetch theme={theme} slug={anchor.value} onDossier={(next) => { applyDossier(repo, id, next); bump(); }} />
          ) : null}
          {dossier ? (
            <View style={{ gap: 10 }}>
              <Button theme={theme} kind="secondary" label={profileOpen ? 'Hide profile' : 'Profile'} onPress={() => setProfileOpen((open) => !open)} />
              {profileOpen ? (
                <Card theme={theme} style={{ gap: 12 }}>
                  {dossier.about ? <Text style={{ color: theme.text2, fontSize: 16, lineHeight: 22 }}>{dossier.about}</Text> : null}
                  {dossier.location ? <Text style={{ color: theme.text2, fontSize: 15 }}>Location · {dossier.location}</Text> : null}
                  {dossier.phone ? <Text style={{ color: theme.text2, fontSize: 15 }}>Phone · {dossier.phone}</Text> : null}
                  {dossier.experience.length ? (
                    <View style={{ gap: 6 }}>
                      <Label theme={theme}>Experience</Label>
                      {dossier.experience.map((role) => (
                        <Text key={`${role.title}-${role.company}`} style={{ color: theme.text, fontSize: 15 }}>{[role.title, role.company, role.dates].filter(Boolean).join(' · ')}</Text>
                      ))}
                    </View>
                  ) : null}
                  {dossier.education.length ? (
                    <View style={{ gap: 6 }}>
                      <Label theme={theme}>Education</Label>
                      {dossier.education.map((school) => (
                        <Text key={`${school.school}-${school.degree}`} style={{ color: theme.text, fontSize: 15 }}>{[school.school, school.degree, school.dates].filter(Boolean).join(' · ')}</Text>
                      ))}
                    </View>
                  ) : null}
                  {dossier.links.length ? (
                    <View style={{ gap: 6 }}>
                      <Label theme={theme}>Links</Label>
                      {dossier.links.map((link) => (
                        <Pressable key={link.url} accessibilityLabel={`Open ${link.url}`} onPress={() => void Linking.openURL(link.url)}>
                          <Text style={{ color: theme.link, fontSize: 15 }}>{link.url}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </Card>
              ) : null}
            </View>
          ) : null}
          <List theme={theme}>
            <ListItem theme={theme} icon="person.2" tone="glacier" title="Possible accounts" subtitle={suggestions.length ? `${suggestions.length} to review` : 'Look up other platforms'} onPress={() => router.push({ pathname: '/identity/[personId]', params: { personId: id } })} last />
          </List>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Label theme={theme}>Notes</Label>
              {noteText ? <Button theme={theme} kind="ai" size="small" icon="sparkles" label="Make follow-ups" onPress={() => void beginFollowups()} /> : null}
            </View>
            {encounters.length === 0 ? <Text style={{ color: theme.text3 }}>No notes yet.</Text> : null}
            {encounters.map((encounter) => (
              <MeetingNote key={encounter.id} theme={theme} repo={repo} encounter={encounter} bump={bump} onAnalyse={(note) => void beginAnalyse(encounter.id, note)} />
            ))}
          </View>
          <View style={{ gap: 10 }}>
            <Label theme={theme}>Photos · {photos.length}</Label>
            <Text style={{ color: theme.text3, fontSize: 14 }}>Pictures taken at the event. The face above stays the profile photo.</Text>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map((photo) => <Image key={photo.uri} source={{ uri: photo.uri }} style={{ width: 140, height: 180, borderRadius: 16, backgroundColor: theme.surface2 }} />)}
              </ScrollView>
            ) : <Text style={{ color: theme.text2 }}>No event photo yet.</Text>}
          </View>
          <Button
            theme={theme}
            kind="ghost"
            icon="trash"
            label={`Delete ${person.display_name ?? 'this person'}`}
            onPress={() => {
              Alert.alert(`Delete ${person.display_name ?? 'this person'} and all notes about them?`, undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: `Delete ${person.display_name ?? 'person'}`, style: 'destructive', onPress: () => { repo.deletePerson(id); bump(); router.back(); } },
              ]);
            }}
          />
        </View>
      </ScrollView>
      <AiConfirm
        theme={theme}
        visible={ask != null}
        title={estimate.title}
        detail={estimate.detail}
        estimate={estimate.estimate}
        busy={busy}
        canRun={canRun}
        blocked="Add a Groq key in Settings. The recording stays on this phone, and Groq Whisper reads it."
        onCancel={() => setAsk(null)}
        onRun={() => void runAnalyse()}
      />
      <AiConfirm
        theme={theme}
        visible={followAsk}
        title={followEstimate.title}
        detail={followEstimate.detail}
        estimate={followEstimate.estimate}
        busy={followBusy}
        canRun={followCanRun}
        freeLabel="Find promises on this phone"
        onCancel={() => setFollowAsk(false)}
        onFree={() => showProposed(taskDrafts(heuristicNote(noteText)))}
        onRun={() => void runFollowups()}
      />
      <ActionChecklist
        theme={theme}
        visible={drafts != null}
        drafts={drafts ?? []}
        onChange={setDrafts}
        onClose={() => setDrafts(null)}
        onSave={saveFollowups}
      />
    </Screen>
  );
}
