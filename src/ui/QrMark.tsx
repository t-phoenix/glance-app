import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { create } from 'qrcode';

// memo: building the grid is ~1,000 Views, so only rebuild when the link or colors change
export const QrMark = memo(function QrMark({ value, color, background }: { value: string; color: string; background: string }) {
  const qr = useMemo(() => create(value, { errorCorrectionLevel: 'M' }), [value]);
  const size = qr.modules.size;
  const cell = Math.max(3, Math.floor(220 / size));
  const rows = [];
  for (let y = 0; y < size; y++) {
    const cols = [];
    for (let x = 0; x < size; x++) {
      cols.push(<View key={x} style={{ width: cell, height: cell, backgroundColor: qr.modules.get(y, x) ? color : background }} />);
    }
    rows.push(<View key={y} style={{ flexDirection: 'row' }}>{cols}</View>);
  }
  return <View style={{ alignSelf: 'center', padding: 12, backgroundColor: background }}>{rows}</View>;
});
