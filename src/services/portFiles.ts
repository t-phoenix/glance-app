/** Local file addresses stored on the Expo Go copy. Remote portraits are left alone. */
export function listFileUris(database: string): string[] {
  return [...new Set(database.match(/file:\/\/[^\s"\\]+/g) ?? [])];
}

export function replaceFileUris(database: string, pairs: { from: string; to: string }[]): string {
  return pairs.reduce((text, pair) => text.split(pair.from).join(pair.to), database);
}

/** Path under Documents, or null when the address is not one of our files. */
export function documentRelative(uri: string): string | null {
  const marker = '/Documents/';
  const at = uri.indexOf(marker);
  if (!uri.startsWith('file:') || at < 0) return null;
  const relative = uri.slice(at + marker.length);
  return relative || null;
}

export function joinDocumentUri(documentsUri: string, relative: string): string {
  const base = documentsUri.endsWith('/') ? documentsUri : `${documentsUri}/`;
  return `${base}${relative}`;
}
