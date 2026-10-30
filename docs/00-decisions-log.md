# Decisions log

A record of the planning chat from Oct 22 to Oct 24, 2026. Newest decisions are at the bottom. Each one gives the decision and the reason for it.

## Oct 22: the idea

**Problem.** At IBW, Devcon, ETHGlobal and the side events you meet 50 to 150 people. You connect on X, Telegram or LinkedIn, often under pseudonyms, and a week later you can't remember who `@degenwizard` was, what you discussed, or what you promised.

| # | Decision | Why |
|---|---|---|
| D1 | Build around capture, not storage: saving a person must take under 20 seconds | If capture is slow it gets skipped, and nothing else in the app matters |
| D2 | Capture = scan + photo + voice note. Time, GPS and event are added automatically | A photo solves "who is this anon handle"; a voice note is faster than typing |
| D3 | AI turns the voice note into fixed fields: who, what they do, topics, actions | You review it in 10 seconds instead of re-reading a transcript |
| D4 | Nightly recap plus a follow-up queue with drafted messages | Fix mistakes while you still remember faces, and keep promises |

## Oct 22: platform and stack

| # | Decision | Why |
|---|---|---|
| D5 | iOS app in React Native (Expo dev build) for the user's iPhone 13 | The user's request; Expo was already used to install apps on this phone |
| D6 | No backend. SQLite, files and secrets all stay on the device | User request. Also safest for other people's data. |
| D7 | Calls go directly from the app: Anthropic, twitterapi.io, x402 endpoints | A personal app with sideloaded keys is acceptable |
| D8 | Pay per use with x402 (USDC on Base); free sources first | User request; keeps cost to about $0.08 per person |
| D9 | No logging in to social accounts. Follow and Message use deep links | X and LinkedIn APIs don't allow follow/DM cheaply or at all; Telegram has no OAuth for DMs |
| D10 | Never link accounts automatically. Every handle except the scanned one is "suggested" until you tap Confirm | A confident wrong match is worse than none |
| D11 | Transcription on the phone with whisper.rn (multilingual `small` model) | Free, works offline, handles Hinglish |

## Oct 22: v0.2, rush and audit

| # | Decision | Why |
|---|---|---|
| D12 | Rush mode: keep scanning, ★ the important ones, record one note for the group, Claude splits it per person | Most meetings at side events happen in groups |
| D13 | Unstarred, unmentioned stubs get only free lookups. "Keep or drop?" at night; archived after 72 hours | Let the people who don't matter drop off, and save money |
| D14 | Unknown QR codes are decoded as text only, never opened in a browser or wallet | QR phishing is common at crypto events |
| D15 | Probable accounts: up to 10 per platform, ranked by evidence | Common names rarely give one exact match |
| D16 | Each platform's photo, name and bio are stored separately on the profile | People use different identities on each platform |
| D17 | Voice notes are only your own voice. The app never records the other person | Consent and trust |
| D18 | Face ID lock and nightly encrypted backup are P0 | A phone lost in a crowd would lose everything; the app also holds a wallet key |

## Oct 23: prior art

| # | Decision | Why |
|---|---|---|
| D19 | Convu is the closest existing app (LinkedIn QR, voice note, Luma, drafts) but has no X, Telegram or pseudonym support | See [competitors.md](01-research/competitors.md) |
| D20 | Borrow wingmic's (MIT) extraction prompts and schema, and Recco's (MIT) identity-matching steps | Don't rewrite solved parts |
| D21 | The user chose to build the full app (Oct 24 brief) | One app instead of two, plus crypto-specific needs |

## Oct 24: this brief

| # | Decision | Why |
|---|---|---|
| D22 | No $99 Apple account. Install a **Release** build with a free Apple ID; re-sign before day 7 | See [install-on-iphone.md](06-delivery/install-on-iphone.md). Data survives a reinstall. |
| D23 | No open face search (PimEyes-style). Face matching only compares your photo against candidate avatars already found by handle or name. Google Lens (via x402) is used on avatars, badges and booth photos, not on faces. | India's DPDP Act 2023, consent, and Lens deliberately not identifying people. See [providers-and-fallbacks.md](04-engineering/providers-and-fallbacks.md) |
| D24 | The wallet screen shows address, USDC balance, network fee ($0, paid by the facilitator), spend today, cap and history | User request. x402 "exact" uses EIP-3009, so you need no ETH for gas. |
| D25 | Every data need has a chain of providers: free first, then paid backup, then manual. A health check pins the ones that work. | User request; smoke tests on Oct 24 showed llamarpc and ensdata failing |
| D26 | Offline is detected immediately (failed fetch plus a reachability probe). Capture switches to a manual form with per-field validation. Results are verified against what you typed when back online. | User request |
| D27 | Low-confidence matches are listed (shown, not hidden), always marked Low, and never pre-selected | User request |
| D28 | Feedback hierarchy: inline → toast → banner → bottom sheet → alert, with haptics | Consistent state handling. See [states-and-edge-cases.md](02-product/states-and-edge-cases.md) |
| D29 | Dark-first brand: "Venue at night". Ink blues, one accent for actions, Banyan green for confirmed. Handles in a mono font. Revised Oct 24: no yellow, no teal; the accent is Arabian Sea blue or Bougainvillea (choice pending). | See [brand-identity.md](03-design/brand-identity.md) |
| D30 | The app is named Glance. Tagline: "Glance today, know them tomorrow." | Superseded by D31. The first install kept the old stored names so an update would not orphan the wallet. |
| D31 | Bundle id `xyz.abhinil.glance`, database `glance.db`, keychain prefix `glance.`, URL scheme `glance://`. The previous install was copied across and then removed. | Changing those names installs a second app. The people list, files, and wallet key were copied into it, checked, and the old app was deleted. |
