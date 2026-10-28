# UI spec

Target device: **iPhone 13**, 390 × 844 pt, safe area top 47, bottom 34. All sizes are in points. Tokens are named as in [design-tokens.json](design-tokens.json).

## Global rules

1. **One-handed, thumb first.** You're holding a drink or a badge in the other hand. Every primary action sits in the **bottom 40%** of the screen (y ≥ 506). The top of the screen is for reading, not tapping.
2. **Touch targets:** 44 minimum, 48 for list actions, 56 for primary buttons, 72 for Scan, 88 for Record.
3. **Margins:** 16 left and right; 24 between sections; 12 between related items; 8 inside groups.
4. **Primary action placement:** on sheets, the primary button is full width at the bottom (56 high). On two-button rows, the primary is on the **right** and the secondary on the left, each half width minus a 12 gap.
5. **Destructive actions** are never the primary button and never at the bottom-right of a sheet. They live in a menu or a confirmation alert.
6. **Dynamic Type:** layouts support up to AX2; rows grow taller rather than truncating names. Handles truncate in the middle (`@priya…_zk`), never at the end.
7. **Dark default.** The light theme follows the system setting, with an override in Settings.
8. **VoiceOver:** every control has a label in the form verb + object ("Scan a QR code", "Confirm @priyabuilds as Priya"). Chips read out their state ("High confidence, suggested").

## Tab bar and Scan

```
┌───────────────────────────────────────────┐ y=761 (above 34 safe area)
│ Today   People   ( SCAN )   Follow-ups   Me │ 49 high, surface1, top hairline border
└───────────────────────────────────────────┘
```
- 5 slots; the centre slot is **Scan**: a 72 circle in `action`, raised 16 above the bar, with a 4 pt `bg` ring so it separates from the bar. SF Symbol `qrcode.viewfinder`, 28.
- **Tap** opens the scanner (full screen, slides up, 200 ms). **Long-press 450 ms** starts Rush mode (haptic `impactMedium` + a "Rush" label shown under the button for 1 s).
- Tab labels are caption size, not uppercase; active tab uses `action`, inactive `text3`.
- Badges: Follow-ups shows an overdue count (crimson dot, 18, number in footnote bold).

## Screens

### 01 Today
| Element | Spec |
|---|---|
| Large title | "Today" display 34, left 16, y 56; date in subhead text2 on the right |
| Event card | surface1, radius lg, pad 16, height 72. Caption "YOU'RE AT", title2 event name, footnote "Matched by time and location · Change" (the Change link is ghost, 44 target). Tap opens the event picker sheet. |
| Banner area | Directly under the title, 40 high, full bleed with 16 inner padding. At most one banner (priority: captive > offline > budget > backup). |
| Met today header | caption + count, y after the card + 24 |
| Person row | 64 high: avatar 48 (green ring if any link confirmed), name headline (1 line), subline footnote text2 "ZK identity · 2:14pm", trailing chip (todo count, state). Swipe left: ★ (marigold) · Drop (chili). Swipe right: Add note. |
| Empty state | 72 badge illustration in text3, body text2 "No one yet today. Tap Scan when you meet someone.", centred at y 420 |

### 02 Scanner
| Element | Spec |
|---|---|
| Camera | Full screen. Dim overlay 55% `bg` outside a 240 × 240 reticle with radius 24 and accent corner brackets (4 pt stroke, 32 length). |
| Close | Top-left, 44 circle, `xmark`, surface2 at 80% |
| Torch | Top-right, 44 circle, `flashlight.off.fill` |
| Hint | Footnote text2, centred, 24 under the reticle: "LinkedIn, X, Telegram, WhatsApp or badge QR" |
| Bottom actions (y 700) | Three 48-high secondary buttons in a row with gaps of 8: **Badge photo** · **Type @** · **Paste** |
| Result | On decode: haptic, reticle snaps, a result card slides up from the bottom (surface2, radius xl) showing platform glyph + handle (mono 15) + **Save** (primary, 56). In Rush mode, no card: a chip goes to the huddle row instead. |

### 03 Identity / Probable accounts
| Element | Spec |
|---|---|
| Header | Avatar 88 left, name title1, role subhead text2, source chip "From LinkedIn" |
| Platform filter | Horizontal chips, 32 high: "X 9", "LinkedIn 4", "Telegram 2", "GitHub 3". Selected = action tint. |
| Group headers | caption: "HIGH", "MEDIUM", "LOW · name match only" (all three groups shown) |
| Candidate row | 76 high: avatar 48, display name headline + handle mono 13 text2, bio footnote 1 line, evidence line footnote in the state colour ("Linked in her bio"). Trailing **Pick** (secondary, 64 × 36). Tap the row → Compare. |
| Footer (sticky, bottom) | **None of these** (secondary, left) · **Compare 2** (primary, right; enabled when 2 are selected) |

### 04 Capture
| Element | Spec |
|---|---|
| Photo | 4:3 frame, full width minus 32, radius lg; tap to retake. "No photo" ghost button under it on the left. |
| Context chips | Event, time, place: 32-high chips, wrap. Event chip editable. |
| Prompt | Footnote text3: "How you met · what you talked about · what's next" |
| Record button | 88 circle, centred, y 640. **Hold** to record; **slide up 64** to lock hands-free (lock icon appears above). Ring shows voice level. Timer in mono 15 above the button. |
| Save | After release: primary "Save" 56 full width at the bottom; "Discard" lives in a ⋯ menu, not as a button |

### 05 AI review
Field cards (surface1, radius lg) for Who, Talked about, They need, Can help me with. Each card has an edit pencil (44) at top right. Action rows: 24 checkbox, text headline, subline "Me → by Nov 5 · Telegram"; tap to edit owner, due date and channel in a sheet. Tags as chips with "+ tag". Sticky **Save to Priya** primary 56.

### 06 Person
Header as in 03. Below it, a "Linked" handles row of 32 chips with platform glyphs; tap opens a sheet with **Open in app** · **Follow** (X intent) · **Copy** · **Unlink**. Two-button row: **Message** (secondary) · **Follow all** (primary). Encounters timeline: cards with event, time, a photo thumbnail 56, and a play button 44 for the voice note. Open actions below.

### 07 People
Search field 44 high, radius md, placeholder "Who was that…", on top. Filter chips for events and "Has todo". Rows as on Today; results highlight the matched words in the accent colour.

### 08 Follow-ups
Segmented control (Overdue · This week · Waiting), 36 high. Card: person row + draft box (surface2, radius md, body, max 4 lines with "more") + buttons **Copy & open Telegram** (primary, flexible width) · **Edit** (secondary 64) · **Done** (secondary 64). After returning from another app: "Sent?" sheet.

### 09 Recap
Three stat tiles (display numbers) · "Keep or drop?" card stack, swipe right keeps (green glow), left drops (crimson glow), with an undo toast · "Needs a look" list · **Review N items** primary.

### 10 Wallet (Me › Wallet)
Balance display 34 in mono with tabular numbers, "USDC on Base" caption, "Updated 12 s ago" footnote. Address row: mono 15 shortened `0x0544…3980` + **Copy** (44) + **QR** (44). Info row "Network fee $0.00 · paid by facilitator ⓘ". Today's spend progress bar, 8 high, radius pill. History list. Buttons: **Top up** (primary) · **Change cap** (secondary). Export key and Reset are in the ⋯ menu.

### 14 Rush mode
Camera fills the top 45%. A red recording dot and "RUSH · 3:40pm" in the header. "This huddle" row: horizontal chips, 40 high, each with an avatar or initials and a ★ toggle (44 target). Buttons: **+ wave** (secondary) · **Wide photo** (secondary) · **End huddle** (primary, full width, y 740).

## Popups (see states-and-edge-cases.md)
- **Toast:** top, y = safe-top + 8, width 390 − 32, 48 high, surface2, icon 20 in the state colour + footnote text. Swipe up to dismiss.
- **Banner:** below the header, full width, 40 high, state tint background, icon + footnote + optional trailing action (ghost, 44).
- **Sheet:** iOS detents medium/large, grabber 36 × 5, radius 28 at the top, pad 20, primary button full width at the bottom.
- **Alert:** native `Alert` only for destructive actions; the button names the action.
