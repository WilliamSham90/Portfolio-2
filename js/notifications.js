/* =====================================================================
   notifications.js
   A small notification center: notify({id, title, text}) shows a toast,
   top-right, and records it into a persisted history list — the
   taskbar's bell button lists that history, and clicking a past entry
   there just shows that same toast again (showToast()), it doesn't add
   a new history entry, since it's the same notification recurring, not
   a new occurrence of it. js/welcome.js is the one thing that calls
   notify() so far; anything else that wants to notify the user later
   goes through this same module rather than rolling its own toast.

   The toast itself only ever closes when its own ✕ is clicked — no
   auto-dismiss timer. A real user was closing it themselves before it
   had a chance to actually be read, so the "helpful" auto-hide was
   actively working against the one thing a greeting is for.
   ===================================================================== */

const STORAGE_KEY = 'os-notification-history';

let toast, titleEl, textEl;
let hideTimer = null; // only ever guards the closing *transition* now — see the module comment on why there's no auto-dismiss timer

export function initNotifications() {
  toast = document.getElementById('notification-toast');
  titleEl = toast.querySelector('.notification-toast-title');
  textEl = toast.querySelector('.notification-toast-text');
  toast.querySelector('.notification-toast-close').addEventListener('click', hideToast);

  const button = document.getElementById('notification-history-button');
  const menu = document.getElementById('notification-history-menu');
  const list = menu.querySelector('.notification-history-list');
  const emptyHint = menu.querySelector('.notification-history-empty');

  function renderMenu() {
    const history = listHistory();
    emptyHint.hidden = history.length > 0;
    list.replaceChildren(...history.map((entry) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'notification-history-item';
      const when = new Date(entry.shownAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      item.innerHTML = `
        <span class="notification-history-item-title">${entry.title}</span>
        <span class="notification-history-item-time">${when}</span>
      `;
      item.addEventListener('click', () => {
        showToast(entry.title, entry.text);
        hideMenu();
      });

      // sibling of item rather than nested inside it (buttons can't nest) —
      // same shape as taskbar.js's .taskbar-group-row/-close
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'notification-history-remove';
      removeBtn.setAttribute('aria-label', `Remove ${entry.title} from history`);
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeFromHistory(entry.id);
        renderMenu();
      });

      const row = document.createElement('div');
      row.className = 'notification-history-row';
      row.append(item, removeBtn);
      return row;
    }));
  }

  function showMenu() {
    renderMenu();
    menu.hidden = false;
    button.classList.add('is-active');
  }
  function hideMenu() {
    menu.hidden = true;
    button.classList.remove('is-active');
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden ? showMenu() : hideMenu();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== button) hideMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideMenu();
  });

  document.addEventListener('os:reset', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clean up if storage was never available
    }
  });
}

function hideToast() {
  toast.classList.remove('is-open');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { toast.hidden = true; }, 300); // lets the slide-out transition actually play before it leaves the a11y tree
}

function showToast(title, text) {
  titleEl.textContent = title;
  textEl.textContent = text;
  clearTimeout(hideTimer); // in case a previous close's hide-after-transition timer is still pending
  toast.hidden = false;
  void toast.offsetWidth; // force reflow before the transition, same trick power.js/clock-panel.js use
  toast.classList.add('is-open');
}

/** Shows a notification and records it in history. */
export function notify({ id, title, text }) {
  showToast(title, text);
  const history = listHistory().filter((n) => n.id !== id); // de-duped by id — a later occurrence just moves it, doesn't stack a duplicate
  history.push({ id, title, text, shownAt: Date.now() });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — history just won't persist across reloads
  }
}

/** Every notification that's ever fired, oldest first — for callers like
 *  js/welcome.js that only want to know "has this already happened". */
export function listHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Deletes one entry from the history list (the bell menu's per-row ✕) —
 *  doesn't touch whatever toast is currently showing, if any. */
function removeFromHistory(id) {
  const history = listHistory().filter((n) => n.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — nothing to persist
  }
}
