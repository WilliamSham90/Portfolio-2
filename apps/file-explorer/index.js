import { APPS } from '../../main.js';
import { listFolders, getFolder, removeAppFromFolder } from '../../folders.js';
import manifest from '../../assets/manifest.js';

const CATEGORIES = [
  { key: 'images', name: 'Images', icon: '🖼️' },
  { key: 'music', name: 'Music', icon: '🎵' },
  { key: 'videos', name: 'Videos', icon: '🎬' },
  { key: 'pdf', name: 'PDF', icon: '📄' },
  { key: 'fonts', name: 'Fonts', icon: '🔤' },
];

const VIEW_TOGGLE = {
  // shows the icon/label for the view you'd SWITCH TO, not the current one
  grid: { icon: '☰', label: 'Switch to list view' },
  list: { icon: '▦', label: 'Switch to grid view' },
};

/**
 * Called by loader.js after this app's HTML is mounted.
 * @param {HTMLElement} container  this app instance's own root element
 * @param {string} [folderId]  pre-select this folder instead of showing nothing selected
 */
export function init(container, folderId) {
  const sidebarEl = container.querySelector('.explorer-sidebar');
  const titleEl = container.querySelector('.explorer-main-title');
  const listEl = container.querySelector('.explorer-list');
  const viewToggleEl = container.querySelector('.explorer-view-toggle');

  // { type: 'folder', id } | { type: 'category', key } | null (nothing selected yet)
  let selected = folderId ? { type: 'folder', id: folderId } : null;
  let viewMode = 'grid'; // default, per-window (not persisted between opens)

  function select(next) {
    selected = next;
    render();
  }

  function isSelected(type, key) {
    return selected?.type === type && (type === 'folder' ? selected.id === key : selected.key === key);
  }

  viewToggleEl.addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    renderMain();
  });

  function render() {
    renderSidebar();
    renderMain();
  }

  function renderSidebar() {
    sidebarEl.replaceChildren();

    const folders = listFolders();
    if (folders.length > 0) {
      sidebarEl.appendChild(heading('Folders'));
      for (const folder of folders) {
        sidebarEl.appendChild(sidebarItem({
          icon: folder.icon,
          name: folder.name,
          active: isSelected('folder', folder.id),
          onClick: () => select({ type: 'folder', id: folder.id }),
        }));
      }
    }

    sidebarEl.appendChild(heading('Library'));
    for (const cat of CATEGORIES) {
      sidebarEl.appendChild(sidebarItem({
        icon: cat.icon,
        name: cat.name,
        active: isSelected('category', cat.key),
        onClick: () => select({ type: 'category', key: cat.key }),
      }));
    }
  }

  function renderMain() {
    listEl.replaceChildren();
    listEl.classList.toggle('is-grid', viewMode === 'grid');
    viewToggleEl.textContent = VIEW_TOGGLE[viewMode].icon;
    viewToggleEl.setAttribute('aria-label', VIEW_TOGGLE[viewMode].label);

    if (selected?.type === 'folder' && !getFolder(selected.id)) selected = null; // folder got deleted/emptied elsewhere

    if (!selected) {
      titleEl.textContent = 'This PC';
      listEl.appendChild(emptyHint('Select a folder or a library category on the left.'));
      return;
    }

    if (selected.type === 'folder') {
      const folder = getFolder(selected.id);
      titleEl.textContent = folder.name;
      renderFolder(folder);
    } else {
      const cat = CATEGORIES.find((c) => c.key === selected.key);
      titleEl.textContent = cat.name;
      renderCategory(cat);
    }
  }

  function renderFolder(folder) {
    if (folder.appIds.length === 0) {
      listEl.appendChild(emptyHint('Empty. Drag an app onto this folder’s desktop icon to file it in here.'));
      return;
    }
    for (const appId of folder.appIds) {
      const app = APPS.find((a) => a.id === appId);
      if (!app) continue;
      const entry = makeEntry(viewMode, { icon: app.icon, name: app.name, removable: true });
      entry.mainEl.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id: app.id } }));
      });
      entry.removeEl.addEventListener('click', (event) => {
        event.stopPropagation();
        removeAppFromFolder(app.id, folder.id);
      });
      listEl.appendChild(entry.el);
    }
  }

  function renderCategory(cat) {
    const files = manifest[cat.key] ?? [];
    if (files.length === 0) {
      listEl.appendChild(emptyHint('Nothing here yet.'));
      return;
    }
    // fonts are just a family list (no single file to open) — everything
    // else opens in a new tab and lets the browser's native viewer handle it
    const openable = cat.key !== 'fonts';
    for (const file of files) {
      const entry = makeEntry(viewMode, { icon: cat.icon, name: file.name, kind: openable ? 'default' : 'static' });
      if (openable) {
        entry.mainEl.addEventListener('click', () => {
          const url = new URL(`../../assets/${cat.key}/${file.file}`, import.meta.url);
          window.open(url, '_blank');
        });
      }
      listEl.appendChild(entry.el);
    }
  }

  // a folder created/renamed/filed/emptied elsewhere (the desktop, another
  // File Explorer window, the right-click menu) should show up here too
  document.addEventListener('os:folders-changed', render);

  render();
}

function heading(text) {
  const h = document.createElement('div');
  h.className = 'explorer-sidebar-heading';
  h.textContent = text;
  return h;
}

function sidebarItem({ icon, name, active, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'explorer-sidebar-item' + (active ? ' is-active' : '');
  btn.innerHTML = `
    <span class="explorer-sidebar-icon">${icon}</span>
    <span class="explorer-sidebar-name">${name}</span>
  `;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeEntry(viewMode, options) {
  return viewMode === 'grid' ? cell(options) : row(options);
}

/**
 * One row in the right-hand *list* view. `kind: 'static'` renders a plain,
 * non-interactive row (no button semantics) for entries that don't do
 * anything yet (fonts).
 */
function row({ icon, name, kind = 'default', removable = false }) {
  const el = document.createElement('div');
  el.className = 'explorer-row';

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

/** Same shape as row(), for the right-hand *grid* view. */
function cell({ icon, name, kind = 'default', removable = false }) {
  const el = document.createElement('div');
  el.className = 'explorer-cell-wrap';

  const mainEl = document.createElement(kind === 'static' ? 'div' : 'button');
  if (mainEl.tagName === 'BUTTON') mainEl.type = 'button';
  mainEl.className = 'explorer-cell';
  mainEl.innerHTML = `
    <span class="explorer-cell-icon">${icon}</span>
    <span class="explorer-cell-name">${name}</span>
  `;
  el.appendChild(mainEl);

  let removeEl = null;
  if (removable) {
    removeEl = document.createElement('button');
    removeEl.type = 'button';
    removeEl.className = 'explorer-cell-remove';
    removeEl.setAttribute('aria-label', `Remove ${name} from this folder`);
    removeEl.textContent = '✕';
    el.appendChild(removeEl); // sibling of mainEl, not nested inside it — see index.css note
  }

  return { el, mainEl, removeEl };
}

function emptyHint(text) {
  const p = document.createElement('p');
  p.className = 'explorer-empty';
  p.textContent = text;
  return p;
}
