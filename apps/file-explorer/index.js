import { APPS, openApp } from '../../js/main.js';
import { listFolders, getFolder, removeAppFromFolder } from '../../js/folders.js';
import { styledIconUrl } from '../../js/icon-style.js';
import { isImageIcon } from '../../js/icon.js';
import manifest from '../../assets/manifest.js';

// no "Fonts" entry — theme fonts live under assets/ but aren't meant to
// be browsable here, unlike the rest of the media library
const CATEGORIES = [
  { key: 'images', name: 'Images', icon: '🖼️' },
  { key: 'music', name: 'Music', icon: '🎵' },
  { key: 'videos', name: 'Videos', icon: '🎬' },
  { key: 'pdf', name: 'PDF', icon: '📄' },
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
  // the window this instance lives inside — same "reach up to the chrome"
  // trick apps/media-viewer uses for its own title, used here to tell
  // taskbar.js what to show for this window in a grouped tab's dropdown
  // (see js/taskbar.js) instead of a generic "My Computer - N"
  const outerRoot = container.closest('.popup-window')?.parentElement;

  // { type: 'folder', id } | { type: 'category', key } | { type: 'album', catKey, albumId } | null
  let selected = folderId ? { type: 'folder', id: folderId } : null;
  let viewMode = 'grid'; // default, per-window (not persisted between opens)

  function select(next) {
    selected = next;
    render();
  }

  function isSelected(type, key) {
    if (type === 'folder') return selected?.type === 'folder' && selected.id === key;
    // an open album still highlights its parent category in the sidebar,
    // so it's clear which library section you're browsing
    return (selected?.type === 'category' && selected.key === key)
      || (selected?.type === 'album' && selected.catKey === key);
  }

  viewToggleEl.addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    renderMain();
  });

  function render() {
    renderSidebar();
    renderMain();
  }

  /** Sets the pane title, and tells taskbar.js what to show for this
   *  window in a grouped tab's dropdown instead — "This PC" (null) falls
   *  back to the app's own name there, same as it always did. */
  function setTitle(text) {
    titleEl.textContent = text;
    outerRoot?.dispatchEvent(new CustomEvent('popup:label-changed', {
      detail: { label: text === 'This PC' ? null : text },
      bubbles: true,
    }));
  }

  function renderSidebar() {
    sidebarEl.replaceChildren();

    const folders = listFolders();
    if (folders.length > 0) {
      const folderIcon = styledIconUrl('folder');
      sidebarEl.appendChild(heading('Folders'));
      for (const folder of folders) {
        sidebarEl.appendChild(sidebarItem({
          icon: folderIcon,
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
      setTitle('This PC');
      listEl.appendChild(emptyHint('Select a folder or a library category on the left.'));
      return;
    }

    if (selected.type === 'folder') {
      const folder = getFolder(selected.id);
      setTitle(folder.name);
      renderFolder(folder);
      return;
    }

    if (selected.type === 'album') {
      const cat = CATEGORIES.find((c) => c.key === selected.catKey);
      const album = (manifest[selected.catKey] ?? []).find((e) => e.id === selected.albumId);
      if (!cat || !album) { selected = { type: 'category', key: selected.catKey }; renderMain(); return; }
      setTitle(album.name);
      renderFiles(cat, album.items);
      return;
    }

    const cat = CATEGORIES.find((c) => c.key === selected.key);
    setTitle(cat.name);
    renderCategory(cat);
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
    const entries = manifest[cat.key] ?? [];
    if (entries.length === 0) {
      listEl.appendChild(emptyHint('Nothing here yet.'));
      return;
    }

    const albums = entries.filter((e) => e.kind === 'album');
    const files = entries.filter((e) => e.kind !== 'album');

    for (const album of albums) {
      const entry = makeEntry(viewMode, { icon: styledIconUrl('folder'), name: album.name });
      entry.mainEl.addEventListener('click', () => select({ type: 'album', catKey: cat.key, albumId: album.id }));
      listEl.appendChild(entry.el);
    }
    renderFiles(cat, files);
  }

  /** The actual openable files in a category or album — same rendering either way. */
  function renderFiles(cat, files) {
    if (files.length === 0) return;

    // fonts are just a family list (no single file to open) — everything
    // else opens in a new tab and lets the browser's native viewer handle
    // it, except images, which open in the in-OS media viewer instead
    const openable = cat.key !== 'fonts';
    const isImages = cat.key === 'images';
    const urlFor = (file) => new URL(`../../assets/${cat.key}/${file.file}`, import.meta.url).href;

    for (const file of files) {
      const entry = makeEntry(viewMode, {
        icon: cat.icon,
        name: file.name,
        kind: openable ? 'default' : 'static',
        thumbnailUrl: isImages ? urlFor(file) : null,
      });
      if (openable) {
        entry.mainEl.addEventListener('click', () => {
          if (isImages) {
            const images = files.map((f) => ({ name: f.name, url: urlFor(f) }));
            openApp(
              { id: 'media-viewer', name: file.name, icon: '🖼️', path: './apps/media-viewer/' },
              [{ images, index: files.indexOf(file) }],
            );
          } else {
            window.open(urlFor(file), '_blank');
          }
        });
      }
      listEl.appendChild(entry.el);
    }
  }

  // a folder created/renamed/filed/emptied elsewhere (the desktop, another
  // File Explorer window, the right-click menu) should show up here too
  document.addEventListener('os:folders-changed', render);
  // every folder icon (sidebar list + any open album) changes at once
  // when the Settings app's icon style (blue/yellow) does
  document.addEventListener('os:icon-style-changed', render);

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
  const iconHtml = isImageIcon(icon)
    ? `<img class="explorer-sidebar-icon explorer-sidebar-icon-img" src="${icon}" alt="" draggable="false">`
    : `<span class="explorer-sidebar-icon">${icon}</span>`;
  btn.innerHTML = `
    ${iconHtml}
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
 * anything yet (fonts). `thumbnailUrl`, when given (images), shows the
 * actual picture instead of the category's generic icon.
 */
function row({ icon, name, kind = 'default', removable = false, thumbnailUrl = null }) {
  const el = document.createElement('div');
  el.className = 'explorer-row';

  const mainEl = document.createElement(kind === 'static' ? 'div' : 'button');
  if (mainEl.tagName === 'BUTTON') mainEl.type = 'button';
  mainEl.className = 'explorer-row-main';
  const iconHtml = thumbnailUrl
    ? `<img class="explorer-row-icon explorer-row-thumb" src="${thumbnailUrl}" alt="">`
    : isImageIcon(icon)
      ? `<img class="explorer-row-icon explorer-row-icon-img icon-glow" src="${icon}" alt="" draggable="false">`
      : `<span class="explorer-row-icon">${icon}</span>`;
  mainEl.innerHTML = `
    ${iconHtml}
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
function cell({ icon, name, kind = 'default', removable = false, thumbnailUrl = null }) {
  const el = document.createElement('div');
  el.className = 'explorer-cell-wrap';

  const mainEl = document.createElement(kind === 'static' ? 'div' : 'button');
  if (mainEl.tagName === 'BUTTON') mainEl.type = 'button';
  mainEl.className = 'explorer-cell';
  const iconHtml = thumbnailUrl
    ? `<img class="explorer-cell-icon explorer-cell-thumb" src="${thumbnailUrl}" alt="">`
    : isImageIcon(icon)
      ? `<img class="explorer-cell-icon explorer-cell-icon-img icon-glow" src="${icon}" alt="" draggable="false">`
      : `<span class="explorer-cell-icon">${icon}</span>`;
  mainEl.innerHTML = `
    ${iconHtml}
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
