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

// tracks every currently-open window: popup root element -> its taskbar tab
const openWindows = new Map();

async function boot() {
  // 1. mount the icon grid widget, handing it the app list to render
  const gridRoot = document.getElementById('app-grid-root');
  await loadWidget('./widget/app-grid/', gridRoot, { initArgs: [APPS] });

  // 2. whenever an icon is clicked, the app-grid widget fires this event
  document.addEventListener('os:launch-app', (event) => {
    const app = APPS.find((a) => a.id === event.detail.id);
    if (app) openApp(app);
  });

  // 3. a popup tells us whenever it's been clicked/focused, so we can
  //    highlight the matching taskbar tab
  document.addEventListener('popup:activated', (event) => {
    setActiveTab(event.target);
  });

  // 4. taskbar clock
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
  tab.innerHTML = `<span class="taskbar-tab-icon">${app.icon}</span><span class="taskbar-tab-label">${app.name}</span>`;

  // clicking the tab asks that specific popup to bring itself to front
  tab.addEventListener('click', () => {
    popupRoot.dispatchEvent(new CustomEvent('popup:focus'));
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
