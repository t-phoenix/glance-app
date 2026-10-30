import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Card, Chip, Field, GlanceMark, Label, Pill, PlatformMark, Screen, SheetFrame, Title, platformName } from '@/src/ui/components';
import { ActionChecklist } from '@/src/ui/ActionChecklist';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { profileUrl } from '@/src/services/followupLinks';
import { heuristicNote, structureWithClaude } from '@/src/services/anthropic';
import { estimateFollowupCost, taskDrafts } from '@/src/services/notes';
import { getSecret, SECRET } from '@/src/services/secrets';
import { istDateKey } from '@/src/lib/time';
import type { ActionRow, ActionStatus, TaskDraft } from '@/src/db/repository';

const COLUMNS: { id: ActionStatus; label: string; empty: string }[] = [
  { id: 'open', label: 'Open', empty: 'Nothing you still owe.' },
  { id: 'waiting', label: 'Waiting', empty: 'Nobody owes you a task.' },
  { id: 'done', label: 'Done', empty: 'Nothing closed yet.' },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function FollowupsScreen() {
  const { theme, repo, revision, bump, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const [boardHeight, setBoardHeight] = useState(0);
  const [showEarlier, setShowEarlier] = useState(false);
  const [detail, setDetail] = useState<ActionRow | null>(null);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [addMode, setAddMode] = useState<null | 'people' | 'form' | 'confirm'>(null);
  const [query, setQuery] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [owner, setOwner] = useState<'me' | 'them'>('me');
  const [taskText, setTaskText] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [drafts, setDrafts] = useState<TaskDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [canRun, setCanRun] = useState(false);
  void revision;
  const today = istDateKey();
  const counts = {
    open: repo?.actions('open').length ?? 0,
    waiting: repo?.actions('waiting').length ?? 0,
    done: repo?.actions('done').length ?? 0,
  };

  function openDetail(action: ActionRow) {
    setDetail(action);
    setText(action.text);
    setDue(action.due ?? '');
  }

  function openAdd() {
    setDrafts(null);
    setQuery('');
    setPersonId(null);
    setOwner('me');
    setTaskText('');
    setTaskDue('');
    setBusy(false);
    setAddMode('people');
  }

  function closeAdd() {
    setAddMode(null);
    setQuery('');
    setPersonId(null);
    setOwner('me');
    setTaskText('');
    setTaskDue('');
    setDrafts(null);
    setBusy(false);
  }

  function notesFor(id: string): string {
    return (repo?.encounters(id) ?? []).map((encounter) => encounter.transcript?.trim() ?? '').filter((line) => line.length > 0).join('\n\n');
  }

  function saveDetail() {
    if (!repo || !detail) return;
    if (!text.trim()) {
      showToast('Write the task.');
      return;
    }
    if (due && !DATE.test(due)) {
      showToast('Use a date like 2026-11-02, or leave it blank.');
      return;
    }
    repo.updateAction(detail.id, { text, due: due || null });
    bump();
    setDetail(null);
  }

  function move(status: ActionStatus) {
    if (!repo || !detail) return;
    repo.setActionStatus(detail.id, status);
    setDetail({ ...detail, status, done_at: status === 'done' ? new Date().toISOString() : null });
    bump();
  }

  function saveManual() {
    if (!repo || !personId) return;
    if (!taskText.trim()) {
      showToast('Write the task.');
      return;
    }
    if (taskDue && !DATE.test(taskDue)) {
      showToast('Use a date like 2026-11-02, or leave it blank.');
      return;
    }
    repo.addAction({ personId, text: taskText, owner, due: taskDue || null });
    bump();
    closeAdd();
    showToast('Task added.');
  }

  async function beginRead() {
    if (!personId) return;
    const key = await getSecret(SECRET.anthropic);
    setCanRun(Boolean(key));
    setAddMode('confirm');
  }

  function showProposed(next: TaskDraft[]) {
    setBusy(false);
    if (!next.length) {
      setAddMode('form');
      showToast('No promises in these notes.');
      return;
    }
    setAddMode(null);
    setDrafts(next);
  }

  async function runRead() {
    if (!personId) return;
    const notes = notesFor(personId);
    const key = await getSecret(SECRET.anthropic);
    if (!key) return;
    setBusy(true);
    try {
      const note = await structureWithClaude(key, notes);
      showProposed(note ? taskDrafts(note) : []);
    } catch (error) {
      setBusy(false);
      showToast(error instanceof Error ? error.message : 'The read did not finish.');
    }
  }

  function saveChecked() {
    if (!repo || !personId || !drafts) return;
    const saved = repo.saveTasks(personId, drafts);
    bump();
    closeAdd();
    showToast(saved ? `Saved ${saved}.` : 'Nothing saved.');
  }

  const people = repo?.search(query) ?? [];
  const picked = personId ? repo?.person(personId) : null;
  const pickedNotes = personId ? notesFor(personId) : '';
  const followEstimate = estimateFollowupCost(pickedNotes);

  return (
    <Screen theme={theme}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Title theme={theme}>Follow-ups</Title>
          <Button theme={theme} kind="primary" size="small" icon="plus" label="Add task" onPress={openAdd} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {COLUMNS.map((column, index) => (
            <Chip
              key={column.id}
              theme={theme}
              label={column.label}
              count={counts[column.id]}
              tone={column.id === 'open' ? 'tide' : column.id === 'waiting' ? 'glacier' : 'sea'}
              active={page === index}
              onPress={() => {
                setPage(index);
                pager.current?.scrollTo({ x: index * width, animated: true });
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ flex: 1 }} onLayout={(event) => setBoardHeight(event.nativeEvent.layout.height)}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        style={{ height: boardHeight }}
        onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))}
      >
        {COLUMNS.map((column) => {
          const rows = repo?.actions(column.id) ?? [];
          const visible = column.id === 'done' ? rows.slice(0, 5) : rows;
          const earlier = column.id === 'done' ? rows.slice(5) : [];
          const shown = column.id === 'done' && showEarlier ? rows : visible;
          return (
            <ScrollView key={column.id} style={{ width, height: boardHeight }} contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }} keyboardShouldPersistTaps="handled">
              {rows.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 12, marginTop: 40 }}>
                  <GlanceMark size={72} color={theme.surface2} eye={theme.text3} />
                  <Text style={{ color: theme.text2, fontSize: 16 }}>{column.empty}</Text>
                </View>
              ) : null}
              {shown.map((action) => (
                <TaskCard key={action.id} action={action} today={today} onOpen={() => openDetail(action)} />
              ))}
              {earlier.length > 0 && !showEarlier ? (
                <Button theme={theme} kind="secondary" label={`Earlier · ${earlier.length}`} onPress={() => setShowEarlier(true)} />
              ) : null}
            </ScrollView>
          );
        })}
      </ScrollView>
      </View>

      <Modal visible={detail != null} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <SheetFrame theme={theme} onClose={() => setDetail(null)}>
            <ScrollView style={{ maxHeight: height * 0.62 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
              <Text style={{ color: theme.text, fontSize: 26, fontFamily: 'BricolageGrotesque_700Bold' }}>Task</Text>
              <Field theme={theme} value={text} multiline onChangeText={setText} style={{ backgroundColor: theme.surface2 }} />
              <Label theme={theme}>Due date</Label>
              <Field theme={theme} value={due} onChangeText={setDue} placeholder="2026-11-02" autoCapitalize="none" style={{ backgroundColor: theme.surface2 }} />
              <Label theme={theme}>Column</Label>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {COLUMNS.map((column) => (
                  <Chip key={column.id} theme={theme} label={column.label} tone={column.id === 'open' ? 'tide' : column.id === 'waiting' ? 'glacier' : 'sea'} active={detail?.status === column.id} onPress={() => move(column.id)} />
                ))}
              </View>
              {detail ? <AccountLinks personId={detail.person_id} draft={detail.draft || text} /> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button theme={theme} kind="danger" label="Drop" onPress={() => { if (!repo || !detail) return; repo.dismissAction(detail.id); bump(); setDetail(null); showToast('Dropped.'); }} style={{ flex: 1 }} />
                <Button theme={theme} label="Save" onPress={saveDetail} style={{ flex: 1.4 }} />
              </View>
            </ScrollView>
          </SheetFrame>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={addMode === 'people' || addMode === 'form'} transparent animationType="slide" onRequestClose={closeAdd}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <SheetFrame theme={theme} onClose={closeAdd}>
            {addMode === 'people' ? (
              <>
                <Text style={{ color: theme.text, fontSize: 26, fontFamily: 'BricolageGrotesque_700Bold' }}>Who is this for?</Text>
                <Field theme={theme} value={query} onChangeText={setQuery} placeholder="Search people" autoCapitalize="none" style={{ backgroundColor: theme.surface2 }} />
                <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                  {people.length === 0 ? <Text style={{ color: theme.text2, fontSize: 16, paddingVertical: 12 }}>No one matches.</Text> : null}
                  {people.map((person) => (
                    <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={person.display_name || 'Unknown'} onPress={() => { setPersonId(person.id); setAddMode('form'); }} style={{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.border }}>
                      <Text style={{ color: theme.text, fontSize: 17 }}>{person.display_name || 'Unknown'}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <ScrollView style={{ maxHeight: height * 0.62 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
                <Text style={{ color: theme.text, fontSize: 26, fontFamily: 'BricolageGrotesque_700Bold' }}>{picked?.display_name || 'Add task'}</Text>
                <Field theme={theme} value={taskText} onChangeText={setTaskText} placeholder="What was promised" multiline style={{ backgroundColor: theme.surface2 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip theme={theme} label="I owe it" tone="tide" active={owner === 'me'} onPress={() => setOwner('me')} />
                  <Chip theme={theme} label="They owe it" tone="glacier" active={owner === 'them'} onPress={() => setOwner('them')} />
                </View>
                <Field theme={theme} value={taskDue} onChangeText={setTaskDue} placeholder="Due date, optional" autoCapitalize="none" style={{ backgroundColor: theme.surface2 }} />
                <Button theme={theme} label="Save task" onPress={saveManual} />
                {pickedNotes ? <Button theme={theme} kind="ai" icon="sparkles" label="Read their notes" onPress={() => void beginRead()} /> : null}
              </ScrollView>
            )}
          </SheetFrame>
        </KeyboardAvoidingView>
      </Modal>

      <AiConfirm
        theme={theme}
        visible={addMode === 'confirm'}
        title={followEstimate.title}
        detail={followEstimate.detail}
        estimate={followEstimate.estimate}
        busy={busy}
        canRun={canRun}
        freeLabel="Find promises on this phone"
        onCancel={() => setAddMode('form')}
        onFree={() => showProposed(taskDrafts(heuristicNote(pickedNotes)))}
        onRun={() => void runRead()}
      />
      <ActionChecklist theme={theme} visible={drafts != null} drafts={drafts ?? []} onChange={setDrafts} onClose={() => { setDrafts(null); if (personId) setAddMode('form'); }} onSave={saveChecked} />
    </Screen>
  );
}

function AccountLinks({ personId, draft }: { personId: string; draft: string }) {
  const { theme, repo, showToast } = useApp();
  const linked = (repo?.handles(personId) ?? []).filter((handle) => (handle.status === 'anchor' || handle.status === 'confirmed') && handle.platform !== 'web');
  if (!linked.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {linked.map((handle) => {
        const label = handle.platform === 'whatsapp' ? handle.value : `@${handle.value}`;
        return (
          <Pressable
            key={handle.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${platformName(handle.platform)} for ${label}`}
            onPress={() => {
              if (draft.trim()) void Clipboard.setStringAsync(draft);
              const url = handle.url || profileUrl(handle.platform, handle.value);
              if (url) void Linking.openURL(url);
              showToast(draft.trim() ? 'Draft copied. Write the message there.' : 'Opened.');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 16, paddingLeft: 4, paddingRight: 10, minHeight: 36 }}
          >
            <PlatformMark platform={handle.platform} size={26} />
            <Text style={{ color: theme.text, fontSize: 13 }} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TaskCard({ action, today, onOpen }: { action: ActionRow; today: string; onOpen: () => void }) {
  const { theme, repo } = useApp();
  const person = repo?.person(action.person_id);
  const card = repo?.listContext([action.person_id]).get(action.person_id);
  const overdue = action.status === 'open' && !!action.due && action.due < today;
  const tone = overdue ? 'butter' : action.status === 'waiting' ? 'glacier' : action.status === 'done' ? 'sea' : 'tide';
  const pill = overdue ? 'Overdue' : action.status === 'waiting' ? 'Waiting' : action.status === 'done' ? 'Done' : 'Open';
  return (
    <Card theme={theme} tone={tone} onPress={onOpen} accessibilityLabel={action.text}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${person?.display_name || 'person'}`} onPress={() => router.push({ pathname: '/person/[id]', params: { id: action.person_id } })} hitSlop={6}>
          <Avatar theme={theme} uri={card?.face} name={person?.display_name || 'Unknown'} size={44} ring={card?.platform ? 'confirmed' : undefined} />
        </Pressable>
        <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${person?.display_name || 'person'}`} onPress={() => router.push({ pathname: '/person/[id]', params: { id: action.person_id } })}>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }} numberOfLines={1}>{person?.display_name || 'Unknown'}</Text>
          {action.due ? <Text style={{ color: overdue ? theme.butter : theme.text3, fontSize: 13 }}>{action.due}</Text> : null}
        </Pressable>
        <Pill theme={theme} tone={tone} label={pill} />
      </View>
      <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22 }} numberOfLines={2}>{action.text}</Text>
      {action.draft ? <Text style={{ color: theme.text2, fontSize: 15, lineHeight: 21 }} numberOfLines={1}>{action.draft}</Text> : null}
      <AccountLinks personId={action.person_id} draft={action.draft || action.text} />
    </Card>
  );
}
