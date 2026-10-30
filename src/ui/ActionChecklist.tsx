import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { TaskDraft } from '@/src/db/repository';
import { Button, Field, SheetFrame } from '@/src/ui/components';
import type { Theme } from '@/src/ui/theme';

export function ActionChecklist({
  theme,
  visible,
  drafts,
  onChange,
  onClose,
  onSave,
}: {
  theme: Theme;
  visible: boolean;
  drafts: TaskDraft[];
  onChange: (drafts: TaskDraft[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const kept = drafts.filter((draft) => draft.keep && draft.text.trim()).length;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetFrame theme={theme} onClose={onClose}>
        <Text style={{ color: theme.text, fontSize: 26, fontFamily: 'BricolageGrotesque_700Bold', letterSpacing: -0.4 }}>Keep the tasks you want</Text>
        <Text style={{ color: theme.text2, fontSize: 16, lineHeight: 22 }}>Each row starts on. Turn one off, or rewrite it, before it lands on the board.</Text>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          {drafts.map((draft, index) => (
            <View key={`${index}-${draft.owner}`} style={{ backgroundColor: theme.surface2, borderRadius: 18, padding: 12, gap: 10 }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.keep }}
                accessibilityLabel={draft.keep ? 'Keep this task' : 'Drop this task'}
                onPress={() => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, keep: !item.keep } : item))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: draft.keep ? theme.tide : 'transparent', borderWidth: draft.keep ? 0 : 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                  {draft.keep ? <Text style={{ color: theme.onColor, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <Text style={{ color: theme.text2, fontSize: 14, flex: 1 }}>{draft.owner === 'them' ? 'They owe this' : 'You owe this'}{draft.due ? ` · ${draft.due}` : ''}</Text>
              </Pressable>
              <Field
                theme={theme}
                value={draft.text}
                multiline
                onChangeText={(text) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item))}
                style={{ backgroundColor: theme.surface1 }}
              />
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button theme={theme} kind="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
          <Button theme={theme} label={kept ? `Save ${kept}` : 'Save none'} onPress={onSave} style={{ flex: 1.4 }} />
        </View>
      </SheetFrame>
    </Modal>
  );
}
