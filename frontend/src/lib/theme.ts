const CACHE_KEY = 'filazap_theme_cache';

export type ThemeCache = {
  theme: string;
  brandColor: string;
};

export const DEFAULT_THEME = 'light';
export const DEFAULT_BRAND_COLOR = '#10b981';

function darken(hex: string, amount = 0.15): string {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return hex;
  const num = parseInt(value, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function applyOrgTheme(theme: string, brandColor: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  if (/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    root.style.setProperty('--primary', brandColor);
    root.style.setProperty('--primary-dark', darken(brandColor));
    root.style.setProperty('--primary-soft', `${brandColor}1f`);
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-dark');
    root.style.removeProperty('--primary-soft');
  }
}

export function saveThemeCache(cache: ThemeCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignora
  }
}

export function loadThemeCache(): ThemeCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ThemeCache) : null;
  } catch {
    return null;
  }
}

export function clearThemeCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignora
  }
}

/** Script inline (antes do paint) para evitar flash de tema. */
export const themeInitScript = `
try {
  var c = JSON.parse(localStorage.getItem('${CACHE_KEY}') || 'null');
  var theme = c && c.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  if (c && /^#[0-9a-fA-F]{6}$/.test(c.brandColor)) {
    document.documentElement.style.setProperty('--primary', c.brandColor);
    var v = c.brandColor.replace('#', '');
    var n = parseInt(v, 16);
    var r = Math.max(0, Math.round(((n >> 16) & 255) * 0.85));
    var g = Math.max(0, Math.round(((n >> 8) & 255) * 0.85));
    var b = Math.max(0, Math.round((n & 255) * 0.85));
    document.documentElement.style.setProperty('--primary-dark', '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0'));
    document.documentElement.style.setProperty('--primary-soft', c.brandColor + '1f');
  }
} catch (e) {}
`;
