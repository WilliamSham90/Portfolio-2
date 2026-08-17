/* =====================================================================
   notepad/index.js
   A blank page every time it opens — no persistence of its own, on
   purpose. "Save" downloads the current text as a real .txt file to the
   visitor's own computer (js/download-file.js). Closing with unsaved
   text prompts first, via the beforeClose() this file returns from
   init() — see widget/popup/index.js for the other half of that
   contract — and the toolbar Save button prompts too, before it
   downloads anything.

   `note`, if given, is a placeholder for a real future feature — the
   File Explorer opening a .txt file straight into this editor, the same
   way it already opens images into apps/media-viewer — not wired to
   anything yet since there's no .txt entry in assets/manifest.js to open
   from. Left in now because it costs nothing to accept and saves a
   signature change later; once it is wired up, note.name becomes the
   default download filename too, not just the starting content, so
   editing and re-saving an opened file offers back its own name.
   ===================================================================== */

import { confirmDialog } from '../../js/confirm-dialog.js';
import { downloadFile } from '../../js/download-file.js';

const DEFAULT_FILE_NAME = 'note.txt';

/**
 * @param {HTMLElement} container
 * @param {{name?: string, content?: string}} [note]
 * @returns {{beforeClose: () => Promise<boolean>}}
 */
export function init(container, note) {
  const textEl = container.querySelector('.notepad-text');
  const saveBtn = container.querySelector('.notepad-save');
  const statusEl = container.querySelector('.notepad-status');
  const titleEl = container.closest('.popup-window')?.querySelector('.popup-title');

  const fileName = note?.name ?? DEFAULT_FILE_NAME;
  textEl.value = note?.content ?? '';
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
    const blob = new Blob([textEl.value], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, fileName);
    // there's no callback confirming the download actually completed —
    // this counts it as saved the moment it's triggered, see download-file.js
    setStatus(false);
  }

  textEl.addEventListener('input', () => setStatus(true));
  saveBtn.addEventListener('click', async () => {
    // confirms before the toolbar button downloads anything — the
    // beforeClose prompt below doesn't need this same confirmation on top
    // of its own, since choosing "Save" there already *is* the deliberate
    // choice this dialog exists to check for
    const proceed = await confirmDialog(`Save this note as "${fileName}" to your computer?`, {
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
    });
    if (proceed) save();
  });

  return {
    async beforeClose() {
      if (!dirty) return true;
      const shouldSave = await confirmDialog('Save this note as a .txt file before closing?', {
        confirmLabel: 'Save',
        cancelLabel: "Don't Save",
      });
      if (shouldSave) save();
      return true; // either choice closes the window — Save just downloads it first
    },
  };
}
