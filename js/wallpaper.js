/* =====================================================================
   wallpaper.js
   The "wallpaper kernel" — same shared-kernel shape as theme.js/
   icon-style.js. Owns which desktop background photo (if any) is active,
   persists it, and applies it by setting one CSS custom property
   (--wallpaper-image) that #desktop-wallpaper (css/main.css) already
   reads — so applying a choice is just that one setProperty() call, not
   a DOM rebuild.

   "None" (the default look — the theme's own gradient, see
   --desktop-gradient in main.css) is a real entry in WALLPAPERS, not a
   special case threaded through every function here, so the Settings
   list/apply/persist code never needs to know it's different from a
   photo — it's just the one entry whose `file` is null.

   Loaded once, stays loaded: the URL for a given wallpaper is always
   built the same way (iconUrl()-style, off import.meta.url, no
   cache-busting query string), so setting --wallpaper-image to a choice
   that's already showing — or was showing earlier this session — is a
   cache hit, never a second network fetch. Nothing here needs to track
   "is it already loaded" itself; that's just what a stable URL gets you
   for free from the browser's own HTTP cache.
   ===================================================================== */

const STORAGE_KEY = 'os-wallpaper';
const DEFAULT_WALLPAPER_ID = 'city-night';

// id -> { name, file } — file is null for "None" (the theme's own gradient)
const WALLPAPERS = {
  none: { name: 'None (Default)', file: null },
  'city-night': { name: 'City Night', file: 'City Night.webp' },
  beach: { name: 'Beach', file: 'beach.webp' },
  flamingo: { name: 'Flamingo', file: 'Flamingo.webp' },
  flowers: { name: 'Flowers', file: 'Flowers.webp' },
  'japan-city': { name: 'Japan City', file: 'JapanCity.webp' },
  jungle: { name: 'Jungle', file: 'Jungle.webp' },
  mountain: { name: 'Mountain', file: 'Mountain.webp' },
  nature: { name: 'Nature', file: 'Nature.webp' },
  'trail-walk': { name: 'Trail Walk', file: 'Trail walk.webp' },
  train: { name: 'Train', file: 'Train.webp' },
  winter: { name: 'Winter', file: 'Winter.webp' },
};

function wallpaperUrl(file) {
  return new URL(`../assets/images/Background Images/${file}`, import.meta.url).href;
}

/** Every wallpaper, as {id, name, url} — url is null for "None". */
export function listWallpapers() {
  return Object.entries(WALLPAPERS).map(([id, w]) => ({
    id,
    name: w.name,
    url: w.file ? wallpaperUrl(w.file) : null,
  }));
}

export function getWallpaperId() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  return WALLPAPERS[saved] ? saved : DEFAULT_WALLPAPER_ID;
}

export function setWallpaper(id) {
  if (!WALLPAPERS[id]) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable — the choice just won't persist across reloads
  }
  applyWallpaper(id);
  document.dispatchEvent(new CustomEvent('os:wallpaper-changed', { detail: { id } }));
}

/** Applies the saved (or default) wallpaper, then listens for os:reset. */
export function initWallpaper() {
  applyWallpaper(getWallpaperId());
  document.addEventListener('os:reset', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clean up if storage was never available
    }
  });
}

function applyWallpaper(id) {
  const wallpaper = WALLPAPERS[id];
  const value = wallpaper.file ? `url("${wallpaperUrl(wallpaper.file)}")` : 'none';
  document.documentElement.style.setProperty('--wallpaper-image', value);
}
