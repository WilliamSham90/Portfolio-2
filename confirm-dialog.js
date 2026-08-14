/* =====================================================================
   confirm-dialog.js
   A themed stand-in for window.confirm() — same "small kernel module"
   shape as theme.js/folders.js/context-menu.js. Native confirm() works
   fine, but it's a jarring OS-chrome popup that doesn't fit this OS's
   own look, so destructive actions (deleting a folder, etc.) go through
   this instead.

   confirmDialog(message) returns a Promise<boolean> — true if the user
   confirmed, false if they cancelled (Cancel, the backdrop, or Escape).
   ===================================================================== */

let els = null;
let resolveFn = null;

function getEls() {
  if (els) return els;

  const root = document.getElementById('confirm-dialog');
  els = {
    root,
    message: root.querySelector('.confirm-dialog-message'),
    confirmBtn: root.querySelector('.confirm-dialog-confirm'),
    cancelBtn: root.querySelector('.confirm-dialog-cancel'),
    backdrop: root.querySelector('.confirm-dialog-backdrop'),
  };

  els.confirmBtn.addEventListener('click', () => settle(true));
  els.cancelBtn.addEventListener('click', () => settle(false));
  els.backdrop.addEventListener('click', () => settle(false));
  document.addEventListener('keydown', (event) => {
    if (root.hidden) return;
    if (event.key === 'Escape') settle(false);
  });

  return els;
}

function settle(result) {
  const { root } = getEls();
  if (root.hidden) return;
  root.hidden = true;
  const resolve = resolveFn;
  resolveFn = null;
  resolve?.(result);
}

/**
 * @param {string} message
 * @param {{confirmLabel?: string, cancelLabel?: string}} [options]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, { confirmLabel = 'Delete', cancelLabel = 'Cancel' } = {}) {
  const { root, message: messageEl, confirmBtn, cancelBtn } = getEls();

  // an unresolved prior dialog (shouldn't normally happen — only one can
  // be open at a time) is treated as cancelled rather than left dangling
  settle(false);

  messageEl.textContent = message;
  confirmBtn.textContent = confirmLabel;
  cancelBtn.textContent = cancelLabel;
  root.hidden = false;
  confirmBtn.focus();

  return new Promise((resolve) => {
    resolveFn = resolve;
  });
}
