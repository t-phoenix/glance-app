# Test plan

| Layer | Tool | Runs | Gate |
|---|---|---|---|
| Unit | Jest | every save (watch) + before each device install | must pass |
| Integration | Jest + `msw` (fake providers) + in-memory SQLite (`better-sqlite3` in Node) | before each device install | must pass |
| E2E | Maestro on the iOS Simulator; camera input injected with the `recall://debug/scan?payload=` deep link (dev builds only) | Oct 29 onward, nightly | P0 flows must pass |
| Device | Manual checklist on the iPhone 13 | Oct 30–31 field test | all P0 ✅ |
| Live providers | `scripts/health-check.ts` | daily + at the venue | logged |

Coverage target: 90% on `parsers/`, `services/scorer`, `services/spendGuard`, `services/queue` and `offline/verify`. UI code is covered by E2E rather than percentage targets.

## Unit tests

### Parsers (`parsers/qr.ts`)
| ID | Input | Expected |
|---|---|---|
| U-QR-01 | `https://www.linkedin.com/in/priya-s-123/` | `{kind:'linkedin', value:'priya-s-123'}` |
| U-QR-02 | `https://lnkd.in/abc` | `{kind:'shortlink', needsResolve:true}` |
| U-QR-03 | `https://x.com/priyabuilds?s=21` / `twitter.com/...` | `{kind:'x', value:'priyabuilds'}` (query stripped, lowercase compare) |
| U-QR-04 | `https://t.me/priya_zk` and `tg://resolve?domain=priya_zk` | `{kind:'telegram', value:'priya_zk'}` |
| U-QR-05 | `https://wa.me/919812345678` | `{kind:'whatsapp', value:'+919812345678'}` |
| U-QR-06 | `https://wa.me/qr/ABCDEF` | `{kind:'whatsapp_link', opaque:true}` |
| U-QR-07 | vCard 3.0 with FN, ORG, EMAIL, X-SOCIALPROFILE | fields extracted; socials become handles |
| U-QR-08 | `MECARD:N:Sharma,Priya;EMAIL:p@x.io;;` | name + email |
| U-QR-09 | JWT with `{name, email}` payload | decoded, `verified:false` |
| U-QR-10 | `0x` + 40 hex · `priya.eth` | `{kind:'address'}` · `{kind:'ens'}` |
| U-QR-11 | `ethereum:0x..@8453/transfer?...` · `wc:...` | `{kind:'payment', unsafe:true}` |
| U-QR-12 | `https://devcon.org/ticket/karan/x7f2k` | `{kind:'devcon_ticket', name:'karan'}` |
| U-QR-13 | `A7F2-99X1` | `{kind:'opaque'}` |
| U-QR-14 | Empty, 10 KB string, binary junk | `{kind:'invalid'}` without throwing |

### Handle validation (`parsers/handles.ts`)
U-H-01 to 12: valid and invalid examples per platform, using the regexes in offline.md, including edge cases like a leading `@`, too long, a Telegram handle starting with a digit, and E.164 without `+`.

### Scorer
| ID | Case | Expected |
|---|---|---|
| U-S-01 | Linked from a confirmed profile's bio | high |
| U-S-02 | Posted about IBW this week + name match | high |
| U-S-03 | Same full name + same company domain | medium |
| U-S-04 | Avatar "looks similar" only | medium at most |
| U-S-05 | Name match only | low (listed, not pre-selected) |
| U-S-06 | Account already confirmed for another person | flagged `I1`, not suggested |
| U-S-07 | Previously rejected for this person | excluded |

### Queue / SpendGuard / EventMatcher / verify
| ID | Case | Expected |
|---|---|---|
| U-Q-01 | Retryable failure | tries+1, next_at = 2 s × 2ⁿ ± jitter; `dead` after 5 |
| U-Q-02 | Job stuck in `running` > 2 min at launch | back to `queued` |
| U-Q-03 | Offline | network jobs → `blocked_offline`; on-device ones still run |
| U-G-01 | price 0.06, spent 1.96, cap 2.00 | blocked W2 |
| U-G-02 | balance 0.04 < 0.06 | blocked W1 |
| U-G-03 | asked 0.40 vs listed 0.06 | W4 |
| U-E-01 | Time inside one event, GPS within 300 m | that event |
| U-E-02 | Two overlapping events | nearer first, both returned |
| U-E-03 | 01:30 at an event ending 02:00 | matched (crosses midnight) |
| U-V-01 | Typed "Priya" vs fetched "Priya Sharma" | match (Jaro-Winkler ≥ 0.85 on the first token) |
| U-V-02 | Typed "Priya" vs "Pratik S." | conflict I2 |
| U-V-03 | Handle 404 | `gone`, P4 |

### AI output
U-AI-01 schema validation rejects missing `evidence` · U-AI-02 drops a field whose quote isn't in the transcript · U-AI-03 repair-retry once on invalid JSON · U-AI-04 group split: every segment maps to an existing stub id, or to `unmatched`.

## Integration tests (msw)

| ID | Scenario | Expected |
|---|---|---|
| I-01 | twitterapi.io 500 ×3 | breaker opens; stablesocial used; logged |
| I-02 | twitterapi.io 403 | P3 banner; chain **not** advanced to paid automatically |
| I-03 | stablesocial 402 → pay → 200 | spend row `paid`, tx hash stored |
| I-04 | 402 → pay → 402 (rejected) | W5, retry once, next provider |
| I-05 | 402 → pay → 500 | W6 `paid_failed`, no retry |
| I-06 | Offline during scan | stub saved; job `blocked_offline`; resumes after 2 good probes |
| I-07 | Captive portal (200 HTML on probe) | N2 banner |
| I-08 | Offline capture → online verify with a conflict | I2 sheet data prepared; one summary sheet |
| I-09 | Rush: 5 stubs + group note | split assigns 4; 1 flagged unmentioned; paid jobs only for ★/mentioned |
| I-10 | Delete person | rows cascade; media files removed; FTS row removed |
| I-11 | Backup → wipe → restore | identical row counts and file hashes |

## E2E (Maestro)

| ID | Flow | Steps |
|---|---|---|
| E-01 | One-on-one | deep-link scan of a Telegram URL → photo skip → record 5 s (test audio) → review → save → appears in Today |
| E-02 | Rush | long-press Scan → 4 deep-link scans → ★ one → end huddle → note → split sheet → drop 1 |
| E-03 | Offline | toggle network off (`xcrun simctl` network conditioner) → scan → offline form validation errors → save → network on → summary sheet |
| E-04 | Confirm identity | open probable accounts → Low row visible, unchecked → compare → confirm → Linked |
| E-05 | Follow-up | Follow-ups → Copy & open → back → "Sent?" → done |
| E-06 | Wallet | open wallet → balance shown (mock RPC) → cap to $0.05 → paid lookup blocked W2 |
| E-07 | Unsafe QR | deep-link `ethereum:` payload → Q1 sheet, no navigation |
| E-08 | Lock | background 5 min → foreground → Face ID screen |

## Field test (Oct 30–31, iPhone 13)

- [ ] Scan real QR codes from 10 friends: LinkedIn, X, Telegram and WhatsApp apps (their own QR screens)
- [ ] Group of 4 in rush mode, one note, split correct
- [ ] Airplane mode for 30 min of capture, then online: everything verifies
- [ ] Hinglish 60 s note: transcript readable, actions right
- [ ] Battery: 3 hours of use from 100% leaves ≥ 50%
- [ ] Each provider used live at least once; health-check all green or with a fallback
- [ ] Wallet: top up $20, run 5 paid lookups, history matches BaseScan
- [ ] Backup to iCloud Drive, delete the app, reinstall, restore
- [ ] Reinstall over the existing app keeps the data (needed for the day-7 re-sign)
