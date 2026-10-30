# Installing on the iPhone without the $99 Developer Program

## Options

| Option | Paid? | Native modules (whisper.rn)? | Needs the Mac running at the venue? | Expires |
|---|---|---|---|---|
| **A. Expo Go** + `npx expo start` | Free | ❌ Expo Go can't load custom native code | ✅ yes (or a tunnel) | never |
| **B. `npx expo run:ios --device` Debug** | Free (Personal Team) | ✅ | ✅ yes: JS loads from Metro | 7 days |
| **C. `npx expo run:ios --device --configuration Release`** | Free (Personal Team) | ✅ | ❌ no: JS is bundled in the app | **7 days** |
| D. EAS Build internal distribution / TestFlight | $99/yr | ✅ | ❌ | 90 days to 1 year |

**Use option C.** It's the same `expo run:ios` you've used before, but a Release build includes the JS bundle, so the app works with no Mac and no network.

With a free Apple ID the 7-day limit can't be avoided. Two facts make it manageable:
1. When the profile expires, the app stops **launching**, but its **data stays on the phone**.
2. Re-running the same install command over the existing app (same bundle ID, not deleted first) **keeps all the data**. The field test checks this.

Free Personal Team limits: 3 sideloaded apps at once, and 10 App IDs per 7 days. Use one fixed bundle ID, `xyz.abhinil.glance`.

## Re-sign schedule

| Install | Expires | Covers |
|---|---|---|
| Fri Oct 31, 21:00 | Fri Nov 7, ~21:00 | IBW (Nov 1–2) and Devcon (Nov 3–6) |
| **Wed Nov 5 night**, at the hotel with the Mac | Wed Nov 12 | ETHGlobal and the follow-up week |

Set an iPhone reminder for Nov 5, 22:00: "Re-sign Glance". Take the Mac and a USB-C to Lightning cable. Re-install over Wi-Fi also works if the phone was paired over the network in Xcode once.

## One-time setup (Oct 24–25)

1. iPhone: Settings › Privacy & Security › **Developer Mode** → On → restart.
2. Xcode › Settings › Accounts → add your Apple ID → it creates a "Personal Team".
3. `app.json`: `ios.bundleIdentifier = "xyz.abhinil.glance"`, scheme `glance`, database `glance.db`. Plus the background audio mode and camera, microphone and location usage strings.
4. `npx expo prebuild -p ios` → open `ios/*.xcworkspace` once → Signing & Capabilities → Team = Personal Team.
5. `npx expo run:ios --device --configuration Release`
6. iPhone: Settings › General › VPN & Device Management → trust your developer profile.

## Things that don't work on a free account

Push notifications from a server (not needed: we only use local notifications) · iCloud **container** entitlement (backup uses the Files/iCloud Drive document picker instead, which works) · App Groups (no widgets in v1) · TestFlight.
