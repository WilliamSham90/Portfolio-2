/* =====================================================================
   folders.js
   Desktop folders are virtual — this site is static (no backend), so a
   "folder" can't be a real directory the OS creates on disk. Instead a
   folder is just {id, name, appIds}, plus two optional fields most
   folders don't have: `icon` (a js/icon-style.js PAIRS name, for a folder
   that shouldn't use the plain generic folder icon — see DEFAULT_FOLDERS
   below) and `locked`/`unlocked` (see unlockFolder()). This module is the
   single source of truth for that list (localStorage-backed, same
   pattern as theme.js), read by widget/app-grid (to draw folders as
   desktop icons) and apps/file-explorer (to browse/create/empty them).
   Which actual icon *file* gets drawn for a given `icon` name still
   depends on the user's chosen icon style (blue/yellow), resolved via
   js/icon-style.js's styledIconUrl() — not this module's concern.

   Any change here dispatches os:folders-changed on document, so every
   open window that cares (the desktop, any File Explorer window) can
   re-render itself.
   ===================================================================== */

const STORAGE_KEY = 'os-folders';
const LOCKED_FOLDER_PASSWORD = '12345678';

// two folders every fresh desktop starts with (and gets back after a
// Reset) — everything else about them (rename, delete, file an app into
// them) works exactly like a folder the user created themselves, this is
// just their starting name/icon/appIds. Only returned by load() below
// when nothing's been saved yet; once anything folder-related is saved
// (including just unlocking "Locked"), that saved list is the only truth
// from then on, so deleting one of these for real actually sticks.
const DEFAULT_FOLDERS = [
  { id: 'folder-locked', name: 'Locked', appIds: [], icon: 'lockedFolder', locked: true, unlocked: false },
  { id: 'folder-malware', name: 'Malware', appIds: [], icon: 'malwareFolder' },
];

// part of the desktop's right-click "Reset" flow (context-menu.js) — the
// page gets reloaded right after, so this just needs to stop persisting,
// not re-render anything itself
document.addEventListener('os:reset', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up if storage was never available
  }
});

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === null) return DEFAULT_FOLDERS.map((f) => ({ ...f })); // first ever visit, or since the last Reset

  try {
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function save(folders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // storage unavailable — folders just won't persist across reloads
  }
  document.dispatchEvent(new CustomEvent('os:folders-changed'));
}

/** Every folder, as {id, name, appIds}. */
export function listFolders() {
  return load();
}

export function getFolder(id) {
  return load().find((f) => f.id === id) ?? null;
}

/** Creates a new, empty folder ("New Folder", "New Folder 2", ...) and returns it. */
export function createFolder() {
  const folders = load();
  const taken = new Set(folders.map((f) => f.name));
  let name = 'New Folder';
  for (let n = 2; taken.has(name); n++) name = `New Folder ${n}`;

  const folder = {
    id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    appIds: [],
  };
  folders.push(folder);
  save(folders);
  return folder;
}

/** Renames a folder. Empty/unchanged names are ignored (caller decides what "empty" means). */
export function renameFolder(id, name) {
  const folders = load();
  const folder = folders.find((f) => f.id === id);
  const trimmed = name.trim();
  if (!folder || !trimmed || trimmed === folder.name) return;
  folder.name = trimmed;
  save(folders);
}

/**
 * Deletes a folder. Anything filed inside it isn't touched or lost — it
 * just stops being excluded from the desktop (see visibleItems() in
 * widget/app-grid), so it reappears there on its own, no extra step needed.
 */
export function deleteFolder(id) {
  const folders = load();
  const next = folders.filter((f) => f.id !== id);
  if (next.length === folders.length) return;
  save(next);
}

/** Moves an app off the desktop and into a folder. */
export function fileAppIntoFolder(appId, folderId) {
  const folders = load();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder || folder.appIds.includes(appId)) return;
  folder.appIds.push(appId);
  save(folders);
}

/** Moves an app back out of a folder and onto the desktop. */
export function removeAppFromFolder(appId, folderId) {
  const folders = load();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return;
  const next = folder.appIds.filter((id) => id !== appId);
  if (next.length === folder.appIds.length) return;
  folder.appIds = next;
  save(folders);
}

/**
 * Checks a password against a locked folder and, if it matches, remembers
 * that this folder is unlocked from now on (persisted — a correct
 * password only has to be entered once, not once per visit). Wrong
 * password, or a folder that isn't locked at all: no-op, returns false.
 */
export function unlockFolder(id, password) {
  if (password !== LOCKED_FOLDER_PASSWORD) return false;
  const folders = load();
  const folder = folders.find((f) => f.id === id);
  if (!folder || !folder.locked) return false;
  folder.unlocked = true;
  save(folders);
  return true;
}
