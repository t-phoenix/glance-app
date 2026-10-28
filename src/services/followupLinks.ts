export type Channel = 'telegram' | 'x' | 'linkedin' | 'whatsapp' | 'email' | null;

export function deepLink(channel: Channel, handle: string, draft: string): { url: string; copyDraft: boolean } {
  const value = handle.replace(/^@/, '');
  switch (channel) {
    case 'telegram':
      return { url: `tg://resolve?domain=${encodeURIComponent(value)}`, copyDraft: true };
    case 'x':
      return { url: `https://x.com/${encodeURIComponent(value)}`, copyDraft: true };
    case 'linkedin':
      return { url: `https://www.linkedin.com/in/${encodeURIComponent(value)}`, copyDraft: true };
    case 'whatsapp':
      return { url: `https://wa.me/${value.replace(/^\+/, '')}?text=${encodeURIComponent(draft)}`, copyDraft: false };
    case 'email':
      return { url: `mailto:${value}?body=${encodeURIComponent(draft)}`, copyDraft: false };
    default:
      return { url: '', copyDraft: true };
  }
}

export function profileUrl(platform: string, handle: string): string {
  const value = handle.replace(/^@/, '');
  if (platform === 'x') return `https://x.com/${encodeURIComponent(value)}`;
  if (platform === 'linkedin') return `https://www.linkedin.com/in/${encodeURIComponent(value)}`;
  if (platform === 'telegram') return `https://t.me/${encodeURIComponent(value)}`;
  if (platform === 'github') return `https://github.com/${encodeURIComponent(value)}`;
  if (platform === 'farcaster') return `https://warpcast.com/${encodeURIComponent(value)}`;
  if (platform === 'whatsapp') return `https://wa.me/${value.replace(/^\+/, '')}`;
  if (platform === 'ens') return `https://app.ens.domains/${encodeURIComponent(value)}`;
  if (platform === 'web') return value;
  return value;
}

export function followLink(platform: string, handle: string): string | null {
  const value = handle.replace(/^@/, '');
  if (platform === 'x') return `https://x.com/intent/follow?screen_name=${encodeURIComponent(value)}`;
  if (platform === 'github') return `https://github.com/${encodeURIComponent(value)}`;
  return null;
}
