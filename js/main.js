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
import { initNotifications } from './notifications.js';
import { initWelcome } from './welcome.js';

function icon(filename) {
  return new URL(`../assets/system/Icons/basic/${filename}`, import.meta.url).href;
}

const BROWSER_ICON = icon('earth.png');
const SETTINGS_ICON = icon('settings.png');
const COMPUTER_ICON = icon('computer-storage.png');
const CALCULATOR_ICON = icon('calculator.png');
const NOTEPAD_ICON = icon('notes.png');
const PAINT_ICON = icon('pallete.png');
const TERMINAL_ICON = icon('web-development.png');
const MUSIC_ICON = icon('music.png');

function gameFile(filename) {
  return new URL(`../games/${filename}`, import.meta.url).href;
}

// Flash games: regular apps (draggable, filable, taskbar tabs...) that all
// open apps/flash-player with their own `args` — the .swf, plus its stage
// size so the window opens at the game's shape. js/folders.js files every
// one into the default Games folder, so they start off the desktop; a new
// game's id needs adding there too (or it just sits on the desktop instead).
const GAMES = [
  { id: 'alien-hominid', name: 'Alien Hominid', cover: 'Alien_Hominid_cover.png', swf: 'alien_booya.swf', width: 550, height: 400 },
  { id: 'fleeing-the-complex', name: 'Fleeing the Complex', cover: 'fleeing-the-complex.jpg', swf: 'fleeingthecomplexng.swf', width: 800, height: 480 },
  { id: 'pac-man', name: 'Pac-Man', cover: 'pac-man.jpg', swf: 'pac-man.swf', width: 360, height: 420 },
  { id: 'impossible-quiz', name: 'The Impossible Quiz', cover: 'The-Impossible-Quiz.jpg', swf: 'the-impossible-quiz.swf', width: 550, height: 400 },
].map(({ id, name, cover, swf, width, height }) => ({
  id,
  name,
  icon: gameFile(cover),
  path: './apps/flash-player/',
  args: [{ swf: gameFile(swf), width, height }],
}));

export const APPS = [
  { id: 'my-computer', name: 'My Computer', icon: COMPUTER_ICON, path: './apps/file-explorer/' },
  { id: 'browser', name: 'Browser', icon: BROWSER_ICON, path: './apps/browser/' },
  { id: 'settings', name: 'Settings', icon: SETTINGS_ICON, path: './apps/themes/' },
  { id: 'calculator', name: 'Calculator', icon: CALCULATOR_ICON, path: './apps/calculator/' },
  { id: 'notepad', name: 'Notepad', icon: NOTEPAD_ICON, path: './apps/notepad/' },
  { id: 'paint', name: 'Paint', icon: PAINT_ICON, path: './apps/paint/' },
  { id: 'music', name: 'Music', icon: MUSIC_ICON, path: './apps/music/' },
  ...GAMES,
  // { id: 'next-app', name: 'Next App', icon: '✨', path: './apps/next-app/' },
];

// neither is a desktop icon — only reachable from the Start Menu — so
// both live outside APPS (which also drives the desktop grid) rather than in it.
const SYSTEM_INFO_APP = { id: 'system-info', name: 'System Info', icon: icon('information.png'), path: './apps/system-info/' };
const TERMINAL_APP = { id: 'terminal', name: 'Terminal', icon: TERMINAL_ICON, path: './apps/terminal/' };

// every app os:launch-app might need to resolve an id back to, whether or
// not it's also a desktop icon (APPS)
const ALL_APPS = [...APPS, SYSTEM_INFO_APP, TERMINAL_APP];

// the Start Menu shows a curated, specifically-ordered subset of ALL_APPS
// rather than APPS itself — this exact list/order was requested directly,
// so a desktop-only app like Calculator stays off it unless asked for
const START_MENU_APPS = ['my-computer', 'browser', 'terminal', 'settings', 'system-info']
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

  // 4. the notification toast + its taskbar history button — before
  //    initWelcome(), which may fire one immediately
  initNotifications();
  initWelcome();
}

let openCount = 0;

/**
 * Opens an app window. Exported so other modules can launch one that
 * isn't necessarily in APPS/on the desktop — e.g. apps/file-explorer
 * opening apps/media-viewer when an image is clicked. With no
 * appInitArgs, an app's own `args` (if any — the GAMES entries) are used.
 */
export async function openApp(app, appInitArgs = app.args ?? []) {
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
