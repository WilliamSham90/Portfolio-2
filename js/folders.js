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
// which DEFAULT_FOLDERS / DEFAULT_FILINGS this browser has already been
// given — see load()
const SEEDED_KEY = 'os-folders-seeded';
const LOCKED_FOLDER_PASSWORD = '12345678';

// folders every fresh desktop starts with (and gets back after a Reset) —
// everything else about them (rename, delete, file an app into them)
// works exactly like a folder the user created themselves, this is just
// their starting name/icon/appIds. Once anything folder-related is saved
// (including just unlocking "Locked"), that saved list is the only truth
// from then on, so deleting one of these for real actually sticks.
// Games' appIds are js/main.js's GAMES ids.
const DEFAULT_FOLDERS = [
  { id: 'folder-locked', name: 'Locked', appIds: [], icon: 'lockedFolder', locked: true, unlocked: false },
  { id: 'folder-malware', name: 'Malware', appIds: ['not-a-virus'], icon: 'malwareFolder' },
  { id: 'folder-games', name: 'Games', appIds: ['alien-hominid', 'fleeing-the-complex', 'pac-man', 'impossible-quiz'], icon: 'gameFolder' },
];
// apps filed into a default folder *after* that folder first shipped — so a
// returning visitor, who already has the folder saved, still gets them
// filed (once) rather than finding them loose on the desktop
const DEFAULT_FILINGS = [
  { folderId: 'folder-malware', appId: 'not-a-virus' },
];
const filingKey = ({ folderId, appId }) => `${folderId}/${appId}`;
// a saved list from before SEEDED_KEY existed has already had these two
const LEGACY_SEEDED = ['folder-locked', 'folder-malware'];

// part of the desktop's right-click "Reset" flow (context-menu.js) — the
// page gets reloaded right after, so this just needs to stop persisting,
// not re-render anything itself
document.addEventListener('os:reset', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEEDED_KEY);
  } catch {
    // nothing to clean up if storage was never available
  }
});

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null; // storage unavailable, or not valid JSON
  }
}

function load() {
  const saved = readJson(STORAGE_KEY);
  if (saved === null) return DEFAULT_FOLDERS.map((f) => ({ ...f })); // first ever visit, or since the last Reset
  const folders = Array.isArray(saved) ? saved : [];

  // a default folder added after this browser's list was first saved (Games)
  // would otherwise never reach a returning visitor — hand it over once;
  // save() then records it as given, so deleting it afterwards still sticks
  const seeded = readJson(SEEDED_KEY);
  const given = Array.isArray(seeded) ? seeded : LEGACY_SEEDED;
  for (const f of DEFAULT_FOLDERS) {
    if (!given.includes(f.id) && !folders.some((x) => x.id === f.id)) folders.push({ ...f });
  }
  // same idea for an app added to a folder they already have — skipped if
  // that folder's been deleted, or the app's already filed somewhere
  for (const filing of DEFAULT_FILINGS) {
    if (given.includes(filingKey(filing)) || folders.some((f) => f.appIds.includes(filing.appId))) continue;
    folders.find((f) => f.id === filing.folderId)?.appIds.push(filing.appId);
  }
  return folders;
}

function save(folders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    localStorage.setItem(SEEDED_KEY, JSON.stringify([...DEFAULT_FOLDERS.map((f) => f.id), ...DEFAULT_FILINGS.map(filingKey)]));
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
