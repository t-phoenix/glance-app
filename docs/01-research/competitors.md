# Competitors and prior art

Researched Oct 23, 2026 with web search, Exa neural search (via x402) and the GitHub API. I didn't install or test any of these apps; everything below comes from their websites, READMEs and showcase pages.

## Verdict

No existing app does the whole job for a crypto event. The LinkedIn plus voice-note part is solved (Convu, ConnectMachine, RELOS). Nothing handles **X and Telegram identities, matching pseudonymous accounts with your confirmation, groups of people at once, or keeping data on the phone.** That's what makes Recall worth building.

## Commercial apps

| App | Covers | Missing for us | Price |
|---|---|---|---|
| [Convu](https://convu.ai) (iOS/Android) | LinkedIn QR scan, voice note as you walk away, enrichment (work email, company), event from calendar or Luma, location, AI search, drafts sent from WhatsApp, LinkedIn or email | X and Telegram, pseudonym matching, rush mode, local storage | Free: 100 connections, 10 voice notes/mo. Pro+: £15/mo ([pricing](https://convu.ai/pricing)) |
| [ConnectMachine](https://connectmachine.ai) | Digital card, card and QR scanning, voice notes attached to the contact, place and time, 2-day follow-up nudge, AI search, MCP and Zapier | Built around business cards; no social identity matching | Free to start |
| [RELOS](https://relos.eu) | Photo, voice or text capture; notes only in your own voice ("no bot in the room"); grouped by event; email, LinkedIn and WhatsApp drafts | No QR or social matching; aimed at EU business development | Free start |
| Wavee by Bondex ([press release](https://www.globenewswire.com/news-release/2025/04/29/3070722/0/en/Bondex-Launches-Wavee-App-at-Token2049-Streamlining-the-Conference-Networking-Experience.html)) | Telegram-native contact swap for web3, launched at Token2049 Dubai in April 2025 | Both people need the app; no notes or AI; 2026 status unknown | Free |
| BoothIQ, Conflead, ProLead, QualifAI, Momentify | Booth lead capture for sales teams | Built for exhibitors, not personal networking | Paid |
| HiHello, Popl, Blinq | Digital business cards | Little follow-up or notes | Freemium |
| Dex, Clay | Personal CRM with LinkedIn sync | No capture at the event, no QR or voice note | Paid |

## Open source and hackathon projects

| Project | What it does | License / activity | Use |
|---|---|---|---|
| [wingmic](https://github.com/Ayaan2907/wingmic) | Voice dump into a memory graph of people, events, topics and actions; ask questions in plain English | MIT, v1.0, pushed Oct 16 2026 | **Borrow** its extraction prompt and schema |
| [Recco](https://github.com/perhapspranav/Recco) | iPhone AR assistant: identity from badge or profile, face check, confidence and lead score, outreach drafts | MIT, Swift, pushed Jun 2026 | **Borrow** its identity-matching steps |
| [LyncSnap](https://github.com/AIFrontiersLab/LyncSnap) | LinkedIn QR, notes, end-of-day summary | No license, Swift | Reference only (no license, so no code reuse) |
| [converge](https://github.com/rribeiropedro/converge) | Records conversations, extracts fields with confidence, approval step for low-confidence fields | No license | Reference: approval step |
| [IntroGram](https://ethglobal.com/showcase/introgram-x72by) (ETHGlobal) | Telegram mini-app: transcribe, summarise, link Telegram handle | Hackathon | Shows the need exists |
| [Connections](https://dorahacks.io/buidl/26965) (DoraHacks) | Telegram QR plus notes per event, stored in the browser, AI chat | Hackathon | Shows the need exists |
| [Proof of People](https://ethglobal.com/showcase/proof-of-people-g4thi) (ETHGlobal) | Connections as NFTs by swapping QRs | Hackathon | Both people need the app; skip |
| [Tapper](https://github.com/Team-Obviously/tapper) | NFC/QR plus zero-knowledge proofs for event matching | No license | Both people need the app; skip |
| Dhaga | Local-first AI personal CRM (pre-alpha) | Repo no longer found on GitHub (Oct 23) | — |

## Lessons we're taking

1. **Notes only in your own voice** (RELOS, Convu): never record the other person.
2. **An approval step for low-confidence fields** (converge): this becomes our Confirm rule.
3. **A nudge after 2 days** (ConnectMachine): this becomes our follow-up reminder.
4. **Apps where both people must install them fail** (Wavee, POP, Tapper): Recall works when only you have it.
