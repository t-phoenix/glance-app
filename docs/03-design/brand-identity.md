# Brand identity

## Concept: "the venue at night"

Glance is used in dim rooms: a ballroom after the keynote, a rooftop after-party, a hallway outside a side event. It's opened for five seconds with a drink in the other hand. So the brand is **dark-first, calm, high-contrast and warm**, closer to a city at night than to a crypto dashboard.

The palette is mostly ink and mist. Only **one colour means "act"**, so it stays special. Every other colour is a state.

| Reference | Becomes | Meaning in the app |
|---|---|---|
| **Night sky over the Arabian Sea**: deep ink blue, never pure black | Ink surfaces | Calm background, easy on the eyes at 1am |
| Accent, option A: **Arabian Sea blue**, the water's bright edge at dusk | `#5B8CFF` | *Act now*: Scan, Record, Save, active tab, ★ |
| Accent, option B: **Bougainvillea**, the pink spilling over Bandra walls | `#F25C9B` | Same role. More distinctive; sits closer to red. |
| **Banyan**: rooted, settled | Banyan green | *Linked and confirmed* |
| **Slate**: neutral | Slate | *Waiting*: offline, pending, queued |
| **Coral** | Coral | *Needs a look*: conflict, low wallet |
| **Crimson** | Crimson | *Stop*: errors, rejected, destructive |

Accent decision pending (Oct 24): compare both with the switch on the brand board. Tokens default to blue. **No yellow and no teal anywhere** (your direction, Oct 24).

What we avoid: yellow, amber or marigold; teal; near-black with a neon-green pop; purple gradients, glassmorphism, emoji as UI, crypto-dashboard look.

## Personality

| Is | Isn't |
|---|---|
| A sharp friend with a great memory | A sales CRM |
| Calm in a crowd | Busy, gamified, noisy |
| Discreet (data stays on your phone) | Surveillance-y |
| Warm, Indian, specific | Generic Silicon Valley |

## Voice and copy

Short and plain, in the second person. Say what happened, then what to do. No exclamation marks, no emoji, no "Oops".

| Situation | Write | Not |
|---|---|---|
| Saved | "Saved · @priya_zk" | "Success! Contact created 🎉" |
| Offline | "Offline. Scans and notes still save." | "Network error occurred" |
| Low confidence | "Name match only" | "Low probability candidate" |
| Empty | "No one yet today. Tap Scan when you meet someone." | "No data" |
| Destructive | "Delete Priya and all notes about her?" → **Delete Priya** | "Are you sure?" → OK |

Names and handles are always shown exactly as the person wrote them.

## Logo and app icon

**Mark:** a rounded badge shape (the conference badge) with the lanyard slot cut out at the top, in **mist**, and a single dot in the **accent** colour in the lower right: one person, remembered.

- App icon: ink `#0B0E13` background, mist `#E9EDF2` badge at 56% of the icon width, accent dot. No text. Corner radius per iOS (the system applies it).
- Wordmark: "glance" in lowercase Bricolage Grotesque 700, tracking −2%. Tagline: "Glance today, know them tomorrow."
- Minimum size 20 pt. Clear space = the slot height on every side.

## Colour

Dark is the main theme; light is a full counterpart, not an inversion. All text pairs pass WCAG AA (checked Oct 24):

| Token | Dark | Contrast on ink | Light | Contrast on white |
|---|---|---|---|---|
| bg | `#0B0E13` | — | `#F4F6F8` | — |
| surface-1 | `#12161D` | — | `#FFFFFF` | — |
| surface-2 (sheets) | `#1A2029` | — | `#FFFFFF` + shadow | — |
| text | `#E9EDF2` | 16.4 | `#121820` | 16.5 |
| text-2 | `#A9B5C4` | 9.3 | `#4A5868` | 6.7 |
| text-3 | `#8796A8` | 6.4 | `#5F6C7B` | 5.0 |
| action, option A: Arabian Sea blue | `#5B8CFF` | 6.1 | `#2F5FD0` | 5.7 |
| action, option B: Bougainvillea | `#F25C9B` | 6.2 | `#C2266B` | 5.6 |
| linked: Banyan green | `#3DD68C` | 10.3 | `#117446` | 5.8 |
| pending: Slate | `#8C9AB3` | 6.8 | `#56637A` | 6.1 |
| warning: Coral | `#FF8A73` | 8.4 | `#B8432B` | 5.4 |
| danger: Crimson | `#F2555A` | 5.7 | `#C42B3A` | 5.6 |
| border | `#33404F` | decorative | `#DCE1E7` | decorative |
| border-input | `#64748A` | 3.4–3.8 (meets 1.4.11) | `#8593A3` | 3.1 |

**Text on accent buttons:** ink `#0B0E13` in dark (≥ 6.1:1; white would only be 3.1:1). White in light (≥ 5.5:1).

### Identity confidence: never colour alone

| State | Colour | Shape / icon | Label |
|---|---|---|---|
| Confirmed | green fill | `checkmark.seal.fill` | "Linked" |
| Suggested · High | green outline | `link` | "High" |
| Suggested · Medium | neutral (text-2) solid outline | `questionmark.circle` | "Medium" |
| Suggested · Low | text-3 dashed outline | `circle.dashed` | "Low" |
| Rejected | crimson, struck through | `xmark` | "Not them" |
| Pending (offline) | slate | `clock` | "Pending" |
| Conflict | coral fill | `exclamationmark.triangle` | "Check" |

### Platform marks

Platform logos are shown as **monochrome glyphs in text-2**, not in their brand colours. Five brand colours on a row would compete with the state colours. The state is shown by the chip, the platform by the glyph.

## Typography

| Role | Face | Use |
|---|---|---|
| Display | **Bricolage Grotesque** 700 (OFL, bundled with `expo-font`) | Screen titles, person names on the profile, big numbers |
| Text | **SF Pro** (system) with Dynamic Type | Everything else |
| Mono | **JetBrains Mono** 500 (OFL) | Handles, wallet addresses, tx hashes, raw QR payloads |

Handles are in mono because they're identifiers: `@priya_zk` vs `@priya_2k` must be distinguishable at a glance.

## Motion and haptics

| Moment | Motion | Haptic |
|---|---|---|
| QR scanned | Reticle snaps to the QR bounds (120 ms), chip flies to the huddle row (200 ms) | `notificationSuccess` |
| Duplicate scan | Reticle shakes lightly (120 ms) | `impactLight` |
| Record start / stop | Button scales to 1.08 with an accent ring that pulses with voice level | `impactMedium` / `impactLight` |
| Confirm link | Chip changes outline to fill (200 ms) | `notificationSuccess` |
| Error / blocked | No shake (it looks like a bug); the banner slides in | `notificationWarning` |
| Sheet | Spring (damping 22, stiffness 240) | `selection` on open |

Reduce Motion on → crossfades only, and haptics stay.

## Iconography

SF Symbols only (`expo-symbols`), weight `medium`, scaled with Dynamic Type. Use filled variants only for selected or confirmed states.
