/* =====================================================================
   password-dialog.js
   A themed password prompt — same Promise-based shape as
   confirm-dialog.js, and reuses its exact visual chrome (.confirm-dialog*
   in css/main.css) on a second dialog element, just with a password
   <input> and an optional inline error line added in.

   passwordDialog(message) resolves the entered password, or null if
   cancelled (Cancel, the backdrop, or Escape) — checking that password
   against anything is the caller's job (js/folders.js owns the one
   password this OS currently has, via unlockFolder()).
   ===================================================================== */

let els = null;
let resolveFn = null;

function getEls() {
  if (els) return els;

  const root = document.getElementById('password-dialog');
  els = {
    root,
    message: root.querySelector('.confirm-dialog-message'),
    input: root.querySelector('.password-dialog-input'),
    error: root.querySelector('.password-dialog-error'),
    confirmBtn: root.querySelector('.confirm-dialog-confirm'),
    cancelBtn: root.querySelector('.confirm-dialog-cancel'),
    backdrop: root.querySelector('.confirm-dialog-backdrop'),
  };

  els.confirmBtn.addEventListener('click', () => settle(els.input.value));
  els.cancelBtn.addEventListener('click', () => settle(null));
  els.backdrop.addEventListener('click', () => settle(null));
  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); settle(els.input.value); }
  });
  document.addEventListener('keydown', (event) => {
    if (root.hidden) return;
    if (event.key === 'Escape') settle(null);
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
 * @param {{error?: string}} [options]  an inline error to show (e.g. a previous wrong attempt)
 * @returns {Promise<string|null>}  the entered password, or null if cancelled
 */
export function passwordDialog(message, { error = null } = {}) {
  const { root, message: messageEl, input, error: errorEl } = getEls();

  // an unresolved prior dialog (shouldn't normally happen — only one can
  // be open at a time) is treated as cancelled rather than left dangling
  settle(null);

  messageEl.textContent = message;
  input.value = '';
  errorEl.textContent = error ?? '';
  errorEl.hidden = !error;
  root.hidden = false;
  input.focus();

  return new Promise((resolve) => {
    resolveFn = resolve;
  });
}
