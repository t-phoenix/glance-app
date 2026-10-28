# Internal services

The app has no server. These on-device services keep it running smoothly. Each one is a plain TypeScript module with one responsibility, returns `Result<T, AppError>` (never throws across a boundary), and is covered by tests.

```ts
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
interface AppError { code: ErrorCode; message: string; retryable: boolean; cause?: unknown } // see error-catalog.md
```

| Service | Responsibility | Depends on |
|---|---|---|
| **CaptureService** | Save stubs, encounters, photos, audio and huddles synchronously; never touches the network | db, MediaStore, LocationService, EventMatcher |
| **MediaStore** | Write, compress and delete files under `media/`; reports disk space | expo-file-system |
| **LocationService** | One location reading with a 5 s timeout; cached for 60 s | expo-location |
| **EventMatcher** | `(time, lat, lng) → Event[]` ranked by time overlap and distance | db.events |
| **NetworkMonitor** | Online, offline, captive or degraded status; emits changes; `reportFailure()` lets any fetch mark the app offline immediately | netinfo, probe |
| **QueueService** | Persistent jobs: priority, backoff (2 s × 2ⁿ, max 5 attempts, jitter), concurrency of 3, pauses offline, recovers stuck jobs | db.jobs, NetworkMonitor |
| **ProviderRegistry** | Holds the provider chains, circuit breakers and health status; `call(need, input)` tries each provider in order | providers/*, SpendGuard |
| **SpendGuard** | Checks price ≤ maxAmount, today's spend + price ≤ daily cap, and balance ≥ price; records every spend | db.spend, WalletService |
| **WalletService** | Create or import a key, show the address, read the balance (RPC chain), make x402 calls, keep history | viem, secure-store |
| **IdentityResolver** | Anchor fetch → free cross-links → candidate search → scoring → write `handle` rows as `suggested` | ProviderRegistry, Scorer |
| **Scorer** | A pure function: candidate + context → `{level, score, evidence[]}` | — |
| **TranscriptionService** | whisper.rn → cloud fallback → `failed`; postpones when battery is under 20% | whisper.rn, ProviderRegistry |
| **AIService** | Structure, split a group note, read a badge, draft messages, compare avatars; validates the schema; one repair retry | ProviderRegistry (anthropic) |
| **FollowUpService** | Build deep links, copy drafts, mark actions done, schedule reminders | expo-linking, notifications |
| **NotificationService** | Nightly recap at 23:00 IST, due reminders, the 2-minute nudge; respects quiet hours | expo-notifications |
| **BackupService** | Nightly encrypted export (db + media manifest) to iCloud Drive; manual export; restore | quick-crypto, file-system |
| **SearchService** | FTS5 query builder with filters (event, tag, has-todo) | db |
| **FeedbackBus** | One queue for toasts, banners and sheets so they never stack; maps `AppError` to UI | ui/feedback |
| **HealthCheck** | Calls every provider with a known sample; stores `provider_health`; runs on launch (once a day) and from Settings | ProviderRegistry |

## Key interfaces

```ts
// providers/types.ts
interface Provider<I, O> {
  id: string;                    // 'twitterapi.user_info'
  need: Need;                    // 'x.profile' | 'linkedin.profile' | ...
  cost: { usd: number; paid: boolean };
  timeoutMs: number;             // default 8000
  call(input: I, ctx: CallCtx): Promise<Result<O>>;
  sample: I;                     // used by HealthCheck
}

// services/registry.ts
call<N extends Need>(need: N, input: InputOf<N>, opts?: { allowPaid?: boolean }): Promise<Result<OutputOf<N>>>
// tries providers in chain order; skips ones whose circuit is open; asks SpendGuard before paid ones;
// returns the first ok; otherwise a combined error listing each provider's failure.

// services/queue.ts
enqueue(kind: JobKind, refId: string, opts?: { priority?: 0|1|2; requires?: 'network'|'charging' }): void
```

## Job kinds and priority

| Kind | Priority | Needs | Paid? |
|---|---|---|---|
| `decode_badge` | 0 | network | no (Anthropic key) |
| `enrich_anchor` | 0 | network | free first |
| `transcribe` | 1 | — (on device) | no |
| `structure_note` / `split_huddle` | 1 | network | no |
| `find_related` | 2 | network | only if ★ or mentioned (D13) |
| `avatar_compare` | 2 | network | no |
| `reverse_avatar` | 2 | network + you asked | $0.20 |
| `verify_offline` | 0 | network | free first |
