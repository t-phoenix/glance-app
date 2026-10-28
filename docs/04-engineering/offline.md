# Offline handling

## Detecting it immediately

Waiting for NetInfo alone is too slow and misses venue Wi-Fi that's connected but has no internet. Recall uses three signals; whichever fires first wins.

| Signal | How | Speed |
|---|---|---|
| **Failed fetch** | Every provider call that fails with a network error, DNS failure or timeout calls `NetworkMonitor.reportFailure()`, which marks the app offline at once and starts the probe | Immediate (≤ timeout; capture never waits for it) |
| **OS reachability** | `NetInfo` with `isInternetReachable`; configured with `reachabilityUrl: 'https://clients3.google.com/generate_204'`, `reachabilityTest: r => r.status === 204`, `reachabilityShortTimeout: 5000`, `reachabilityRequestTimeout: 3000` | ≤ 5 s |
| **Captive portal** | The probe gets 200 with HTML instead of 204 → status `captive` → banner "Venue Wi-Fi needs a login · Open" | ≤ 5 s |

Recovery: the probe runs every 5 s while offline (every 30 s when the app is in the background). After two successful probes in a row → `online` → the queue resumes. Status `degraded` if probe latency is over 3 s: paid jobs pause, free ones continue.

## Offline capture form

Shown as a bottom sheet after a scan or badge photo while offline. The QR is still decoded on the phone, so platform and handle are already filled in.

| Field | Required | Validation (checked as you type) |
|---|---|---|
| Platform + handle | Filled from the scan; editable | X: `^@?[A-Za-z0-9_]{1,15}$` · Telegram: `^@?[A-Za-z][A-Za-z0-9_]{4,31}$` · LinkedIn slug: `^[A-Za-z0-9\-_%]{3,100}$` · WhatsApp: E.164 `^\+[1-9]\d{7,14}$` · ENS: `^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$` · address: `^0x[a-fA-F0-9]{40}$` |
| Real name | Optional | 1–80 characters, trimmed, not just digits |
| Company / project | Optional | 1–80 characters |
| "How I'll recognise them" | Optional | ≤ 140 characters (e.g. "blue Avail hoodie, beard") |
| Photo / voice note | Optional | as usual |

The **Save** button is enabled once the handle is valid, or a name is filled in, or there's a photo. Saving gives toast "Saved offline · will verify when online". Handles are saved as `pending_offline`.

## Verifying when back online

The `verify_offline` job runs for each pending person, with priority 0:

1. Fetch the anchor profile through the chain.
2. Compare with what you typed:
   - **Handle not found** → state `gone` → sheet: "@priya_zk doesn't exist on Telegram. Typo?" with an editable field (closest match suggested if search finds one).
   - **Name mismatch** (Jaro-Winkler < 0.85 after normalising) → state `conflict` → Verify sheet: "You typed **Priya**. Telegram says **Pratik S.**" with **Keep mine** / **Use Telegram's** / **Both (alias)**.
   - **Match** → `anchor` confirmed silently.
3. Then the usual `find_related` and `structure_note` jobs run.
4. One summary sheet for the whole batch: "5 verified · 1 needs a look · 1 not found", never one popup per person.

## What works offline

Scan and decode · badge photo (stored, read later) · photo · voice note · on-device transcription · event matching (local event list) · editing · search · follow-up deep links (the target app handles its own offline state) · wallet screen (cached balance, greyed).
