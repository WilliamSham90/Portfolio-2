/* =====================================================================
   main.js
   The "kernel". Holds the list of installed apps and wires the OS
   shell together. To add a new app later: drop a folder in /apps/
   (index.html + index.css + index.js) and add one line to APPS below.
   ===================================================================== */

import { loadWidget } from './loader.js';

const APPS = [
  { id: 'hello-world', name: 'Hello There', icon: '👋', path: './apps/hello-world/' },
  // { id: 'next-app', name: 'Next App', icon: '✨', path: './apps/next-app/' },
];

async function boot() {
  // 1. mount the icon grid widget, handing it the app list to render
  const gridRoot = document.getElementById('app-grid-root');
  await loadWidget('./widget/app-grid/', gridRoot, { initArgs: [APPS] });

  // 2. whenever an icon is clicked, the app-grid widget fires this event
  document.addEventListener('os:launch-app', (event) => {
    const app = APPS.find((a) => a.id === event.detail.id);
    if (app) openApp(app);
  });

  // 3. taskbar clock
  const clockEl = document.getElementById('taskbar-clock');
  const tick = () => {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 1000 * 15);
}

let openCount = 0;

async function openApp(app) {
  const popupLayer = document.getElementById('popup-layer');

  // each open app gets its own popup instance, offset slightly so
  // opening several at once doesn't stack them exactly on top of each other
  const offset = (openCount++ % 6) * 28;

  const { root } = await loadWidget('./widget/popup/', popupLayer, {
    multiple: true,
    initArgs: [app, offset],
  });

  // if the user closes the window, forget about its DOM node
  root.addEventListener('popup:closed', () => root.remove(), { once: true });
}

boot();
