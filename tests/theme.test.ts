import { describe, expect, it } from 'vitest';
import { avatarTone, badgeLabel, brand, contrast, dark, initials, light, ROLES } from '@/src/ui/theme';

const themes = { dark, light };

describe('Tidepool theme', () => {
  for (const [name, theme] of Object.entries(themes)) {
    describe(name, () => {
      it('has readable text on the page and on cards', () => {
        for (const surface of [theme.bg, theme.surface1]) {
          expect(contrast(theme.text, surface)).toBeGreaterThanOrEqual(7);
          expect(contrast(theme.text2, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(theme.text3, surface)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(theme.text3, theme.surface2)).toBeGreaterThanOrEqual(4.5);
      });

      it('keeps links, warnings and errors readable as text', () => {
        for (const color of [theme.link, theme.warning, theme.danger, theme.linked]) {
          expect(contrast(color, theme.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(color, theme.surface1)).toBeGreaterThanOrEqual(4.5);
        }
      });

      it('puts Ink text on every pastel fill', () => {
        expect(contrast(theme.actionText, theme.action)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme.onColor, theme.dangerFill)).toBeGreaterThanOrEqual(4.5);
        for (const role of ROLES) expect(contrast(theme.onColor, theme[role])).toBeGreaterThanOrEqual(4.5);
      });

      it('uses only hex colors for everything but the scrim', () => {
        for (const [key, value] of Object.entries(theme)) {
          if (key === 'scrim') expect(value).toMatch(/^rgba\(/);
          else expect(value).toMatch(/^#[0-9A-F]{6}$/i);
        }
      });
    });
  }

  it('gives light and dark the same keys', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it('uses the brand pastels for fills in both themes', () => {
    expect(dark.action).toBe(brand.tide);
    expect(light.action).toBe(brand.tide);
    expect(dark.sea).toBe(light.sea);
  });
});

describe('avatar helpers', () => {
  it('picks the same pastel for the same name, whatever the casing', () => {
    expect(avatarTone('Priya Raman')).toBe(avatarTone('  priya raman '));
    expect(ROLES).toContain(avatarTone('Karan'));
  });

  it('spreads names across more than one color', () => {
    const tones = new Set(['Priya', 'Karan', 'Ananya', 'Dev', 'Sana', 'Arjun', 'Meera', 'Rohan'].map(avatarTone));
    expect(tones.size).toBeGreaterThan(2);
  });

  it('makes initials from first and last words', () => {
    expect(initials('Priya Raman')).toBe('PR');
    expect(initials('Dev Kumar Malhotra')).toBe('DM');
    expect(initials('@karan')).toBe('K');
    expect(initials('   ')).toBe('?');
  });
});

describe('tab badge', () => {
  it('hides at zero and caps at 9+', () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(-2)).toBeNull();
    expect(badgeLabel(Number.NaN)).toBeNull();
    expect(badgeLabel(4)).toBe('4');
    expect(badgeLabel(10)).toBe('9+');
  });
});

describe('event tag colors', () => {
  it('shows tags saved in the old palette as the matching pastel without changing stored data', async () => {
    const { readEventTags, tagDisplayColor, TAG_COLORS } = await import('@/src/data/weekTags');
    const stored = JSON.stringify([{ name: 'IBW', color: '#5B8CFF' }, { name: 'Custom', color: '#123456' }]);
    const tags = readEventTags(stored);
    expect(tags[0]?.color).toBe('#5B8CFF');
    expect(tagDisplayColor('#5B8CFF')).toBe('#9CC3FF');
    expect(tagDisplayColor('#5b8cff')).toBe('#9CC3FF');
    expect(tagDisplayColor('#123456')).toBe('#123456');
    for (const swatch of TAG_COLORS) expect(contrast(brand.ink, swatch)).toBeGreaterThanOrEqual(4.5);
  });
});
