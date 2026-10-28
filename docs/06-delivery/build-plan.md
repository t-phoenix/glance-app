# Build plan (Oct 24 → Oct 31)

Each day ends with a Release build on the iPhone. If a day slips, cut items from the bottom of that day, never the tests for P0 work.

| Day | Build | Tests that day | Done when |
|---|---|---|---|
| **Fri Oct 24** | Repo, Expo dev build, Release install on the iPhone (install-on-iphone.md). Tokens and base components (Button, Chip, Toast, Banner, Sheet). SQLite schema + migrations. FeedbackBus. | Install works with Developer Mode on | App opens with tokens, offline |
| **Sat Oct 25** | Scanner + `parsers/*`. CaptureService, MediaStore, LocationService, EventMatcher + seed events. Today and Scan screens. Rush mode (stubs, ★, + wave). | U-QR-*, U-H-*, U-E-* | Scan 10 real QR types → stubs with event |
| **Sun Oct 26** | NetworkMonitor + probe + captive. QueueService. Offline form with validation. ProviderRegistry + breakers + logging. Free providers: t.me, LinkedIn `og`, web3.bio, ENS RPCs, GitHub. twitterapi.io with key. | U-Q-*, U-V-*, I-01, I-02, I-06, I-07 | Airplane mode capture → online → verified |
| **Mon Oct 27** | whisper.rn + recording UI. AIService (structure, split, badge vision) with evidence check. Review screen. Huddle split sheet. | U-AI-*, I-09 | 60 s Hinglish note → correct fields |
| **Tue Oct 28** | IdentityResolver + Scorer + probable accounts + compare + confirm. Avatar compare. Person screen with personas. | U-S-*, E-04 | Common name → ranked list incl. Low → confirm |
| **Wed Oct 29** | WalletService + SpendGuard + x402 (Base) + wallet screen + paid providers. Health check. Face ID lock. | U-G-*, I-03–I-05, E-06, E-08 | $1 test top-up, 3 paid lookups match BaseScan |
| **Thu Oct 30** | Follow-ups + deep links + reminders. Recap + keep/drop. Backup/restore. Search. Unsafe-QR sheet. Delete person. | I-10, I-11, E-01–E-03, E-05, E-07 | All E2E green |
| **Fri Oct 31** | Field test checklist (test-plan.md). Fix bugs. Load the final IBW side-event list. **Re-sign 21:00.** | Field test | Checklist all ✅ |

## Cut order if behind

My card → search → screenshot import → reverse avatar (Lens) → merge → avatar compare. **Never cut:** offline handling, rush mode, backup, Confirm rule, wallet errors.

## Before Nov 1

- [ ] $20 USDC on Base in the app wallet, cap $2/day
- [ ] Keys entered: twitterapi.io, Anthropic
- [ ] Events JSON: IBW days, Devcon days, ETHGlobal, at least 20 side events with coordinates
- [ ] Want-to-meet list imported (IBW and Devcon speakers)
- [ ] Re-sign reminder set for Nov 5, 22:00
- [ ] Power bank (camera + GPS + whisper)
