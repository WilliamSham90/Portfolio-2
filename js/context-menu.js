/* =====================================================================
   context-menu.js
   Replaces the browser's right-click menu with the OS's own, everywhere
   on the page — same "small kernel module" shape as theme.js/folders.js.
   What it shows depends on what's under the cursor: right-clicking a
   folder icon gets its own Open/Rename menu, everything else gets the
   general desktop one.

   Shift+right-click is left alone on purpose: the handler bails out
   before preventDefault(), so the browser's real menu (Inspect, etc.)
   still opens. That's the only escape hatch needed — F12 / Ctrl+Shift+I
   aren't touched at all, so devtools are always still reachable that way
   too; this only affects the right-click menu itself.
   ===================================================================== */

import { createFolder, getFolder, deleteFolder } from './folders.js';
import { confirmDialog } from './confirm-dialog.js';

function launchApp(id) {
  document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id } }));
}

function renameFolderPrompt(id) {
  document.dispatchEvent(new CustomEvent('os:rename-folder', { detail: { id } }));
}

async function deleteFolderPrompt(id) {
  const folder = getFolder(id);
  if (!folder) return;

  const count = folder.appIds.length;
  const message = count > 0
    ? `Delete “${folder.name}”? ${count} app${count === 1 ? '' : 's'} inside will move back to the desktop.`
    : `Delete “${folder.name}”?`;

  if (await confirmDialog(message)) deleteFolder(id);
}

/**
 * Wipes every bit of user customization back to first-boot defaults —
 * theme, folders, icon positions. Each piece of state is owned by its own
 * module (js/theme.js, js/folders.js, widget/app-grid), so this doesn't
 * reach into any of them directly; it just asks everyone to clean up via
 * os:reset (same loose-coupling pattern as every other cross-module
 * signal in this OS), then reloads so the whole page boots fresh off
 * whatever's left in storage — simpler and more reliable than trying to
 * reset a dozen already-mounted widgets in place.
 */
async function resetDesktopPrompt() {
  const ok = await confirmDialog(
    'Reset the desktop to its default state? This clears your theme, folders, and icon layout. This can’t be undone.',
    { confirmLabel: 'Reset' },
  );
  if (!ok) return;
  document.dispatchEvent(new CustomEvent('os:reset'));
  location.reload();
}

const DESKTOP_ITEMS = [
  {
    icon: '📁',
    label: 'New Folder',
    run: () => {
      const folder = createFolder();
      renameFolderPrompt(folder.id); // straight into rename, like a normal OS
    },
  },
  { icon: '🖥️', label: 'My Computer', run: () => launchApp('my-computer') },
  { icon: '🎨', label: 'Settings', run: () => launchApp('themes') },
  { icon: '🔄', label: 'Reset Desktop', run: () => resetDesktopPrompt() },
];

function folderItems(folderId) {
  return [
    { icon: '📂', label: 'Open', run: () => document.dispatchEvent(new CustomEvent('os:open-folder', { detail: { id: folderId } })) },
    { icon: '✏️', label: 'Rename', run: () => renameFolderPrompt(folderId) },
    { icon: '🗑️', label: 'Delete', run: () => deleteFolderPrompt(folderId) },
  ];
}

export function initContextMenu() {
  const menu = document.getElementById('context-menu');

  document.addEventListener('contextmenu', (event) => {
    if (event.shiftKey) return; // let the real browser menu through
    event.preventDefault();

    const folderEl = event.target.closest('.app-icon[data-item-kind="folder"]');
    const items = folderEl ? folderItems(folderEl.dataset.itemId) : DESKTOP_ITEMS;
    show(event.clientX, event.clientY, items);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);

  function show(x, y, items) {
    menu.replaceChildren();
    for (const item of items) {
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
