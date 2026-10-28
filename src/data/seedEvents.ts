import eventsFile from '../../week-mumbai-2026/events.json';

interface RawEvent {
  id: string;
  name: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  venue_label?: string;
  source?: string;
  source_url?: string | null;
}

/**
 * Approximate public coordinates so time-and-place matching works before a venue pin is confirmed.
 * Hidden Luma addresses stay time-only. Change the event in one tap if the pin is wrong.
 */
const PINS: { test: RegExp; lat: number; lng: number; radius_m: number }[] = [
  { test: /fairmont/i, lat: 19.0974, lng: 72.8745, radius_m: 400 },
  { test: /jio world/i, lat: 19.0634, lng: 72.8697, radius_m: 550 },
  { test: /grand hyatt/i, lat: 19.0769, lng: 72.8514, radius_m: 400 },
  { test: /nesco/i, lat: 19.1506, lng: 72.8536, radius_m: 400 },
];

export function eventSeeds(): {
  id: string;
  name: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  source: string;
  source_url: string | null;
}[] {
  const events = (eventsFile as { events: RawEvent[] }).events;
  return events.map((event) => {
    const hay = `${event.name} ${event.venue_label ?? ''}`;
    const pin = PINS.find((item) => item.test.test(hay));
    return {
      id: event.id,
      name: event.name,
      kind: event.kind,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      radius_m: pin?.radius_m ?? 300,
      source: event.source ?? 'week-mumbai-2026',
      source_url: event.source_url ?? null,
    };
  });
}
