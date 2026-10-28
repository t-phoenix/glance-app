/** Jaro-Winkler similarity in 0..1. Used to verify a typed name against a fetched profile. */
export function jaroWinkler(aRaw: string, bRaw: string): number {
  const a = aRaw.normalize('NFKC').toLowerCase().trim();
  const b = bRaw.normalize('NFKC').toLowerCase().trim();
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  const limit = Math.min(4, a.length, b.length);
  while (prefix < limit && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function firstToken(value: string): string {
  return value.normalize('NFKC').trim().split(/\s+/)[0] ?? '';
}

/** U-V-01 compares the first token. "Priya" vs "Priya Sharma" matches. */
export function namesMatch(typed: string, fetched: string, threshold = 0.85): boolean {
  return jaroWinkler(firstToken(typed), firstToken(fetched)) >= threshold;
}
