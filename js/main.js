/* =====================================================================
   main.js
   The "kernel". Holds the list of installed apps and wires the OS
   shell together. To add a new app later: drop a folder in /apps/
   (index.html + index.css + index.js) and add one line to APPS below.
   ===================================================================== */

import { loadWidget } from './loader.js';
import { initTheme } from './theme.js';
import { initContextMenu } from './context-menu.js';
import { initStartMenu } from './start-menu.js';
import { initPower } from './power.js';
import { initClockPanel } from './clock-panel.js';
import { isImageIcon } from './icon.js';

function icon(filename) {
  return new URL(`../assets/system/Icons/basic/${filename}`, import.meta.url).href;
}

// placeholder icon for apps that don't have a real one yet — see
// README.md > "Adding a new app later"
const APP_ICON = icon('add.png');
const BROWSER_ICON = icon('earth.png');
const SETTINGS_ICON = icon('settings.png');
const COMPUTER_ICON = icon('computer-storage.png');

export const APPS = [
  { id: 'hello-world', name: 'Hello There', icon: APP_ICON, path: './apps/hello-world/' },
  { id: 'settings', name: 'Settings', icon: SETTINGS_ICON, path: './apps/themes/' },
  { id: 'my-computer', name: 'My Computer', icon: COMPUTER_ICON, path: './apps/file-explorer/' },
  { id: 'browser', name: 'Browser', icon: BROWSER_ICON, path: './apps/browser/' },
  // { id: 'next-app', name: 'Next App', icon: '✨', path: './apps/next-app/' },
];

// not a desktop icon or a Start Menu entry — only ever opened from the
// clock area's "..." button (see initSystemInfo below) — so it lives
// outside APPS rather than in it.
const SYSTEM_INFO_APP = { id: 'system-info', name: 'System Info', icon: icon('menu.png'), path: './apps/system-info/' };

// tracks every currently-open window: popup root element -> its taskbar tab
const openWindows = new Map();

async function boot() {
  // 0. apply the saved (or default) theme before anything else mounts,
  //    so widgets never render with the wrong colors for a frame
  initTheme();
  initContextMenu();
  initPower();
  initStartMenu(APPS);

  // 1. mount the icon grid widget, handing it the app list to render
  const gridRoot = document.getElementById('app-grid-root');
  await loadWidget('./widget/app-grid/', gridRoot, { initArgs: [APPS] });

  // 2. whenever an icon is clicked, the app-grid widget fires this event
  document.addEventListener('os:launch-app', (event) => {
    const app = APPS.find((a) => a.id === event.detail.id);
    if (app) openApp(app);
  });

  // whenever a folder icon is clicked, open My Computer's app (the File
  // Explorer) straight into that folder instead of its default root view
  document.addEventListener('os:open-folder', (event) => {
    const app = APPS.find((a) => a.id === 'my-computer');
    if (app) openApp(app, [event.detail.id]);
  });

  // 3. a popup tells us whenever it's been clicked/focused, so we can
  //    highlight the matching taskbar tab
  document.addEventListener('popup:activated', (event) => {
    setActiveTab(event.target);
  });

  // ...and whenever it's been minimized/restored, so its tab can dim itself
  document.addEventListener('popup:minimized', (event) => {
    const tab = openWindows.get(event.target);
    if (!tab) return;
    tab.classList.toggle('is-minimized', event.detail.minimized);
    if (event.detail.minimized) tab.classList.remove('is-active');
  });

  // 4. taskbar clock + its slide-in date/calendar panel
  initClockPanel();

  // 5. the "..." button next to the clock opens the System Info window —
  //    not a real desktop/Start Menu app (see SYSTEM_INFO_APP above), so
  //    it's opened directly rather than going through os:launch-app
  document.getElementById('system-info-button').addEventListener('click', () => {
    openApp(SYSTEM_INFO_APP);
  });
}

let openCount = 0;

/**
 * Opens an app window. Exported so other modules can launch one that
 * isn't necessarily in APPS/on the desktop — e.g. apps/file-explorer
 * opening apps/media-viewer when an image is clicked.
 */
export async function openApp(app, appInitArgs = []) {
  const popupLayer = document.getElementById('popup-layer');

  // each open app gets its own popup instance, offset slightly so
  // opening several at once doesn't stack them exactly on top of each other
  const offset = (openCount++ % 6) * 28;

  const { root } = await loadWidget('./widget/popup/', popupLayer, {
    multiple: true,
    initArgs: [app, offset, appInitArgs],
  });

  const tab = createTaskbarTab(app, root);
  openWindows.set(root, tab);
  setActiveTab(root);

  // if the user closes the window, clean up both its DOM node and its tab
  root.addEventListener('popup:closed', () => {
    root.remove();
    tab.remove();
    openWindows.delete(root);
  }, { once: true });
}

function createTaskbarTab(app, popupRoot) {
  const tabs = document.getElementById('taskbar-tabs');

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'taskbar-tab';
  const iconHtml = isImageIcon(app.icon)
    ? `<img class="taskbar-tab-icon taskbar-tab-icon-img icon-glow" src="${app.icon}" alt="" draggable="false">`
    : `<span class="taskbar-tab-icon">${app.icon}</span>`;
  tab.innerHTML = `${iconHtml}<span class="taskbar-tab-label">${app.name}</span>`;

  // clicking the tab for a minimized (or already-active) window toggles it
  // minimized/restored; otherwise it just brings that window to front
  tab.addEventListener('click', () => {
    if (tab.classList.contains('is-minimized') || tab.classList.contains('is-active')) {
      popupRoot.dispatchEvent(new CustomEvent('popup:toggle-minimize'));
    } else {
      popupRoot.dispatchEvent(new CustomEvent('popup:focus'));
    }
  });

  tabs.appendChild(tab);
  return tab;
}

function setActiveTab(activeRoot) {
  for (const [root, tab] of openWindows) {
    tab.classList.toggle('is-active', root === activeRoot);
  }
}

boot();
