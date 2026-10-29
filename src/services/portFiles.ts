/** Local file addresses stored on the Expo Go copy. Remote portraits are left alone. */
export function listFileUris(database: string): string[] {
  return [...new Set(database.match(/file:\/\/[^\s"\\]+/g) ?? [])];
}

export function replaceFileUris(database: string, pairs: { from: string; to: string }[]): string {
  return pairs.reduce((text, pair) => text.split(pair.from).join(pair.to), database);
}
