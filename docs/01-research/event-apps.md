# Event apps and directories

Checked Oct 22, 2026. None of the three events has a public API or an open attendee directory.

| Event | Dates / venue | What exists | What Recall does |
|---|---|---|---|
| IBW, India Blockchain Week ([site](https://indiablockchainweek.com)) | Nov 1–2, Fairmont Mumbai. Hosted by Hashed Emergent. | Public speaker list and 90+ side events. The user says there's a connect app, but nothing about it is public; it's probably inside the ticketing app. | Import speakers as a want-to-meet list; import side events for auto-matching; screenshot import for in-app connections |
| Devcon 8 ([tickets post](https://blog.ethereum.org/2026/07/14/devcon8-tickets)) | Nov 3–6, Mumbai | No official directory found. Public ticket share pages exist at `devcon.org/ticket/<name>` and show only a name or ENS ([example](https://devcon.org/ticket/ligi.ethereum.eth)). A community tool, "Devcon Buddy", shares contacts only after both people accept (status unverified). | If a badge QR contains a ticket URL, take the name or ENS from it, then look it up on web3.bio (free) |
| ETHGlobal | Around Devcon week | Hacker profiles behind a login; no public API | Scan their QR, or screenshot import. P2: log in inside the app to read your own connections list. |

## Action items at the venue (day 1, IBW)

1. Scan your own badge QR and one other person's. Log the raw payload into `docs/01-research/badge-payloads.md`.
2. Scan one QR from inside the IBW app.
3. Screenshot an attendee profile in the IBW app and test screenshot import.
4. If a badge QR resolves to name or email data, it's the organiser's data. Use only what the QR itself reveals; don't try to pull records from their systems.

## Data rules

- Only use what a QR shows you, or what is publicly visible without logging in as someone else.
- No scraping of directories behind a login, except your own account's view (P2, personal use only).
