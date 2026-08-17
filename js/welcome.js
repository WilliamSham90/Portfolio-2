/* =====================================================================
   welcome.js
   Fires the one-time "Welcome to Williams OS" notification the first
   time this OS is ever opened in a browser. "First time" just means
   "not already in js/notifications.js's history" — no separate flag of
   its own to track that, and so no separate os:reset listener either:
   Reset Desktop already clears that whole history, which is what makes
   a reset genuinely return this to "brand new" too, not just visually.
   ===================================================================== */

import { notify, listHistory } from './notifications.js';

const MESSAGE = {
  id: 'welcome',
  title: 'Welcome to Williams OS',
  text: "This is William's portfolio site, come to life as a little desktop of its own. Feel free to browse, break things, and poke around — you can always reset the desktop from the right-click menu if you need a clean slate.",
};

export function initWelcome() {
  const alreadyShown = listHistory().some((entry) => entry.id === MESSAGE.id);
  if (!alreadyShown) notify(MESSAGE);
}
