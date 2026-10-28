import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { readEventTags, tagDisplayColor, TAG_COLORS, type EventTag } from '@/src/data/weekTags';
import { Button, Field, Icon, Label, SheetFrame } from '@/src/ui/components';
import { useApp } from '@/src/state/AppContext';
import type { Theme } from '@/src/ui/theme';

export function EventTags({
  theme,
  value,
  onChange,
}: {
  theme: Theme;
  value: string | null;
  onChange: (tag: string) => void;
}) {
  const { repo, bump } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0] ?? '#9CC3FF');
  const tags = readEventTags(repo?.setting('event_tags', ''));
  const shown = value && !tags.some((tag) => tag.name === value) ? [...tags, { name: value, color: '#8796A8' }] : tags;

  function save(next: EventTag[]) {
    repo?.setSetting('event_tags', JSON.stringify(next));
    bump();
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label theme={theme}>Event</Label>
        <Pressable accessibilityLabel="Edit event tags" onPress={() => setOpen(true)} hitSlop={6} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: theme.surface2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="pencil" color={theme.link} size={14} />
          <Text style={{ color: theme.link, fontSize: 14, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {shown.map((tag) => {
          const active = value === tag.name;
          const color = tagDisplayColor(tag.color);
          return (
            <Pressable key={tag.name} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={tag.name} onPress={() => onChange(tag.name)} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: active ? color : `${color}66`, backgroundColor: active ? color : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? theme.onColor : color }} />
              <Text style={{ color: active ? theme.onColor : theme.text, fontSize: 14, fontWeight: '600' }}>{tag.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <SheetFrame theme={theme} onClose={() => setOpen(false)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.text, fontSize: 24, fontFamily: 'BricolageGrotesque_700Bold' }}>Event tags</Text>
              <Pressable accessibilityLabel="Close tag editor" onPress={() => setOpen(false)} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: theme.link, fontSize: 17, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            {tags.map((tag) => (
              <View key={tag.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tagDisplayColor(tag.color) }} />
                <Text style={{ color: theme.text, flex: 1 }}>{tag.name}</Text>
                <Pressable accessibilityLabel={`Delete ${tag.name}`} onPress={() => save(tags.filter((item) => item.name !== tag.name))} hitSlop={8}>
                  <Icon name="trash" color={theme.danger} size={18} />
                </Pressable>
              </View>
            ))}
            <Field theme={theme} value={name} onChangeText={setName} placeholder="New tag" accessibilityLabel="New tag name" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TAG_COLORS.map((swatch) => (
                <Pressable key={swatch} accessibilityLabel={`Color ${swatch}`} accessibilityState={{ selected: color === swatch }} onPress={() => setColor(swatch)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: swatch, borderWidth: color === swatch ? 3 : 0, borderColor: theme.text }} />
              ))}
            </View>
            <Button
              theme={theme}
              label="Add tag"
              icon="plus"
              onPress={() => {
                const nextName = name.trim();
                if (!nextName || tags.some((tag) => tag.name.toLowerCase() === nextName.toLowerCase())) return;
                save([...tags, { name: nextName, color }]);
                setName('');
              }}
            />
        </SheetFrame>
      </Modal>
    </View>
  );
}
