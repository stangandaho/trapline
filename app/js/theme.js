// Light / dark theme chosen on this phone. 'system' follows the phone setting.

const KEY = 'theme';

export function getTheme() {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* private mode: this session only */ }
  applyTheme(theme);
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  // Browser bar colour follows the chosen theme too
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#211b1a' : '#ffffff'));
}
