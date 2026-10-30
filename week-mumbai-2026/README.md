# Mumbai crypto week — source data

Public schedule for 30 Oct–8 Nov 2026. Kept in this folder so it stays out of `docs/`.

Pulled 21 Oct 2026 from the IBW Luma calendar, Devcon tickets and Pretalx v0.19, ETHGlobal’s submit page, IBW, and Fairmont. Personal Luma approvals are not here.

Times in `events.json` are UTC (`starts_at`, `ends_at`), matching Glance’s `event` table. `starts_at_ist` is the local time. `kind` is `conference`, `hackathon`, `party`, or `side`.

| File | What |
|---|---|
| [events.json](events.json) | 80 public listings |
| [venues.json](venues.json) | Pins, addresses, place ids |
| [deadlines.json](deadlines.json) | Ticket dates and Diwali |
| [devcon-program.json](devcon-program.json) | Daily talk bounds, not every session |
| [tickets.md](tickets.md) | Prices and how the venues connect |

## Flags

- Fri 6 Nov overlaps Devcon (Jio, until 17:00), ETHGlobal (same complex), and Pragma (Grand Hyatt, 10:00–19:00).
- Pragma’s pin and time come from the Luma row that links to ethglobal.com. Other directories still say 5 Nov or Jio.
- ETHGlobal’s details page says submit Sat 7 Nov, 09:00 IST. The calendar block runs until 19:00. Use 09:00 until the hacker dashboard says otherwise.
- IBW hours are the calendar block, read as 10:00–19:00 each day. Session agenda was unpublished on 21 Oct.
- “Address hidden until approved” and “city pin only” are listing limits, not missing rows.

## Links

- https://luma.com/ibw
- https://devcon.org/en/
- https://tickets.devcon.org/
- https://cfp.devcon.org/devcon8/schedule/
- https://devcon.org/en/travel-guide/
- https://indiablockchainweek.com/
- https://ethglobal.com/events/mumbai
- https://ethglobal.com/events/pragma-mumbai
- https://ethglobal.com/events/mumbai/info/details
