import { APPS } from '../../main.js';
import { listFolders, getFolder, createFolder, removeAppFromFolder } from '../../folders.js';
import manifest from '../../assets/manifest.js';

const CATEGORIES = [
  { key: 'images', name: 'Images', icon: '🖼️' },
  { key: 'music', name: 'Music', icon: '🎵' },
  { key: 'videos', name: 'Videos', icon: '🎬' },
  { key: 'pdf', name: 'PDF', icon: '📄' },
  { key: 'fonts', name: 'Fonts', icon: '🔤' },
];

/**
 * Called by loader.js after this app's HTML is mounted.
 * @param {HTMLElement} container  this app instance's own root element
 * @param {string} [folderId]  open straight into this folder instead of "This PC"
 */
export function init(container, folderId) {
  const listEl = container.querySelector('.explorer-list');
  const pathEl = container.querySelector('.explorer-path');
  const backBtn = container.querySelector('.explorer-back');

  let location = folderId ? { type: 'folder', id: folderId } : { type: 'root' };

  function goTo(next) {
    location = next;
    render();
  }

  function render() {
    backBtn.disabled = location.type === 'root';
    pathEl.textContent = locationLabel(location);
    listEl.replaceChildren();

    if (location.type === 'root') renderRoot();
    else if (location.type === 'folder') renderFolder(location.id);
    else renderCategory(location.key);
  }

  function renderRoot() {
    const newFolder = row({ icon: '➕', name: 'New Folder', kind: 'action' });
    newFolder.mainEl.addEventListener('click', () => {
      const folder = createFolder();
      goTo({ type: 'folder', id: folder.id });
    });
    listEl.appendChild(newFolder.el);

    for (const folder of listFolders()) {
      const r = row({ icon: folder.icon, name: folder.name });
      r.mainEl.addEventListener('click', () => goTo({ type: 'folder', id: folder.id }));
      listEl.appendChild(r.el);
    }

    for (const cat of CATEGORIES) {
      const r = row({ icon: cat.icon, name: cat.name });
      r.mainEl.addEventListener('click', () => goTo({ type: 'category', key: cat.key }));
      listEl.appendChild(r.el);
    }
  }

  function renderFolder(folderId) {
    const folder = getFolder(folderId);
    if (!folder) {
      goTo({ type: 'root' });
      return;
    }

    if (folder.appIds.length === 0) {
      listEl.appendChild(emptyHint('Empty. Drag an app onto this folder’s desktop icon to file it in here.'));
      return;
    }

    for (const appId of folder.appIds) {
      const app = APPS.find((a) => a.id === appId);
      if (!app) continue;
      const r = row({ icon: app.icon, name: app.name, removable: true });
      r.mainEl.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id: app.id } }));
      });
      r.removeEl.addEventListener('click', (event) => {
        event.stopPropagation();
        removeAppFromFolder(app.id, folder.id);
      });
      listEl.appendChild(r.el);
    }
  }

  function renderCategory(key) {
    const cat = CATEGORIES.find((c) => c.key === key);
    const files = manifest[key] ?? [];

    if (files.length === 0) {
      listEl.appendChild(emptyHint('Nothing here yet.'));
      return;
    }

    // fonts are just a family list (no single file to open) — everything
    // else opens in a new tab and lets the browser's native viewer handle it
    const openable = key !== 'fonts';

    for (const file of files) {
      const r = row({ icon: cat.icon, name: file.name, kind: openable ? 'default' : 'static' });
      if (openable) {
        r.mainEl.addEventListener('click', () => {
          const url = new URL(`../../assets/${key}/${file.file}`, import.meta.url);
          window.open(url, '_blank');
        });
      }
      listEl.appendChild(r.el);
    }
  }

  // a folder created/filed/emptied elsewhere (the desktop, another File
  // Explorer window) should be reflected here too, live
  document.addEventListener('os:folders-changed', render);

  backBtn.addEventListener('click', () => goTo({ type: 'root' }));

  render();
}

function locationLabel(location) {
  if (location.type === 'root') return 'This PC';
  if (location.type === 'folder') return getFolder(location.id)?.name ?? 'Folder';
  return CATEGORIES.find((c) => c.key === location.key)?.name ?? '';
}

/**
 * One list row. `kind: 'action'` styles it as an "add" affordance (dashed
 * border); `kind: 'static'` renders a plain, non-interactive row (no
 * button semantics) for entries that don't do anything yet.
 */
function row({ icon, name, kind = 'default', removable = false }) {
  const el = document.createElement('div');
  el.className = 'explorer-row' + (kind === 'action' ? ' is-action' : '');

  const mainEl = document.createElement(kind === 'static' ? 'div' : 'button');
  if (mainEl.tagName === 'BUTTON') mainEl.type = 'button';
  mainEl.className = 'explorer-row-main';
  mainEl.innerHTML = `
    <span class="explorer-row-icon">${icon}</span>
    <span class="explorer-row-name">${name}</span>
  `;
  el.appendChild(mainEl);

  let removeEl = null;
  if (removable) {
    removeEl = document.createElement('button');
    removeEl.type = 'button';
    removeEl.className = 'explorer-row-remove';
    removeEl.setAttribute('aria-label', `Remove ${name} from this folder`);
    removeEl.textContent = '✕';
    el.appendChild(removeEl);
  }

  return { el, mainEl, removeEl };
}

function emptyHint(text) {
  const p = document.createElement('p');
  p.className = 'explorer-empty';
  p.textContent = text;
  return p;
}
