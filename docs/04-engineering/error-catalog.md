# Error catalog

Every `AppError.code` the app can show. The message is written for you, not for a developer: it says what happened, then what to do. "Level" is the feedback level from [states-and-edge-cases.md](../02-product/states-and-edge-cases.md).

| Code | Level | Message | Action button | Retryable |
|---|---|---|---|---|
| **N1** offline | Banner | "Offline. Scans and notes still save." | — | auto |
| **N2** captive | Banner | "Venue Wi-Fi needs a login." | Open login | auto |
| **N3** degraded | Banner (subtle) | "Slow connection. Paid lookups paused." | — | auto |
| **P1** provider timeout | Inline on row | "X didn't answer. Trying another source." | — | yes |
| **P2** rate limited | Inline | "X is busy. Retrying in 30 s." | Retry now | yes |
| **P3** bad key (401/403) | Banner | "twitterapi.io key was rejected. Check Settings › Keys." | Open Keys | no |
| **P4** not found (404) | Inline | "@priya_zk wasn't found on Telegram." | Edit handle | no |
| **P5** all providers failed | Recap card | "Couldn't look up @0xkaran. Fill in by hand or retry later." | Retry · Fill in | manual |
| **A1** transcription empty | Sheet | "Couldn't hear anything in that note." | Re-record · Type it | manual |
| **A2** AI invalid output | Inline | "Summary needs a look." (transcript kept) | Review | yes (1×) |
| **A3** AI unavailable | Inline | "AI is unreachable. Note saved; summary will run later." | — | yes |
| **A4** badge unreadable | Sheet | "Couldn't read that badge." | Retake · Type name | manual |
| **C1** camera denied | Screen | "Recall needs the camera to scan QR codes." | Open Settings | manual |
| **C2** mic denied | Screen | "Recall needs the microphone for voice notes." | Open Settings | manual |
| **C3** location denied | Toast (once) | "No location. Events are matched by time only." | — | — |
| **C4** storage low | Banner | "Phone storage is low (180 MB). Notes are being saved smaller." | Manage | — |
| **C5** recording interrupted | Toast | "Recording saved (stopped by a call)." | — | — |
| **Q1** unsafe QR | Sheet | "This QR is a payment/wallet link. Recall won't open it." | Save as text | — |
| **Q2** duplicate scan | Haptic only | — | — | — |
| **Q3** known person | Sheet | "You met Priya at IBW Day 1." | New encounter · Open | — |
| **I1** already linked elsewhere | Inline | "This account is linked to Marco R." | Merge · Cancel | — |
| **I2** conflict after offline | Sheet | "You typed Priya. Telegram says Pratik S." | Keep mine · Use theirs · Both | — |
| **W1–W8** | see [wallet-x402.md](wallet-x402.md) | | | |
| **B1** backup failed | Banner (next morning) | "Last night's backup didn't finish. Export manually?" | Export | yes |
| **B2** restore failed | Alert | "Backup file couldn't be opened (wrong device key?)." | — | — |
| **S1** Face ID failed or unavailable | Screen | "Unlock with your passcode." | Use passcode | — |
| **X0** unexpected | Toast | "Something went wrong. Your data is safe." (logged with id) | Copy details | — |

Logging: every error goes to a local `error_log` ring buffer (last 500 entries) with the code, a cause hash and a timestamp, viewable in Settings › Diagnostics. No crash reporting leaves the device.
