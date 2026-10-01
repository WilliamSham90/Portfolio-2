/* =====================================================================
   start-menu.js
   The taskbar's start button + its dropdown — the apps main.js lists, and
   Power off at the bottom. `items` is passed in by main.js (rather than
   imported back from it) purely to avoid a circular import between the
   two modules; same reason widget/app-grid receives it as an init() arg
   instead of importing main.js itself. An item is an app, or
   {folderId} for a desktop folder (Games), which opens like its icon does.
   ===================================================================== */

import { shutDown } from './power.js';
import { confirmDialog } from './confirm-dialog.js';
import { isImageIcon } from './icon.js';
import { getFolder } from './folders.js';
import { styledIconUrl } from './icon-style.js';

export function initStartMenu(items) {
  const button = document.getElementById('start-button');
  const menu = document.getElementById('start-menu');
  const appsList = menu.querySelector('.start-menu-apps');
  const powerButton = menu.querySelector('.start-menu-power');

  // built every time the menu opens, not once at boot, so a folder entry
  // always matches the folder itself — renamed, re-iconed by the Icon
  // Style setting, or left out entirely once it's been deleted
  function renderItems() {
    appsList.replaceChildren(...items.flatMap((item) => {
      if (!item.folderId) return [menuItem(item.icon, item.name, 'os:launch-app', item.id)];
      const folder = getFolder(item.folderId);
      return folder ? [menuItem(styledIconUrl(folder.icon || 'folder'), folder.name, 'os:open-folder', folder.id)] : [];
    }));
  }

  function menuItem(icon, name, eventName, id) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'start-menu-app';
    const iconHtml = isImageIcon(icon)
      ? `<img class="start-menu-app-icon start-menu-app-icon-img icon-glow" src="${icon}" alt="" draggable="false">`
      : `<span class="start-menu-app-icon">${icon}</span>`;
    item.innerHTML = `${iconHtml}<span class="start-menu-app-name"></span>`;
    item.querySelector('.start-menu-app-name').textContent = name; // a folder name is user-typed
    item.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(eventName, { detail: { id } }));
      hide();
    });
    return item;
  }

  powerButton.addEventListener('click', async () => {
    hide();
    const ok = await confirmDialog('Shut down?', { confirmLabel: 'Shut Down' });
    if (ok) shutDown();
  });

  button.addEventListener('click', (event) => {
    event.stopPropagation(); // don't let this same click immediately close it via the outside-click listener below
    menu.hidden ? show() : hide();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== button) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  function show() {
    renderItems();
    menu.hidden = false;
    button.classList.add('is-active');
  }
  function hide() {
    menu.hidden = true;
    button.classList.remove('is-active');
  }
}
