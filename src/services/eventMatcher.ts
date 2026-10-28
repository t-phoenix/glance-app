import { distanceMeters } from '@/src/lib/geo';

export interface EventRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
}

export interface EventMatch {
  event: EventRow;
  distanceM: number | null;
  by: 'time_and_place' | 'time';
}

export function matchEvents(
  events: EventRow[],
  atIso: string,
  lat: number | null,
  lng: number | null,
): EventMatch[] {
  const at = new Date(atIso).getTime();
  const matches: EventMatch[] = [];
  for (const event of events) {
    const starts = new Date(event.starts_at).getTime();
    const ends = new Date(event.ends_at).getTime();
    if (!(at >= starts && at < ends)) continue;
    if (lat != null && lng != null && event.lat != null && event.lng != null) {
      const distanceM = distanceMeters(lat, lng, event.lat, event.lng);
      if (distanceM <= event.radius_m) matches.push({ event, distanceM, by: 'time_and_place' });
      continue;
    }
    matches.push({ event, distanceM: null, by: 'time' });
  }
  matches.sort((a, b) => {
    if (a.by !== b.by) return a.by === 'time_and_place' ? -1 : 1;
    return (a.distanceM ?? 1e12) - (b.distanceM ?? 1e12);
  });
  return matches;
}
