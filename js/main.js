/* =====================================================================
   main.js
   The "kernel". Holds the list of installed apps and wires the OS
   shell together. To add a new app later: drop a folder in /apps/
   (index.html + index.css + index.js) and add one line to APPS below.
   ===================================================================== */

import { loadWidget } from './loader.js';
import { initTheme } from './theme.js';
import { initWallpaper } from './wallpaper.js';
import { initContextMenu } from './context-menu.js';
import { initStartMenu } from './start-menu.js';
import { initPower } from './power.js';
import { initClockPanel } from './clock-panel.js';
import { initTaskbar, registerWindow } from './taskbar.js';

function icon(filename) {
  return new URL(`../assets/system/Icons/basic/${filename}`, import.meta.url).href;
}

const BROWSER_ICON = icon('earth.png');
const SETTINGS_ICON = icon('settings.png');
const COMPUTER_ICON = icon('computer-storage.png');
const CALCULATOR_ICON = icon('calculator.png');
const NOTEPAD_ICON = icon('notes.png');

export const APPS = [
  { id: 'my-computer', name: 'My Computer', icon: COMPUTER_ICON, path: './apps/file-explorer/' },
  { id: 'browser', name: 'Browser', icon: BROWSER_ICON, path: './apps/browser/' },
  { id: 'settings', name: 'Settings', icon: SETTINGS_ICON, path: './apps/themes/' },
  { id: 'calculator', name: 'Calculator', icon: CALCULATOR_ICON, path: './apps/calculator/' },
  { id: 'notepad', name: 'Notepad', icon: NOTEPAD_ICON, path: './apps/notepad/' },
  // { id: 'next-app', name: 'Next App', icon: '✨', path: './apps/next-app/' },
];

// not a desktop icon — only reachable from the Start Menu — so it lives
// outside APPS (which also drives the desktop grid) rather than in it.
const SYSTEM_INFO_APP = { id: 'system-info', name: 'System Info', icon: icon('information.png'), path: './apps/system-info/' };

// every app os:launch-app might need to resolve an id back to, whether or
// not it's also a desktop icon (APPS)
const ALL_APPS = [...APPS, SYSTEM_INFO_APP];

// the Start Menu shows a curated, specifically-ordered subset of ALL_APPS
// rather than APPS itself — this exact list/order was requested directly,
// so a desktop-only app like Calculator stays off it unless asked for
const START_MENU_APPS = ['my-computer', 'browser', 'settings', 'system-info']
  .map((id) => ALL_APPS.find((a) => a.id === id));

async function boot() {
  // 0. apply the saved (or default) theme/wallpaper before anything else
  //    mounts, so widgets never render with the wrong colors for a frame
  initTheme();
  initWallpaper();
  initContextMenu();
  initPower();
  initStartMenu(START_MENU_APPS);
  initTaskbar();

  // 1. mount the icon grid widget, handing it the app list to render
  const gridRoot = document.getElementById('app-grid-root');
  await loadWidget('./widget/app-grid/', gridRoot, { initArgs: [APPS] });

  // 2. whenever an icon is clicked, the app-grid widget fires this event —
  //    also how the Start Menu launches an app (including System Info,
  //    which isn't a desktop icon, hence ALL_APPS rather than APPS here)
  document.addEventListener('os:launch-app', (event) => {
    const app = ALL_APPS.find((a) => a.id === event.detail.id);
    if (app) openApp(app);
  });

  // whenever a folder icon is clicked, open My Computer's app (the File
  // Explorer) straight into that folder instead of its default root view
  document.addEventListener('os:open-folder', (event) => {
    const app = APPS.find((a) => a.id === 'my-computer');
    if (app) openApp(app, [event.detail.id]);
  });

  // 3. taskbar clock + its slide-in date/calendar panel
  initClockPanel();
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

  // taskbar.js owns everything about this window's taskbar presence from
  // here on (grouping, highlighting, minimized state, closing) — see
  // README.md > "Taskbar tabs"
  registerWindow(app, root);
  root.addEventListener('popup:closed', () => root.remove(), { once: true });
}

boot();
