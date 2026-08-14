/* =====================================================================
   context-menu.js
   Replaces the browser's right-click menu with the OS's own, everywhere
   on the page — same "small kernel module" shape as theme.js/folders.js.

   Shift+right-click is left alone on purpose: the handler bails out
   before preventDefault(), so the browser's real menu (Inspect, etc.)
   still opens. That's the only escape hatch needed — F12 / Ctrl+Shift+I
   aren't touched at all, so devtools are always still reachable that way
   too; this only affects the right-click menu itself.
   ===================================================================== */

import { createFolder } from './folders.js';

const ITEMS = [
  { icon: '📁', label: 'New Folder', run: () => createFolder() },
  { icon: '🖥️', label: 'My Computer', run: () => launchApp('my-computer') },
  { icon: '🎨', label: 'Settings', run: () => launchApp('themes') },
];

function launchApp(id) {
  document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id } }));
}

export function initContextMenu() {
  const menu = document.getElementById('context-menu');

  for (const item of ITEMS) {
    const li = document.createElement('li');
    li.className = 'context-menu-item';
    li.setAttribute('role', 'menuitem');
    li.tabIndex = -1;
    li.innerHTML = `<span class="context-menu-icon">${item.icon}</span><span>${item.label}</span>`;
    li.addEventListener('click', () => {
      item.run();
      hide();
    });
    menu.appendChild(li);
  }

  document.addEventListener('contextmenu', (event) => {
    if (event.shiftKey) return; // let the real browser menu through
    event.preventDefault();
    show(event.clientX, event.clientY);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);

  function show(x, y) {
    menu.hidden = false;
    menu.style.left = '0px';
    menu.style.top = '0px';
    const rect = menu.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    menu.style.left = `${clamp(x, 8, Math.max(8, maxLeft))}px`;
    menu.style.top = `${clamp(y, 8, Math.max(8, maxTop))}px`;
  }

  function hide() {
    menu.hidden = true;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
