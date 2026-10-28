# Recall PRD v1.0

**Owner:** Abhinil · **Users:** one (you) · **Ship:** Oct 31, 2026 · **Used:** Nov 1–9, 2026 (IBW, Devcon, ETHGlobal, side events)

## 1. Problem

Meeting 50 to 150 people in a week in loud rooms, mostly through X and Telegram handles that aren't real names, means that a week later you can't remember who someone was, what you discussed, or what you promised. Existing apps (Convu, ConnectMachine, RELOS) solve this for LinkedIn and business cards, but not for pseudonymous crypto identities or for meeting people in groups.

## 2. Goals and success measures

| Goal | Measure | Target |
|---|---|---|
| Fast capture | Time from opening the app to a saved stub | ≤ 5 s (scan) · ≤ 20 s (scan + photo + note) |
| Nobody lost | People met who are in Recall by end of day | ≥ 90% |
| Right identity | Confirmed links that turn out wrong | 0 (all confirmed by you) |
| Follow-through | Action items done or dismissed within 14 days | ≥ 80% |
| Cost | Average paid spend per kept person | ≤ $0.10 |
| Reliability | Captures lost to a crash or being offline | 0 |

## 3. Non-goals (v1)

Automatic DMs or follows · syncing across devices · Android · App Store release · logging in to social accounts · open face-search identification · recording the other person · team features.

## 4. Requirements

P0 = needed by Nov 1. P1 = needed by Devcon (Nov 3). P2 = after the event.

### Capture
| ID | Pri | Requirement |
|---|---|---|
| C1 | P0 | A single scanner handles LinkedIn, X, Telegram, WhatsApp, vCard/MECARD, JWT, address/ENS and plain-text QRs, decoded on the phone |
| C2 | P0 | Badge photo: Claude vision returns name, company, role and handles. A wide photo with several badges creates a stub for each one. |
| C3 | P0 | Photo: one tap, retake, or "no photo". The photo is never required. |
| C4 | P0 | Hold-to-record voice note, up to 120 s, with a visible timer. Keeps recording if the screen locks. |
| C5 | P0 | Automatic context: timestamp, one GPS reading, event matched by time window plus geofence. One tap to change it. |
| C6 | P0 | Rush mode: scanner stays open; each scan saves a stub with a haptic; ★ marks important; "+ wave" saves a face-only stub; one group note |
| C7 | P1 | Share-sheet import: a profile URL or a screenshot from another app |
| C8 | P1 | Manual entry: type a handle or name |

### Identity
| ID | Pri | Requirement |
|---|---|---|
| I1 | P0 | The scanned account is the anchor. Its public profile is fetched through the provider chain. |
| I2 | P0 | Free cross-links first: bio and website links, web3.bio (ENS, Farcaster, Lens, Basenames), GitHub |
| I3 | P0 | Probable accounts: up to 10 per platform, each with avatar, name, bio, evidence list and a confidence of High, Medium or Low. **All levels are listed.** Low is never pre-selected. |
| I4 | P0 | Nothing is linked until you tap Confirm. Rejected candidates are remembered. |
| I5 | P0 | Each platform's name, photo and bio are stored separately, with where they came from. A compare screen shows two side by side. |
| I6 | P1 | Avatar check: Claude vision compares your photo with a candidate's avatar and says "looks similar" or "doesn't". Never presented as proof. |
| I7 | P1 | Reverse avatar search (Lens, $0.20, only when you ask) finds other profiles using the same avatar image |
| I8 | P1 | Merge two people (with your confirmation) |

### AI
| ID | Pri | Requirement |
|---|---|---|
| A1 | P0 | Transcribe on the phone (whisper.rn `small`, multilingual). Fallback: cloud transcription, then typing. |
| A2 | P0 | Structure the note into JSON (see architecture.md). Every field can be edited before saving. |
| A3 | P0 | Split a group note across the stubs in a huddle. People never mentioned are flagged. |
| A4 | P1 | Draft a follow-up message per action, in the right channel |

### Follow-up
| ID | Pri | Requirement |
|---|---|---|
| F1 | P0 | Follow-ups list: overdue, this week, waiting on them |
| F2 | P0 | Open in the right app with a deep link; the draft goes to the clipboard (or is prefilled where the app supports it) |
| F3 | P1 | Local reminder on the due date |
| F4 | P1 | Nightly recap at 23:00 IST: people needing a fix, keep or drop, failed jobs |

### Platform
| ID | Pri | Requirement |
|---|---|---|
| P1 | P0 | Offline-first: capture never waits on the network. Offline is detected immediately; manual form; verify on reconnect (offline.md). |
| P2 | P0 | Provider chains with fallback and a health check (providers-and-fallbacks.md) |
| P3 | P0 | Wallet screen: address, USDC balance, network fee, spent today, daily cap, history. Every payment error explained (wallet-x402.md). |
| P4 | P0 | Face ID lock on open and after 5 minutes in the background |
| P5 | P0 | Nightly encrypted backup to iCloud Drive (Files), plus manual export |
| P6 | P1 | Full-text search over names, handles, transcripts, tags and events |
| P7 | P1 | Delete a person removes everything about them |

## 5. Scope cut order if behind schedule

My card → search → screenshot import → reverse avatar search → merge. **Never cut:** rush mode, offline handling, backup, the Confirm rule.

## 6. Dependencies

twitterapi.io key · Anthropic key · about $20 USDC on Base · free Apple ID · Mac with Xcode · event list JSON (from the IBW side-events page and Luma).
