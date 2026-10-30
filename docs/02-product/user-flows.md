# User flows

The times are what the flow should feel like on the phone. Haptic and popup names refer to [states-and-edge-cases.md](states-and-edge-cases.md).

## F1. One-on-one meeting

| Step | Real life | App | Feedback |
|---|---|---|---|
| 1 | "Hey, what are you building?" | — | — |
| 2 | Talk for 2–8 minutes | — | — |
| 3 | "Are you on Telegram?" They show a QR | Tap **Scan** (bottom centre); camera opens in under 300 ms | — |
| 4 | — | QR decoded on the phone and a stub saved | Haptic `success`, toast "Saved · @priya_zk" |
| 5 | "Quick selfie so I remember?" | Photo sheet opens; shutter button bottom centre | Shutter haptic |
| 6 | They say no | Tap "No photo" (secondary, left) | — |
| 7 | You walk away | Hold the record button; speak for 30–60 s | Haptic on start and stop; timer |
| 8 | — | Lookups and AI run in the background | "Enriching…" on the card |
| 9 | Later | Review sheet: edit fields, confirm suggested accounts | Toast "Saved to Priya" |

**Nudge:** a stub with no note and no star gets a local notification 2 minutes later ("Add a note for @priya_zk?"), at most once.

## F2. Rush (3–8 people at once)

1. Long-press **Scan** to enter Rush mode. A red dot shows in the header and a huddle starts with an event and timestamp.
2. Scan, scan, scan. Each scan gives a haptic and adds a chip to the "This huddle" row.
3. Tap a chip to ★ it. Tap **+ wave** to save a face-only stub (it opens the camera).
4. No time to scan: tap **Wide photo**. Claude reads every badge in view and adds a stub for each.
5. Tap **End huddle**. The group note recorder opens: "Say who's who".
6. Claude splits the note per stub (screen 15). Unmentioned stubs show "Keep or drop?".
7. Paid lookups run only for ★ stubs or stubs mentioned in the note.

## F3. Offline capture

1. Venue Wi-Fi is down. An Offline banner (slate) appears within 1 s of the first failed request, or within 5 s from the reachability probe.
2. Scan: the QR is still decoded on the phone, and the platform and handle are filled in.
3. The Offline capture sheet asks for: real name (optional), company (optional), "how will I recognise them" (optional). Each field is checked as you type.
4. Save: toast "Saved offline · will verify when online". The card shows a "Pending" chip.
5. Back online: the banner goes, the queue runs, and a sheet appears: "3 people verified · 1 needs a look". Any conflicts open the Verify sheet ([offline.md](../04-engineering/offline.md)).

## F4. Unknown QR

Scan → "Unknown QR" sheet showing the raw payload (selectable), what it is, and what was found → buttons **Badge photo** / **Search socials** / **Save as note only**. Unknown QR text is never opened in a browser or wallet.

## F5. Confirming identity

Profile → "Probable accounts" chips per platform → list sorted by evidence (High → Medium → Low, all visible) → tap a row to compare side by side → **Confirm link** (primary, right) or **Not them** (secondary, left). Confirm gives a haptic and moves the handle into "Linked".

## F6. Follow-up

Follow-ups tab → card with the draft → **Copy & open Telegram** → Glance copies the draft and opens `tg://resolve?domain=` → you paste and send → back in Glance a sheet asks "Sent?" with **Yes, mark done** or **Not yet**.

## F7. Nightly recap (23:00 IST)

Notification → Recap screen → swipe through "Keep or drop?" stubs (right = keep, left = drop, with undo toast) → fix stubs with no real name → retry failed jobs → done.

## F8. Wallet top-up

Me → Wallet → address QR and a copy button → send USDC on **Base** from another wallet → balance updates on the next poll (30 s while the screen is open) → toast "Received 20.00 USDC".
