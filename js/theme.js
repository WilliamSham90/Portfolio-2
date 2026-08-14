/* =====================================================================
   theme.js
   The "theme kernel". Owns the list of installed themes (each one just
   colors + a font, see /themes) and knows how to apply one to the page:
   every color becomes a CSS custom property on :root — the same ones
   main.css already declares as defaults — so every widget/app that was
   already written against var(--rose) etc. re-skins for free, with no
   changes needed anywhere else.

   Imported once by main.js, which calls initTheme() before anything
   else boots so the saved theme (or the default) is applied before the
   first widget mounts.
   ===================================================================== */

import dialUpDream from '../themes/dial-up-dream.js';
import millenniumBrick from '../themes/millennium-brick.js';
import fatedDusk from '../themes/fated-dusk.js';
import redOctober from '../themes/red-october.js';
import paradiseProtocol from '../themes/paradise-protocol.js';
import krystalCore from '../themes/krystal-core.js';

const THEMES = [dialUpDream, millenniumBrick, fatedDusk, redOctober, paradiseProtocol, krystalCore];
const DEFAULT_THEME_ID = dialUpDream.id;
const STORAGE_KEY = 'os-theme';

// theme.colors keys -> the CSS custom property each one drives.
// (matches the tokens main.css already declares in :root)
const COLOR_VARS = {
  pearl: '--pearl',
  rose: '--rose',
  hotrose: '--hotrose',
  aqua: '--aqua',
  lilac: '--lilac',
  text: '--text',
  textSoft: '--text-soft',
  textMuted: '--text-muted',
  textDark: '--text-dark',
  paper: '--paper',
  paperText: '--paper-text',
  border: '--border',
  borderBright: '--border-bright',
  btnBg: '--btn-bg',
  btnBg2: '--btn-bg2',
  btnBg3: '--btn-bg3',
  btnText: '--btn-text',
  winBg: '--win-bg',
  winTitle: '--win-title',
  winText: '--win-text',
  wrapA: '--wrap-a',
  wrapB: '--wrap-b',
  wrapC: '--wrap-c',
};

// these five also get a "-rgb" companion var (e.g. --hotrose-rgb: "238, 178, 74")
// so gradients/glows can use rgba(var(--hotrose-rgb), 0.3) instead of a literal.
const RGB_ROLES = ['pearl', 'rose', 'hotrose', 'aqua', 'lilac'];

/** Every theme, as {id, name, colors, fonts} — for the Themes app to list. */
export function listThemes() {
  return THEMES.map((t) => ({ id: t.id, name: t.name, colors: t.colors, fonts: t.fonts }));
}

export function getActiveThemeId() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  return THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME_ID;
}

/** Applies the saved (or default) theme, then listens for switches. */
export function initTheme() {
  applyTheme(getActiveThemeId());
  document.addEventListener('os:set-theme', (event) => applyTheme(event.detail.id));
}

function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID);
  const root = document.documentElement.style;

  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    const value = theme.colors[key];
    root.setProperty(cssVar, value);
    if (RGB_ROLES.includes(key)) {
      root.setProperty(`${cssVar}-rgb`, hexToRgbTriplet(value));
    }
  }

  const fontStack = `'${theme.fonts.display.family}', ${theme.fonts.display.fallback}`;
  root.setProperty('--font-main', fontStack);
  root.setProperty('--font-accent', fontStack);

  document.documentElement.dataset.theme = theme.id;

  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // storage unavailable — the choice just won't persist across reloads
  }

  document.dispatchEvent(new CustomEvent('os:theme-changed', { detail: { id: theme.id } }));
}

function hexToRgbTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
