/* =====================================================================
   icon-style.js
   The "icon style kernel" — same shared-kernel shape as theme.js. Owns
   which of the two folder icon packs (assets/system/Icons/blue folders/
   or yellow folders/) is active, persists it, and applies it by
   dispatching os:icon-style-changed for anyone drawing a folder icon to
   re-render on (widget/app-grid, apps/file-explorer).

   Only "folder" is actually wired up to the UI right now — that's the
   only icon type currently drawn anywhere. PAIRS below maps every other
   icon in both packs to its counterpart in the other pack, so wiring up
   a new one later (a locked folder, say) is just PAIRS.lockedFolder plus
   a call to iconUrl(), not a new lookup table. The two packs aren't
   perfectly symmetric: blue's `favouriteFolder` (a star) and yellow's
   `smiley` don't look alike but are the same "type" of icon — that's a
   real pairing, not a mistake, called out where it's declared. `calendar`
   (blue) and `notes` (yellow) have no counterpart in the other pack at
   all, so they're left out of PAIRS — only usable via their own pack
   directly, not through the style-switching lookup.
   ===================================================================== */

const STORAGE_KEY = 'os-icon-style';
const DEFAULT_STYLE = 'yellow';

const STYLES = {
  yellow: { id: 'yellow', name: 'Yellow', dir: 'yellow folders' },
  blue: { id: 'blue', name: 'Blue', dir: 'blue folders' },
};

// logical icon name -> { blue: filename, yellow: filename }
const PAIRS = {
  folder: { blue: 'folder.png', yellow: 'folder.png' },
  gameFolder: { blue: 'game-folder.png', yellow: 'game-folder.png' },
  hardDriveFolder: { blue: 'hard-drive-folder.png', yellow: 'hard-drive.png' },
  imageFolder: { blue: 'image-file.png', yellow: 'photo-gallery.png' },
  lockedFolder: { blue: 'locked-folder.png', yellow: 'locked.png' },
  malwareFolder: { blue: 'malware.png', yellow: 'skull.png' },
  musicFolder: { blue: 'music.png', yellow: 'music-folder.png' },
  questionMarkFolder: { blue: 'question-mark.png', yellow: 'question-mark.png' },
  usbFolder: { blue: 'usb-flash.png', yellow: 'usb.png' },
  videoFolder: { blue: 'video-folder.png', yellow: 'video-folder.png' },
  favoriteFolder: { blue: 'favourite.png', yellow: 'like.png' },
  // not a typo — blue's star and yellow's smiley are the same "type" of
  // folder, just illustrated differently in each pack
  specialFolder: { blue: 'favourite-folder.png', yellow: 'smiley.png' },
};

function iconUrl(dir, filename) {
  return new URL(`../assets/system/Icons/${dir}/${filename}`, import.meta.url).href;
}

/** Every style, as {id, name, folderIcon} — for the Settings app to list. */
export function listIconStyles() {
  return Object.values(STYLES).map((s) => ({ id: s.id, name: s.name, folderIcon: iconUrl(s.dir, PAIRS.folder[s.id]) }));
}

export function getIconStyle() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  return STYLES[saved] ? saved : DEFAULT_STYLE;
}

export function setIconStyle(id) {
  if (!STYLES[id]) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable — the choice just won't persist across reloads
  }
  document.dispatchEvent(new CustomEvent('os:icon-style-changed', { detail: { id } }));
}

/** The current style's icon for a PAIRS entry (defaults to "folder"). */
export function styledIconUrl(name = 'folder') {
  const style = getIconStyle();
  return iconUrl(STYLES[style].dir, PAIRS[name][style]);
}

document.addEventListener('os:reset', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up if storage was never available
  }
});
