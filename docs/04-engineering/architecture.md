# Architecture

## Principles

1. **Capture is local and synchronous.** Scanning, the photo and the voice note write to SQLite and files before anything touches the network.
2. **Everything slow is a job.** Lookups, transcription, AI and payments go into a persistent queue with retries.
3. **Every external call goes through a provider chain** with timeouts, a circuit breaker, a spend check and a fallback.
4. **The UI reads from the database, not from network responses.** Screens subscribe to queries; jobs update rows; the UI re-renders. This is how offline and online look the same.
5. **No backend.** Keys live in the Keychain. A personal sideloaded app is the trust boundary.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| App | Expo SDK (latest stable) + `expo-dev-client` + Expo Router | Needs a dev build because whisper.rn is a native module |
| Language | TypeScript strict | |
| State | SQLite as the source of truth + `@tanstack/react-query` for reactive reads + `zustand` for UI-only state | No Redux |
| DB | `expo-sqlite` (WAL mode, FTS5) + `drizzle-orm` for typed queries and migrations | |
| Files | `expo-file-system` under `documentDirectory/media/{personId}/` | Photos are compressed to 1600 px JPEG at quality 0.8 |
| Camera / QR | `expo-camera` (`CameraView` with `barcodeScannerSettings: { barcodeTypes: ['qr'] }`) | |
| Audio | `expo-audio`, AAC 32 kbps mono 16 kHz | Background audio mode in `app.json` |
| Transcription | `whisper.rn` with `ggml-small` (multilingual, quantised) | Model bundled or downloaded on first launch over Wi-Fi |
| Location | `expo-location`, one reading per capture, `Accuracy.Balanced`, 5 s timeout | |
| Network status | `@react-native-community/netinfo` + our own probe | See offline.md |
| Secrets | `expo-secure-store` (Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | API keys and the wallet private key |
| Auth lock | `expo-local-authentication` | Face ID |
| Wallet / x402 | `viem` (local account, Base) + `@x402/fetch` (x402 v2) + `react-native-get-random-values` polyfill | Check the package works under Hermes on day 1; fallback: implement EIP-3009 signing directly with viem (about 60 lines) |
| Notifications | `expo-notifications` (local only) | |
| Icons | `expo-symbols` (SF Symbols) | Native, crisp, supports Dynamic Type |
| Haptics | `expo-haptics` | |
| Backup | `expo-file-system` + `expo-sharing`; AES-GCM with a key in the Keychain (`react-native-quick-crypto`) | |
| Tests | Jest + `@testing-library/react-native` + `msw` · Maestro for E2E | See test-plan.md |

## Module layout

```
app/                      # Expo Router screens
  (tabs)/today.tsx  people.tsx  followups.tsx  me.tsx
  scan.tsx  capture/[personId].tsx  review/[encounterId].tsx
  person/[id].tsx  identity/[personId].tsx  compare.tsx
  huddle/[id].tsx  recap.tsx  wallet.tsx  settings.tsx
src/
  db/            schema.ts  migrations/  queries/
  services/      # see services.md: one folder per service
  providers/     # one adapter per external API + chains.ts
  parsers/       qr.ts  vcard.ts  jwt.ts  handles.ts
  ai/            prompts/  schemas.ts  structure.ts  split.ts
  ui/            tokens.ts  components/  feedback/ (toast, banner, sheet)
  lib/           result.ts  errors.ts  time.ts  retry.ts
tests/           unit/  integration/  e2e/ (Maestro yaml)
scripts/         health-check.ts  seed-events.ts
```

## Data flow (one scan)

```
CameraView → parsers/qr.classify(raw) → CaptureService.saveStub()   [SQLite, <50 ms]
          → Toast "Saved" + haptic
          → QueueService.enqueue(enrich_anchor, find_related)
NetworkMonitor online? → QueueService.run() → IdentityResolver → ProviderChain(x) → rows updated
UI (react-query on SQLite) re-renders the "Enriching…" row → "Needs review"
```

## AI contract

The model is `claude-haiku-5-5` for structuring and splitting, and `claude-sonnet-5-5` for vision when Haiku's confidence is low. Calls use tool use with a strict JSON schema:

```json
{
  "person": { "name": "", "role": "", "company": "", "what_they_do": "" },
  "topics": [""], "they_need": [""], "can_help_me_with": [""],
  "actions": [{ "text": "", "owner": "me|them", "due": "YYYY-MM-DD|null", "channel": "telegram|x|linkedin|whatsapp|email|null" }],
  "tags": [""],
  "evidence": { "<field path>": "<exact transcript quote>" },
  "draft_followup": ""
}
```

Any field without an `evidence` quote is dropped (edge case E25). Prompts live in `src/ai/prompts/*.md` and are versioned.
