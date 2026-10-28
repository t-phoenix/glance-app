import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { useApp } from '@/src/state/AppContext';
import { Button, Card, Field, Label, List, ListItem, MONO, Screen } from '@/src/ui/components';
import { getSecret, SECRET, setSecret } from '@/src/services/secrets';
import {
  addressFromKey,
  createWallet,
  isEthAddress,
  readEthBalance,
  readUsdcBalance,
  sendUsdc,
  shortAddress,
  usdcToUnits,
  walletReplaceAllowed,
} from '@/src/services/wallet';

async function confirm(prompt: string): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !enrolled) return true;
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false });
  return result.success;
}

export default function WalletScreen() {
  const { theme, repo, bump, showToast } = useApp();
  const [address, setAddress] = useState<string | null>(repo?.setting('wallet_address') || null);
  const [balance, setBalance] = useState<number | null>(Number(repo?.setting('wallet_balance') || '') || null);
  const [eth, setEth] = useState<number | null>(null);
  const [updated, setUpdated] = useState(repo?.setting('wallet_balance_at') ? 'Last saved' : 'Not yet');
  const [missingKey, setMissingKey] = useState(false);
  const [cap, setCap] = useState(repo?.setting('daily_cap', '2') ?? '2');
  const [importKey, setImportKey] = useState('');
  const [replacePhrase, setReplacePhrase] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const history = repo?.spendHistory() ?? [];
  const transfers = repo?.transfers() ?? [];

  async function load() {
    const key = await getSecret(SECRET.wallet);
    const remembered = repo?.setting('wallet_address') || '';
    if (!key?.startsWith('0x')) {
      setMissingKey(Boolean(remembered));
      setAddress(remembered || null);
      if (remembered) {
        try {
          const value = await readUsdcBalance(remembered);
          setBalance(value);
          repo?.setSetting('wallet_balance', String(value));
          setUpdated('Just now');
        } catch {
          showToast("Couldn't refresh balance. Showing the last saved amount.");
        }
      }
      return;
    }
    const next = addressFromKey(key as `0x${string}`);
    setAddress(next);
    setMissingKey(false);
    if (!remembered) repo?.setSetting('wallet_address', next);
    try {
      const value = await readUsdcBalance(next);
      setBalance(value);
      setUpdated('Just now');
      repo?.setSetting('wallet_balance', String(value));
      repo?.setSetting('wallet_balance_at', new Date().toISOString());
      if (!remembered || remembered.toLowerCase() === next.toLowerCase()) repo?.setSetting('wallet_address', next);
    } catch {
      showToast("Couldn't refresh balance. Showing the last saved amount.");
    }
    try {
      setEth(await readEthBalance(next));
    } catch {
      setEth(null);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Card theme={theme} tone="sea" style={{ backgroundColor: `${theme.sea}1A`, gap: 6, padding: 18 }}>
          <Label theme={theme} color={theme.linked}>USDC on Base · {updated}</Label>
          <Text accessibilityLabel={`${balance == null ? 'Unknown' : balance.toFixed(2)} USDC`} style={{ color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 52, letterSpacing: -1.5 }}>{balance == null ? '—' : balance.toFixed(2)}<Text style={{ fontSize: 20, color: theme.text2 }}> USDC</Text></Text>
          <Text selectable style={{ color: theme.text2, fontFamily: MONO, fontSize: 13 }}>{address ?? 'No wallet yet'}</Text>
          {eth != null ? <Text style={{ color: theme.text3, fontSize: 13 }}>{eth < 0.000002 ? 'No ETH for a network fee yet. A send needs a little ETH on Base.' : `${eth.toFixed(5)} ETH for network fees`}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {address ? <Button theme={theme} kind="light" size="small" icon="doc.on.doc" label="Copy address" style={{ flex: 1 }} onPress={() => { void Clipboard.setStringAsync(address); showToast('Address copied'); }} /> : null}
          {address && !missingKey ? <Button theme={theme} kind="secondary" size="small" icon="key" label="Key" accessibilityLabel="Copy the wallet key after Face ID" style={{ flex: 1 }} onPress={() => {
          void confirm('Show the wallet key').then(async (ok) => {
            if (!ok) return;
            const key = await getSecret(SECRET.wallet);
            if (!key) return;
            await Clipboard.setStringAsync(key);
            showToast('Key copied. Store it outside the phone.');
          });
        }} /> : null}
          </View>
        </Card>
        <Text style={{ color: theme.text3, fontSize: 14 }}>App updates keep this key. Glance does not create a second wallet.</Text>
        <Card theme={theme} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label theme={theme}>Spent today</Label>
            <Text style={{ color: theme.text, fontFamily: MONO, fontSize: 14 }}>${(repo?.spentToday() ?? 0).toFixed(2)} / ${Number(cap || 0).toFixed(2)}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.surface2, overflow: 'hidden' }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.butter, width: `${Math.min(100, Number(cap) > 0 ? ((repo?.spentToday() ?? 0) / Number(cap)) * 100 : 0)}%` }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Field theme={theme} value={cap} onChangeText={setCap} keyboardType="decimal-pad" placeholder="Daily cap" accessibilityLabel="Daily cap in USDC" style={{ flex: 1, backgroundColor: theme.surface2 }} />
            <Button theme={theme} kind="secondary" size="small" label="Set cap" onPress={() => {
              void confirm('Change the daily cap').then((ok) => {
                if (!ok) return;
                repo?.setSetting('daily_cap', cap);
                bump();
                showToast('Cap saved');
              });
            }} />
          </View>
        </Card>
        {missingKey ? <Text style={{ color: theme.warning, fontSize: 15, lineHeight: 21 }}>The address is saved, but the key is not on this phone. Import that same key. Creating a new wallet would be a different address.</Text> : null}
        {!address ? <Button theme={theme} icon="plus" label="Create a wallet" onPress={() => {
          void (async () => {
            const existing = await getSecret(SECRET.wallet);
            if (existing || repo?.setting('wallet_address')) {
              showToast('A wallet is already on this phone.');
              await load();
              return;
            }
            const wallet = createWallet();
            await setSecret(SECRET.wallet, wallet.privateKey);
            repo?.setSetting('wallet_address', wallet.address);
            bump();
            await load();
          })();
        }} /> : null}

        {address && !missingKey ? (
          <Card theme={theme} style={{ gap: 10 }}>
            <Label theme={theme}>Send USDC</Label>
            <Field theme={theme} value={to} onChangeText={setTo} autoCapitalize="none" placeholder="0x destination on Base" accessibilityLabel="Destination address" style={{ backgroundColor: theme.surface2, fontFamily: MONO, fontSize: 14 }} />
            <Field theme={theme} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount in USDC" accessibilityLabel="Amount to send" style={{ backgroundColor: theme.surface2 }} />
            <Button theme={theme} icon="paperplane.fill" label={sending ? 'Sending…' : 'Send'} disabled={sending} onPress={() => {
              if (sending) return;
              void (async () => {
                const units = usdcToUnits(amount);
                if (!isEthAddress(to)) { showToast('Paste a full 0x address.'); return; }
                if (!units) { showToast('Enter an amount like 0.25'); return; }
                if (balance != null && Number(amount) > balance + 0.000001) { showToast('That is more than the balance.'); return; }
                const key = await getSecret(SECRET.wallet);
                if (!key?.startsWith('0x') || !address) { showToast('The key is not on this phone.'); return; }
                if (addressFromKey(key as `0x${string}`).toLowerCase() !== address.toLowerCase() && repo?.setting('wallet_address')) {
                  showToast('The key does not match the saved address. Nothing was sent.');
                  return;
                }
                const ok = await confirm(`Send ${amount} USDC`);
                if (!ok) return;
                setSending(true);
                try {
                  const gas = await readEthBalance(address);
                  if (gas < 0.000002) {
                    showToast('Send a little ETH on Base to this same address first. It pays the network fee.');
                    return;
                  }
                  const hash = await sendUsdc(key as `0x${string}`, to, units);
                  repo?.recordTransfer(to, amount, hash, 'sent');
                  bump();
                  setAmount('');
                  setTo('');
                  showToast('Sent. The balance updates after Base confirms it.');
                  await load();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Send failed';
                  repo?.recordTransfer(to, amount, null, 'failed');
                  showToast(message.slice(0, 140));
                } finally {
                  setSending(false);
                }
              })();
            }} />
          </Card>
        ) : null}

        <Card theme={theme} tone="danger" style={{ gap: 10 }}>
          <Label theme={theme} color={theme.danger}>Replace wallet</Label>
          <Text style={{ color: theme.text2, fontSize: 14, lineHeight: 20 }}>Importing a different key leaves the USDC on the old address. Type REPLACE only if you mean to switch.</Text>
          <Field theme={theme} value={importKey} onChangeText={setImportKey} autoCapitalize="none" placeholder="0x private key" secureTextEntry accessibilityLabel="Import private key" style={{ backgroundColor: theme.surface2 }} />
          <Field theme={theme} value={replacePhrase} onChangeText={setReplacePhrase} autoCapitalize="characters" placeholder="REPLACE, only to switch wallets" accessibilityLabel="Type REPLACE to switch wallets" style={{ backgroundColor: theme.surface2 }} />
          <Button theme={theme} kind="secondary" icon="square.and.arrow.down" label="Import key" onPress={() => {
          void (async () => {
            if (!importKey.startsWith('0x') || importKey.length < 66) { showToast('Paste a 0x private key.'); return; }
            let next: string;
            try {
              next = addressFromKey(importKey as `0x${string}`);
            } catch {
              showToast('That key could not be read.');
              return;
            }
            const remembered = repo?.setting('wallet_address') || address;
            if (!walletReplaceAllowed(remembered, next, replacePhrase)) {
              showToast('That is a different wallet. Type REPLACE to switch.');
              return;
            }
            const ok = await confirm('Save this wallet key');
            if (!ok) return;
            await setSecret(SECRET.wallet, importKey);
            repo?.setSetting('wallet_address', next);
            setImportKey('');
            setReplacePhrase('');
            bump();
            await load();
            showToast('Wallet key saved');
          })();
        }} />
        </Card>

        <Label theme={theme}>Sends</Label>
        {transfers.length === 0 ? <Text style={{ color: theme.text3 }}>No sends yet.</Text> : (
          <List theme={theme}>
            {transfers.map((row, index) => (
              <ListItem key={row.id} theme={theme} icon="paperplane" tone={row.status === 'failed' ? 'danger' : 'harbor'} title={`${row.amount} USDC`} subtitle={`→ ${row.to_address ? shortAddress(row.to_address) : ''} · ${row.status}`} mono last={index === transfers.length - 1} />
            ))}
          </List>
        )}
        <Label theme={theme}>Lookup history</Label>
        {history.length === 0 ? <Text style={{ color: theme.text3 }}>No payments yet.</Text> : (
          <List theme={theme}>
            {history.map((row, index) => (
              <ListItem key={row.id} theme={theme} title={row.provider_id} subtitle={row.status} last={index === history.length - 1} trailing={<Text style={{ color: theme.text, fontFamily: MONO, fontSize: 14 }}>${row.usd.toFixed(2)}</Text>} />
            ))}
          </List>
        )}
      </ScrollView>
    </Screen>
  );
}
