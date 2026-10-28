# States, popups and edge cases

## 1. Feedback hierarchy

Use the lightest level that works. Never stack two popups; queue them instead.

| Level | Component | Use for | Lifetime | Haptic |
|---|---|---|---|---|
| 1 | **Inline** (under the field or row) | Validation, a row's job state | Until fixed | none |
| 2 | **Toast** (top, below the status bar) | Something done that needs no decision: "Saved", "Copied", "Verified" | 2.5 s, swipe to dismiss, undo when it can be undone | `success` / `warning` |
| 3 | **Banner** (under the header, persistent) | A condition that lasts: offline, captive Wi-Fi, low balance, backup failed | Until the condition clears | `warning` once |
| 4 | **Bottom sheet** | A decision: confirm a link, keep or drop, verify a conflict, unknown QR | Until you choose | `light` on open |
| 5 | **Alert dialog** | Destructive or irreversible actions only: delete a person, reset the wallet, wipe data | Until you choose | `error` |

Rules: toasts never carry a decision. Sheets always have a clear primary button (right or bottom) and a way out (swipe down or Cancel). Alerts name the action on the button ("Delete Priya", not "OK").

## 2. Screen states

Every screen implements all of these. A ✱ means the state doesn't apply.

| Screen | Empty | Loading | Partial | Success | Error | Offline |
|---|---|---|---|---|---|---|
| Today | "No one yet today. Tap Scan when you meet someone." + event card | Skeleton rows (≤ 300 ms, then real data) | Some rows "Enriching…" | List | Row-level error chip | Banner; capture still works |
| Scan | ✱ | Camera starting (black + spinner ≤ 1 s) | ✱ | Haptic + toast | Camera denied: explainer + "Open Settings" | Works (decoding is on the phone) |
| Identity | "No other accounts found yet" + Search button | Shimmer per platform row | Platforms load one by one | Lists | Per-platform "Couldn't reach X · Retry" | "Will search when online" |
| Capture | ✱ | ✱ | Recording | Saved toast | Mic denied: explainer; disk full: alert | Works |
| AI review | ✱ | "Transcribing… / Structuring…" step indicator | Transcript shown, fields pending | Fields filled | "AI failed · Retry · Type it instead" | "Queued, will run online" |
| People | "Your people will show here" | Skeleton | ✱ | List | ✱ (local data) | Works |
| Follow-ups | "No promises yet. Nice." | ✱ | ✱ | Grouped list | ✱ | Deep links still open the apps |
| Wallet | "No wallet yet · Create wallet" | Balance shimmer | Cached balance + "updated 4 min ago" | Live | "Couldn't load balance · Retry" (RPC fallback first) | Cached balance, greyed |
| Recap | "All clear for today" | ✱ | ✱ | Cards | ✱ | Works |

## 3. Entity states

**Person:** `stub` → `enriching` → `needs_review` → `kept` | `dropped` → (`archived` after 72 h if never kept) · `deleted`

**Handle:** `anchor` (scanned) · `suggested` (confidence high|medium|low) → `confirmed` | `rejected` · `pending_offline` (typed while offline, not verified yet) · `conflict` (what was fetched disagrees with what you typed)

**Job:** `queued` → `running` → `done` | `failed(retry n/5, next_at)` → `dead` (shown in the recap) · `blocked_offline` · `blocked_budget`

**Recording:** `idle` → `recording` → `saved` → `transcribing` → `transcribed` | `transcribe_failed`

**Network:** `online` · `offline` · `captive` (Wi-Fi with a login page) · `degraded` (probe slower than 3 s)

## 4. Edge cases

### Scan and capture
| # | Case | Handling |
|---|---|---|
| E1 | Same QR scanned twice within 10 s | Ignore the second; light haptic only |
| E2 | Scanning someone who's already saved | Sheet: "You met Priya at IBW Day 1 · Add new encounter / Open profile" |
| E3 | QR is a LinkedIn short link (`lnkd.in`) | Resolve the redirect with a HEAD request; if offline, store the raw value and resolve later |
| E4 | WhatsApp `wa.me/qr/<code>` (number hidden) | Store as a "WhatsApp link"; Open works; nothing to look up |
| E5 | QR is a payment, wallet-connect or `ethereum:` URI | Show as text with a "This looks like a payment request" warning; never open it |
| E6 | Badge photo is blurry or unreadable | Vision returns `confidence:low` → "Couldn't read · Retake / Type name" |
| E7 | Photo of several badges | One stub per badge; the stubs need your confirmation before saving |
| E8 | Camera or mic permission denied | Explainer screen with "Open Settings"; app usable without them |
| E9 | Recording interrupted by a phone call | Save what was recorded; toast "Recording saved (stopped by call)" |
| E10 | Recording reaches 120 s | Auto-stop at 120 s with a warning haptic at 110 s |
| E11 | Storage under 200 MB | Banner; audio switches to a lower bitrate; warn before recording |
| E12 | Location denied or no fix in 5 s | Save without GPS; event chosen from time only, or you pick it |
| E13 | Two events overlap in time and place | Pick the nearer one; the chip shows "1 of 2 · change" |
| E14 | Midnight after-party (event ends at 02:00) | Event windows can cross midnight; the recap day boundary is 04:00 IST |

### Identity
| # | Case | Handling |
|---|---|---|
| E15 | Handle no longer exists or is suspended | Handle state `gone`; keep stored data; show "Account not found on X" |
| E16 | Protected or private X account | Show the name and avatar if returned; bio hidden; no tweet signals |
| E17 | Telegram username changed | The old `t.me` page 404s → mark `gone`; prompt to rescan |
| E18 | Common name with no strong signals | List all candidates down to Low; never pre-select |
| E19 | Candidate is already confirmed for someone else | Show "Linked to Marco R." and block confirming it twice; offer Merge |
| E20 | The same person saved twice from two platforms | Suggest a merge (same name + company, or a shared confirmed link); you confirm |
| E21 | Unicode or emoji display names, RTL text | Store as is; search with NFKC normalisation; Hindi script is supported |
| E22 | LinkedIn login wall | Fall back to the paid provider; if the cap is reached, offer "paste the headline" |

### AI and providers
| # | Case | Handling |
|---|---|---|
| E23 | Transcript empty (only noise) | "Couldn't hear anything · Re-record / Type it" |
| E24 | AI returns invalid JSON | Retry once with a repair prompt, then save the transcript and mark `needs_review` |
| E25 | AI invents a name that isn't in the transcript | Every field must quote its transcript span; fields without one are dropped |
| E26 | Provider 429 rate limit | Back off using Retry-After; switch to the next provider in the chain |
| E27 | Provider down (5xx or timeout) | Circuit breaker opens for 10 min; next provider used |
| E28 | All providers fail | Job `dead`, shown in the recap with "Retry" and "Fill in by hand" |

### Wallet
| # | Case | Handling |
|---|---|---|
| E29 | Balance below the price | Job `blocked_budget`; banner "Wallet low · 0.04 USDC"; top-up sheet |
| E30 | Daily cap reached | `blocked_budget` until midnight IST, or you raise the cap (Face ID) |
| E31 | Payment rejected by the facilitator | Retry once after 2 s; then try the next provider; log the reason |
| E32 | Endpoint asks for more than its listed price | Abort (maxAmount guard); error W4 |
| E33 | Paid, but the request failed | Record as a "paid, failed" spend; show the tx hash; don't retry automatically |

### Device
| # | Case | Handling |
|---|---|---|
| E34 | App killed mid-job | Jobs stuck in `running` for more than 2 min go back to `queued` on launch |
| E35 | Free signing expired (day 7) | App won't open; data is kept. See install-on-iphone.md. |
| E36 | Backup fails (iCloud full or offline) | Banner the next morning; manual export still works |
| E37 | Low battery (under 20%) | Postpone transcription until charging, unless you tap "Transcribe now" |
| E38 | Clock or timezone change | Store UTC; show IST; events stored in IST |
