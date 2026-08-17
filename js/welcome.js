/* =====================================================================
   welcome.js
   A one-time greeting toast, top-right — shown the first time this OS
   is ever opened in a browser, and again any time "Reset Desktop" wipes
   it back to that state. Both are the same check: os:reset clears
   STORAGE_KEY the same way every other piece of first-run/persisted
   state clears its own on reset (js/theme.js, js/folders.js, ...), so a
   reset genuinely returns this to "brand new" too, not just visually —
   there's nothing here that specifically detects "was this a reset" vs.
   "is this a real first visit", because there doesn't need to be one.
   ===================================================================== */

const STORAGE_KEY = 'os-welcomed';
const AUTO_DISMISS_MS = 9000;

export function initWelcome() {
  const toast = document.getElementById('welcome-toast');
  const closeBtn = toast.querySelector('.welcome-toast-close');

  document.addEventListener('os:reset', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clean up if storage was never available
    }
  });

  let alreadySeen = false;
  try {
    alreadySeen = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    alreadySeen = false; // no storage — show it every visit rather than never
  }
  if (alreadySeen) return;

  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // storage unavailable — it'll just show again next visit, harmless
  }

  let hideTimer = null;
  const hide = () => {
    toast.classList.remove('is-open');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { toast.hidden = true; }, 300); // matches the CSS transition duration
  };

  closeBtn.addEventListener('click', hide);
  hideTimer = setTimeout(hide, AUTO_DISMISS_MS);

  toast.hidden = false;
  void toast.offsetWidth; // force reflow before the transition, same trick power.js/clock-panel.js use
  toast.classList.add('is-open');
}
