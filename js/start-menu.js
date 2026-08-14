/* =====================================================================
   start-menu.js
   The taskbar's start button + its dropdown — every installed app, and
   Power off at the bottom. `apps` is passed in by main.js (rather than
   imported back from it) purely to avoid a circular import between the
   two modules; same reason widget/app-grid receives it as an init() arg
   instead of importing main.js itself.
   ===================================================================== */

import { shutDown } from './power.js';
import { confirmDialog } from './confirm-dialog.js';
import { isImageIcon } from './icon.js';

export function initStartMenu(apps) {
  const button = document.getElementById('start-button');
  const menu = document.getElementById('start-menu');
  const appsList = menu.querySelector('.start-menu-apps');
  const powerButton = menu.querySelector('.start-menu-power');

  for (const app of apps) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'start-menu-app';
    const iconHtml = isImageIcon(app.icon)
      ? `<img class="start-menu-app-icon start-menu-app-icon-img icon-glow" src="${app.icon}" alt="" draggable="false">`
      : `<span class="start-menu-app-icon">${app.icon}</span>`;
    item.innerHTML = `${iconHtml}<span class="start-menu-app-name">${app.name}</span>`;
    item.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id: app.id } }));
      hide();
    });
    appsList.appendChild(item);
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
    menu.hidden = false;
    button.classList.add('is-active');
  }
  function hide() {
    menu.hidden = true;
    button.classList.remove('is-active');
  }
}
