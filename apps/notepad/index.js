/* =====================================================================
   notepad/index.js
   A single always-there note, not a multi-file editor — "New" or
   "Open" would need a virtual filesystem this OS doesn't have (folders
   only hold *apps*, see js/folders.js), and that's real scope this app
   deliberately doesn't take on. Typing autosaves nothing (explicit Save
   only — an unsaved edit is genuinely lost if you never save it, same as
   a real text editor, not a silent surprise); closing with unsaved
   changes asks first, via the beforeClose() this file returns from
   init() — see widget/popup/index.js for the other half of that contract.

   `note.content`, if given, is a placeholder for a real future feature —
   the File Explorer opening a .txt file straight into this editor,
   the same way it already opens images into apps/media-viewer — not
   wired to anything yet since there's no .txt entry in assets/manifest.js
   to open from. Left in now because it costs nothing to accept and saves
   a signature change later.
   ===================================================================== */

import { confirmDialog } from '../../js/confirm-dialog.js';

const STORAGE_KEY = 'os-notepad';

/**
 * @param {HTMLElement} container
 * @param {{content?: string}} [note]
 * @returns {{beforeClose: () => Promise<boolean>}}
 */
export function init(container, note) {
  const textEl = container.querySelector('.notepad-text');
  const saveBtn = container.querySelector('.notepad-save');
  const statusEl = container.querySelector('.notepad-status');
  const titleEl = container.closest('.popup-window')?.querySelector('.popup-title');

  textEl.value = note?.content ?? load();
  let dirty = false;
  setStatus(false);

  function setStatus(isDirty) {
    dirty = isDirty;
    statusEl.textContent = dirty ? 'Unsaved changes' : 'Saved';
    // same "reach up to its own window chrome" apps/media-viewer already
    // does to rename its title — a dot here is the one place a visual
    // "you have unsaved changes" cue is genuinely useful even when the
    // toolbar status text isn't in view (a maximized or scrolled window)
    if (titleEl) titleEl.textContent = `Notepad${dirty ? ' •' : ''}`;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, textEl.value);
    } catch {
      // storage unavailable — the note just won't persist across reloads
    }
    setStatus(false);
  }

  textEl.addEventListener('input', () => setStatus(true));
  saveBtn.addEventListener('click', save);

  document.addEventListener('os:reset', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clean up if storage was never available
    }
  });

  return {
    async beforeClose() {
      if (!dirty) return true;
      const shouldSave = await confirmDialog('Save changes to this note before closing?', {
        confirmLabel: 'Save',
        cancelLabel: "Don't Save",
      });
      if (shouldSave) save();
      return true; // either choice closes the window — Save just saves first
    },
  };
}

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}
