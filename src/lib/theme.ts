/**
 * Switch the site between light and dark. Besides the `dark` class (the colours), it sets `color-scheme`, which tells
 * the browser which theme is showing: phone browsers with their own automatic dark mode (Chrome, Samsung Internet,
 * Opera...) then leave the page alone instead of darkening the light theme into a muddy grey. It also colours the
 * phone's address bar to match, and remembers the choice.
 */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'mfqats-theme';
const BAR = { light: '#F5F3FF', dark: '#0B0B0F' };

export function savedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme, remember = true) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', BAR[theme]));
  if (remember) {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode: the choice just isn't kept */ }
  }
}
