import { Modal, Text, View } from 'react-native';
import { Button, Icon, MONO, SheetFrame } from '@/src/ui/components';
import type { Theme } from '@/src/ui/theme';

export function AiConfirm({
  theme,
  visible,
  title,
  detail,
  estimate,
  busy,
  canRun,
  onCancel,
  onRun,
  onFree,
  runLabel,
  blocked,
}: {
  theme: Theme;
  visible: boolean;
  title: string;
  detail: string;
  estimate: string;
  busy?: boolean;
  canRun: boolean;
  onCancel: () => void;
  onRun: () => void;
  onFree?: () => void;
  runLabel?: string;
  blocked?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <SheetFrame theme={theme} onClose={busy ? undefined : onCancel}>
        <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: theme.dusk, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" color={theme.onColor} size={28} />
        </View>
        <Text style={{ color: theme.text, fontSize: 26, fontFamily: 'BricolageGrotesque_700Bold', letterSpacing: -0.4 }}>{title}</Text>
        <Text style={{ color: theme.text2, fontSize: 16, lineHeight: 23 }}>{detail}</Text>
        <View style={{ backgroundColor: theme.surface2, borderRadius: 16, paddingHorizontal: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text2, fontSize: 15 }}>Cost</Text>
          <Text style={{ color: theme.text, fontFamily: MONO, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{estimate}</Text>
        </View>
        {!canRun ? <Text style={{ color: theme.warning, fontSize: 15, lineHeight: 21 }}>{blocked ?? 'Add an Anthropic key in Settings to run this. The free split stays on this phone.'}</Text> : null}
        {onFree ? <Button theme={theme} kind="secondary" label="Split into bullets on this phone" disabled={busy} onPress={onFree} /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button theme={theme} kind="secondary" label="Not now" disabled={busy} onPress={onCancel} style={{ flex: 1 }} />
          <Button theme={theme} kind="ai" icon="sparkles" label={busy ? 'Running…' : (runLabel ?? 'Run AI')} disabled={!canRun || busy} onPress={onRun} style={{ flex: 1.4 }} />
        </View>
      </SheetFrame>
    </Modal>
  );
}
