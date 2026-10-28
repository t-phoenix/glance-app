# Risks and open questions

| # | Risk | Likelihood | Impact | Mitigation | Owner / date |
|---|---|---|---|---|---|
| R1 | 7-day free signing expires mid-week | Certain | App won't open (data kept) | Release build Oct 31; re-sign Nov 5 night; reinstall-over test in the field test | You, Nov 5 |
| R2 | Badge QR is an opaque ticket ID | High | Badge scan gives nothing | Badge photo + vision is a P0 path; check day 1 | You, Nov 1 |
| R3 | `@x402/fetch` doesn't run under Hermes / RN | Medium | No paid lookups | Polyfills; fallback: sign EIP-3009 with viem directly | Oct 29 |
| R4 | whisper.rn `small` too slow or hot on an iPhone 13 | Medium | Notes slow to appear | Transcribe while charging or at night; `base` multilingual model; cloud fallback | Oct 27 |
| R5 | LinkedIn login wall from cellular data | Medium | Free LinkedIn fails | Paid fallback ($0.06); paste headline | Oct 26 |
| R6 | twitterapi.io endpoints differ from the docs | Low | X search fails | Test with key on Oct 26; stablesocial fallback | Oct 26 |
| R7 | Weak signal at the Fairmont and side venues | High | Lookups delayed | Offline-first; verify on reconnect | built in |
| R8 | Hot wallet on the phone | Low | Lose ≤ $20 | Small balance, cap, Face ID, allowlisted origins | built in |
| R9 | Wrong identity confirmed | Medium | Message the wrong person | Evidence shown; compare screen; confirm only by you; undo link | built in |
| R10 | Other people's data | — | Trust and legal | Device only; public data only; no face search (D23); delete-person; no recording of others | built in |
| R11 | Phone lost or stolen | Low | Data loss | Nightly encrypted backup; Face ID lock | built in |
| R12 | Scope too big for 7 days | High | Unfinished features | Daily device builds; cut order in build-plan.md | daily |
| R13 | Battery | High | Phone dead by evening | Power bank; postpone heavy jobs | built in |

## Open questions

1. What exactly do the IBW, Devcon and ETHGlobal badge QR codes contain? (answer on Nov 1, log it in `01-research/badge-payloads.md`)
2. Does the IBW connect app export or share profile links? (check after downloading their app)
3. twitterapi.io: exact user-search endpoint and rate limits for your plan.
4. Do you want a cloud transcription key as the fallback (OpenAI or Groq), or is typing enough?
