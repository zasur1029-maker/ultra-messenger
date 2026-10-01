/**
 * ThemeManager — темы, акценты, размер шрифта.
 */
export const THEMES = ['light', 'dark', 'amoled', 'auto'];
export const ACCENTS = ['blue','green','purple','pink','orange','red','teal','yellow','indigo','cyan','lime','rose'];

export function applyTheme(theme) {
  let eff = theme;
  if (theme === 'auto') eff = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = eff;
  localStorage.setItem('um_theme', theme);
}

export function applyAccent(accent) {
  document.documentElement.dataset.accent = accent;
  localStorage.setItem('um_accent', accent);
}

export function applyFontSize(size) {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem('um_fontSize', size);
}

export function initTheme() {
  applyTheme(localStorage.getItem('um_theme') || 'auto');
  applyAccent(localStorage.getItem('um_accent') || 'blue');
  applyFontSize(localStorage.getItem('um_fontSize') || 'm');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('um_theme') === 'auto') applyTheme('auto');
  });
}

export default { applyTheme, applyAccent, applyFontSize, initTheme };
