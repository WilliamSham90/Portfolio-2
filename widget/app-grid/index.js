import { listFolders, fileAppIntoFolder, renameFolder } from '../../js/folders.js';

const STORAGE_KEY = 'os-app-grid-slots-v1';
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag, not a tap

/**
 * Called by loader.js after this widget's HTML is mounted.
 * @param {HTMLElement} container  this widget's own root element
 * @param {Array<{id:string,name:string,icon:string}>} apps  every installed app
 */
export function init(container, apps) {
  const grid = container.querySelector('.app-grid');

  const ctx = {
    grid,
    apps, // the full install list — filed-into-a-folder apps just don't get rendered
    items: [],
    elsByAppId: new Map(),
    slotMap: {},
    highlight: document.createElement('div'),
  };
  ctx.highlight.className = 'drop-highlight';
  grid.appendChild(ctx.highlight);

  render(ctx);

  // a folder being created/filed/emptied (from this window or a File
  // Explorer window) means the desktop's own icon set has changed
  document.addEventListener('os:folders-changed', () => render(ctx));

  // the context menu (or a fresh "New Folder") asks for a folder's icon
  // to enter its inline rename state
  document.addEventListener('os:rename-folder', (event) => {
    const item = ctx.items.find((i) => i.id === event.detail.id);
    const el = ctx.elsByAppId.get(event.detail.id);
    if (item && el) startRename(ctx, item, el);
  });

  // reflow (column count can change) whenever the grid is resized — window
  // resize, orientation change, sidebar toggling, etc.
  const resizeObserver = new ResizeObserver(() => layout(ctx));
  resizeObserver.observe(grid);
}

/* ---------- what's actually on the desktop right now ---------- */

function visibleItems(ctx) {
  const folders = listFolders();
  const filedAppIds = new Set(folders.flatMap((f) => f.appIds));
  const appItems = ctx.apps
    .filter((app) => !filedAppIds.has(app.id))
    .map((app) => ({ kind: 'app', id: app.id, name: app.name, icon: app.icon }));
  const folderItems = folders.map((f) => ({ kind: 'folder', id: f.id, name: f.name, icon: f.icon }));
  return [...appItems, ...folderItems];
}

function render(ctx) {
  ctx.items = visibleItems(ctx);
  ctx.slotMap = loadSlots(ctx.items);
  // any item that just got a fresh "next free slot" (never individually
  // dragged, so nothing to load for it above) needs that committed now —
  // otherwise it's only ever a slot computed for *this* render, and the
  // next one (another folder created/deleted, an app filed/unfiled...)
  // would freely recompute it differently, and the icon visibly jumps
  // somewhere else on its own, without anyone having dragged it
  saveSlots(ctx.slotMap);

  for (const el of ctx.grid.querySelectorAll('.app-icon')) el.remove();
  ctx.elsByAppId.clear();

  for (const item of ctx.items) {
    const btn = document.createElement('button');
    btn.className = 'app-icon';
    btn.type = 'button';
    btn.setAttribute('aria-label', item.kind === 'folder' ? `Open folder ${item.name}` : `Open ${item.name}`);
    btn.dataset.itemKind = item.kind;
    btn.dataset.itemId = item.id;
    btn.innerHTML = `
      <span class="app-icon-glyph">${item.icon}</span>
      <span class="app-icon-label">${item.name}</span>
    `;
    ctx.grid.appendChild(btn);
    ctx.elsByAppId.set(item.id, btn);
    makeIconDraggable(btn, item, ctx);
  }

  layout(ctx);
}

/* ---------- grid geometry ---------- */

function metrics(ctx) {
  const style = getComputedStyle(ctx.grid);
  const cell = parseFloat(style.getPropertyValue('--cell-size'));
  const gap = parseFloat(style.getPropertyValue('--cell-gap'));
  const pad = parseFloat(style.getPropertyValue('--grid-pad'));
  const rect = ctx.grid.getBoundingClientRect();
  const innerWidth = rect.width - pad * 2;
  const innerHeight = rect.height - pad * 2;
  const cols = Math.max(1, Math.floor((innerWidth + gap) / (cell + gap)));
  // rows = however many actually fit on screen (.app-grid fills the whole
  // desktop), never fewer than what's needed to hold every item — so a
  // couple of icons on a wide, tall desktop can still be dragged into any
  // row, not just shuffled sideways within the one row they'd otherwise be
  // confined to
  const minRows = Math.max(1, Math.ceil(ctx.items.length / cols));
  const rows = Math.max(minRows, Math.floor((innerHeight + gap) / (cell + gap)));
  return { cell, gap, pad, cols, rows, rect };
}

function slotFromPoint(clientX, clientY, m) {
  const relX = clientX - m.rect.left - m.pad;
  const relY = clientY - m.rect.top - m.pad;
  const col = clamp(Math.floor(relX / (m.cell + m.gap)), 0, m.cols - 1);
  const row = clamp(Math.floor(relY / (m.cell + m.gap)), 0, m.rows - 1);
  return { row, col, slot: row * m.cols + col };
}

function placeElAt(el, slot, cols) {
  el.style.gridRow = String(Math.floor(slot / cols) + 1);
  el.style.gridColumn = String((slot % cols) + 1);
}

function layout(ctx) {
  const { cols } = metrics(ctx);
  for (const item of ctx.items) {
    placeElAt(ctx.elsByAppId.get(item.id), ctx.slotMap[item.id], cols);
  }
}

function itemAtSlot(ctx, slot, excludeId) {
  return ctx.items.find((item) => item.id !== excludeId && ctx.slotMap[item.id] === slot) ?? null;
}

/* ---------- the (invisible-until-dragging) drop highlight ---------- */

function showHighlight(ctx, row, col, m, isSwap) {
  const x = m.pad + col * (m.cell + m.gap);
  const y = m.pad + row * (m.cell + m.gap);
  ctx.highlight.style.transform = `translate(${x}px, ${y}px)`;
  ctx.highlight.classList.add('is-visible');
  ctx.highlight.classList.toggle('is-swap', isSwap);
}

function hideHighlight(ctx) {
  ctx.highlight.classList.remove('is-visible', 'is-swap');
}

/* ---------- FLIP-style settle animation ----------
   Reads the element's on-screen position, lets `mutate` change its real
   (grid-placed) position, then fakes the old position with a transform and
   animates that back to zero — so it glides to its new cell instead of
   popping there instantly. */
function flip(el, mutate) {
  const before = el.getBoundingClientRect();
  mutate();
  const after = el.getBoundingClientRect();
  const dx = before.left - after.left;
  const dy = before.top - after.top;
  if (!dx && !dy) return;

  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px)`;
  void el.offsetWidth; // commit the pre-transform before animating away from it

  requestAnimationFrame(() => {
    el.style.transition = 'transform 0.18s ease';
    el.style.transform = '';
    el.addEventListener('transitionend', () => {
      el.style.transition = '';
    }, { once: true });
  });
}

/* ---------- fading an icon out when it's filed into a folder ---------- */

function fadeOut(el) {
  el.style.transition = 'opacity 0.15s ease, scale 0.15s ease';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0';
  el.style.scale = '0.7';
}

/* ---------- renaming a folder in place ----------
   The input can't live inside the icon <button> (buttons can't contain
   interactive content per the HTML spec, and browsers get flaky about
   focus/selection when you do it anyway) — so it's a floating overlay,
   positioned over the label, same trick as the drop-highlight. */

function startRename(ctx, item, el) {
  if (item.kind !== 'folder') return;

  const labelEl = el.querySelector('.app-icon-label');
  const gridRect = ctx.grid.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const labelRect = labelEl.getBoundingClientRect();

  labelEl.style.visibility = 'hidden';
  el.style.pointerEvents = 'none'; // block drag/click on the icon underneath while editing

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'app-icon-rename';
  input.maxLength = 60;
  input.value = item.name;
  input.style.left = `${elRect.left - gridRect.left + 4}px`;
  input.style.top = `${labelRect.top - gridRect.top}px`;
  input.style.width = `${elRect.width - 8}px`;
  ctx.grid.appendChild(input);
  input.focus();
  input.select();

  let settled = false;
  const finish = (commit) => {
    if (settled) return;
    settled = true;
    if (commit) renameFolder(item.id, input.value); // no-op if blank/unchanged
    input.remove();
    labelEl.style.visibility = '';
    el.style.pointerEvents = '';
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  // don't let clicks/drags on the overlay reach the icon button underneath
  input.addEventListener('pointerdown', (event) => event.stopPropagation());
  input.addEventListener('click', (event) => event.stopPropagation());
}

/* ---------- dragging an icon to reposition it (or file it into a folder) ---------- */

function makeIconDraggable(el, item, ctx) {
  let pointerId = null;
  let dragging = false;
  let suppressClick = false;
  let startX = 0, startY = 0;
  let dx = 0, dy = 0;
  let rafId = null;
  let m = null;
  let originSlot = 0;
  let hoveredSlot = null;
  let swapTargetEl = null;

  const applyTransform = () => {
    rafId = null;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const clearSwapTarget = () => {
    if (swapTargetEl) {
      swapTargetEl.classList.remove('is-swap-target');
      swapTargetEl = null;
    }
  };

  el.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    // captured up front (not on threshold-cross) so a fast flick can't
    // outrun the small icon's bounds before we notice it's a drag
    el.setPointerCapture(pointerId);
  });

  el.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const moveX = event.clientX - startX;
    const moveY = event.clientY - startY;

    if (!dragging) {
      if (Math.hypot(moveX, moveY) < DRAG_THRESHOLD) return;
      dragging = true;
      m = metrics(ctx);
      originSlot = ctx.slotMap[item.id];
      el.classList.add('is-dragging');
      document.body.style.userSelect = 'none';
    }

    dx = moveX;
    dy = moveY;
    if (rafId === null) rafId = requestAnimationFrame(applyTransform);

    const { row, col, slot } = slotFromPoint(event.clientX, event.clientY, m);
    if (slot !== hoveredSlot) {
      hoveredSlot = slot;
      clearSwapTarget();
      const occupant = itemAtSlot(ctx, slot, item.id);
      showHighlight(ctx, row, col, m, Boolean(occupant));
      if (occupant) {
        swapTargetEl = ctx.elsByAppId.get(occupant.id);
        swapTargetEl.classList.add('is-swap-target');
      }
    }
  });

  const endDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    try { el.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    document.body.style.userSelect = '';

    if (!dragging) return; // it was just a tap — let the click handler open it

    dragging = false;
    suppressClick = true;
    el.classList.remove('is-dragging');
    hideHighlight(ctx);
    clearSwapTarget();

    const target = event.type === 'pointercancel'
      ? originSlot
      : slotFromPoint(event.clientX, event.clientY, m).slot;
    const targetSlot = clamp(target, 0, m.rows * m.cols - 1);
    const cols = m.cols;

    if (targetSlot !== originSlot) {
      const occupant = itemAtSlot(ctx, targetSlot, item.id);

      if (occupant && item.kind === 'app' && occupant.kind === 'folder') {
        // drop an app onto a folder: file it away instead of swapping.
        // fileAppIntoFolder() triggers a full re-render synchronously (via
        // folders.js's change event), which would yank `el` out of the DOM
        // mid-transition — so let the fade actually play first, then file it.
        fadeOut(el);
        hoveredSlot = null;
        m = null;
        setTimeout(() => fileAppIntoFolder(item.id, occupant.id), 150);
        return;
      }

      if (occupant) {
        const occupantEl = ctx.elsByAppId.get(occupant.id);
        flip(occupantEl, () => {
          ctx.slotMap[occupant.id] = originSlot;
          placeElAt(occupantEl, originSlot, cols);
        });
      }
      flip(el, () => {
        el.style.transform = '';
        ctx.slotMap[item.id] = targetSlot;
        placeElAt(el, targetSlot, cols);
      });
    } else {
      flip(el, () => { el.style.transform = ''; });
    }

    saveSlots(ctx.slotMap);
    hoveredSlot = null;
    m = null;
  };

  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const eventName = item.kind === 'folder' ? 'os:open-folder' : 'os:launch-app';
    document.dispatchEvent(new CustomEvent(eventName, { detail: { id: item.id } }));
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ---------- persistence: which slot each icon is parked in ---------- */

function loadSlots(items) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    saved = {};
  }

  const used = new Set();
  const slots = {};

  for (const item of items) {
    const slot = saved[item.id];
    if (Number.isInteger(slot) && slot >= 0 && !used.has(slot)) {
      slots[item.id] = slot;
      used.add(slot);
    }
  }

  let next = 0;
  for (const item of items) {
    if (slots[item.id] === undefined) {
      while (used.has(next)) next++;
      slots[item.id] = next;
      used.add(next);
    }
  }

  return slots;
}

function saveSlots(slotMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slotMap));
  } catch {
    // storage unavailable (private browsing, quota, etc.) — layout just
    // won't persist across reloads, nothing else depends on it
  }
}
