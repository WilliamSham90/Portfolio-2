/* =====================================================================
   taskbar.js
   Owns the open-window strip in the middle of the taskbar — one icon per
   *app*, not per window (grouped, Windows-style): main.js calls
   registerWindow(app, popupRoot) once per opened window, and this module
   figures out whether that's a new tab or another window under an
   existing one. Everything else (main.js) only ever talks to this module
   through that one function; taskbar.js reaches back into a window only
   via the same os:-style custom events widget/popup/index.js already
   dispatches (popup:focus, popup:toggle-minimize) — same loose-coupling
   pattern as the rest of the kernel.

   Three things layer on top of the base "one icon per app" tab:
   - **Grouping**: more than one window open for the same app shows a
     small count badge; clicking the icon opens a dropdown listing each
     window ("Calculator - 1", "Calculator - 2", ...) instead of
     toggling a single window directly.
   - **Reordering**: dragging a tab left/right (Pointer Events, same
     drag-threshold pattern as widget/app-grid) reorders `order`; the
     actual DOM move happens once, on drop, animated with FLIP rather
     than live during the drag — simpler than shifting every other tab
     out of the way as you drag over it, and still ends up smooth.
   - **Overflow**: `.taskbar-tabs-wrap` still scrolls natively (wheel/
     trackpad keeps working), but `‹`/`›` buttons appear whenever the
     strip is wider than its viewport, for click/tap users — a
     ResizeObserver keeps that in sync with anything that changes the
     available width, not just window resizes (the clock's date text
     growing, say).
   ===================================================================== */

import { isImageIcon } from './icon.js';

const DRAG_THRESHOLD = 6;

let tabsEl, scrollLeftBtn, scrollRightBtn, groupMenuEl;

const windows = new Map(); // popupRoot -> { app, minimized }
const groups = new Map(); // app.id -> { app, roots: [popupRoot,...], tabButton, countEl }
let order = []; // app ids, left-to-right display order

let activeRoot = null;
let openGroup = null; // the group whose dropdown is currently open, if any

export function initTaskbar() {
  tabsEl = document.getElementById('taskbar-tabs');
  scrollLeftBtn = document.querySelector('.taskbar-scroll-left');
  scrollRightBtn = document.querySelector('.taskbar-scroll-right');
  groupMenuEl = document.getElementById('taskbar-group-menu');

  scrollLeftBtn.addEventListener('click', () => {
    tabsEl.scrollBy({ left: -tabsEl.clientWidth * 0.8, behavior: 'smooth' });
  });
  scrollRightBtn.addEventListener('click', () => {
    tabsEl.scrollBy({ left: tabsEl.clientWidth * 0.8, behavior: 'smooth' });
  });
  tabsEl.addEventListener('scroll', updateScrollArrows);
  new ResizeObserver(updateScrollArrows).observe(tabsEl);

  document.addEventListener('popup:activated', (event) => {
    activeRoot = event.target;
    for (const group of groups.values()) {
      group.tabButton.classList.toggle('is-active', group.roots.includes(activeRoot));
    }
  });

  document.addEventListener('popup:minimized', (event) => {
    const info = windows.get(event.target);
    if (!info) return;
    info.minimized = event.detail.minimized;
    const group = groups.get(info.app.id);
    if (!group) return;
    group.tabButton.classList.toggle('is-minimized', isGroupMinimized(group));
    if (openGroup === group) renderGroupMenu(group); // keep the open dropdown's active row in sync
  });

  document.addEventListener('pointerdown', (event) => {
    if (openGroup && !groupMenuEl.contains(event.target) && !openGroup.tabButton.contains(event.target)) {
      closeGroupMenu();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGroupMenu();
  });
}

/** Called by main.js's openApp() right after a window is created. */
export function registerWindow(app, root) {
  windows.set(root, { app, minimized: false });

  let group = groups.get(app.id);
  if (!group) {
    group = { app, roots: [], tabButton: buildTabButton(app), countEl: null };
    group.countEl = group.tabButton.querySelector('.taskbar-tab-count');
    groups.set(app.id, group);
    order.push(app.id);
    tabsEl.appendChild(group.tabButton);
    updateScrollArrows();
  }
  group.roots.push(root);
  renderTabState(group);

  root.addEventListener('popup:closed', () => {
    windows.delete(root);
    group.roots = group.roots.filter((r) => r !== root);
    if (group.roots.length === 0) {
      group.tabButton.remove();
      groups.delete(app.id);
      order = order.filter((id) => id !== app.id);
      if (openGroup === group) closeGroupMenu();
      updateScrollArrows();
    } else {
      renderTabState(group);
      if (openGroup === group) {
        // down to one window — that's back to the single-tab, no-dropdown
        // case everywhere else in this module, so the dropdown has
        // nothing left to list
        if (group.roots.length > 1) renderGroupMenu(group);
        else closeGroupMenu();
      }
    }
  }, { once: true });
}

function buildTabButton(app) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'taskbar-tab';
  btn.title = app.name;
  btn.setAttribute('aria-label', app.name); // title alone isn't reliably exposed to a11y tools
  const iconHtml = isImageIcon(app.icon)
    ? `<img class="taskbar-tab-icon-img icon-glow" src="${app.icon}" alt="" draggable="false">`
    : `<span class="taskbar-tab-icon">${app.icon}</span>`;
  btn.innerHTML = `${iconHtml}<span class="taskbar-tab-count" hidden></span>`;

  const drag = makeDraggable(btn, app.id);

  btn.addEventListener('click', () => {
    if (drag.consumeDragFlag()) return; // that click was really the end of a drag
    const group = groups.get(app.id);
    if (!group) return;
    if (group.roots.length > 1) {
      openGroup === group ? closeGroupMenu() : openGroupMenu(group);
      return;
    }
    const root = group.roots[0];
    if (windows.get(root)?.minimized || root === activeRoot) {
      root.dispatchEvent(new CustomEvent('popup:toggle-minimize'));
    } else {
      root.dispatchEvent(new CustomEvent('popup:focus'));
    }
  });

  return btn;
}

function renderTabState(group) {
  const count = group.roots.length;
  group.countEl.hidden = count <= 1;
  group.countEl.textContent = String(count);
  group.tabButton.classList.toggle('is-minimized', isGroupMinimized(group));
}

function isGroupMinimized(group) {
  return group.roots.every((r) => windows.get(r)?.minimized);
}

/* ---------- the "N windows of this app" dropdown ---------- */

function openGroupMenu(group) {
  closeGroupMenu();
  openGroup = group;
  renderGroupMenu(group);

  const r = group.tabButton.getBoundingClientRect();
  const menuWidth = 190; // matches .taskbar-group-menu's min-width — see the CSS comment there
  groupMenuEl.style.left = `${clamp(r.left, 8, window.innerWidth - menuWidth - 8)}px`;
  groupMenuEl.hidden = false;
}

function renderGroupMenu(group) {
  groupMenuEl.innerHTML = '';
  group.roots.forEach((root, i) => {
    const label = `${group.app.name} - ${i + 1}`;

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'taskbar-group-item';
    if (root === activeRoot) item.classList.add('is-active');
    if (windows.get(root)?.minimized) item.classList.add('is-minimized');
    item.textContent = label;
    item.addEventListener('click', () => {
      if (windows.get(root)?.minimized || root === activeRoot) {
        root.dispatchEvent(new CustomEvent('popup:toggle-minimize'));
      } else {
        root.dispatchEvent(new CustomEvent('popup:focus'));
      }
      closeGroupMenu();
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'taskbar-group-close';
    closeBtn.setAttribute('aria-label', `Close ${label}`);
    closeBtn.textContent = '✕';
    // same event widget/popup/index.js's own close button dispatches on
    // this exact root — closing from here is otherwise indistinguishable
    // from closing the window itself (registerWindow's own popup:closed
    // listener, below, is what actually tidies up the tab/dropdown after)
    closeBtn.addEventListener('click', () => {
      root.dispatchEvent(new CustomEvent('popup:closed', { bubbles: false }));
    });

    const row = document.createElement('div');
    row.className = 'taskbar-group-row';
    row.append(item, closeBtn);
    groupMenuEl.appendChild(row);
  });
}

function closeGroupMenu() {
  openGroup = null;
  groupMenuEl.hidden = true;
}

/* ---------- drag-to-reorder ---------- */

function makeDraggable(tabButton, appId) {
  let pointerId = null;
  let startX = 0;
  let startCenter = 0;
  let dragging = false;
  let justDragged = false; // read (and cleared) by the click handler in buildTabButton
  let dx = 0;
  let rafId = null;

  const applyFrame = () => {
    rafId = null;
    tabButton.style.transform = `translateX(${dx}px)`;
  };

  tabButton.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    dragging = false;
    const r = tabButton.getBoundingClientRect();
    startCenter = r.left + r.width / 2;
    tabButton.setPointerCapture(pointerId);
  });

  tabButton.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    dx = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      dragging = true;
      tabButton.classList.add('is-dragging');
    }
    if (rafId === null) rafId = requestAnimationFrame(applyFrame);
  });

  const endDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    try { tabButton.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    tabButton.classList.remove('is-dragging');
    tabButton.style.transform = '';

    if (dragging) {
      justDragged = true;
      reorder(appId, startCenter + dx);
    }
    dragging = false;
  };

  tabButton.addEventListener('pointerup', endDrag);
  tabButton.addEventListener('pointercancel', endDrag);

  return {
    consumeDragFlag() {
      const was = justDragged;
      justDragged = false;
      return was;
    },
  };
}

function reorder(appId, droppedAtCenterX) {
  const others = order.filter((id) => id !== appId);
  let targetIndex = others.findIndex((id) => {
    const r = groups.get(id).tabButton.getBoundingClientRect();
    return droppedAtCenterX < r.left + r.width / 2;
  });
  if (targetIndex === -1) targetIndex = others.length;

  others.splice(targetIndex, 0, appId);
  if (others.join() === order.join()) return; // dropped back where it started

  const allTabs = order.map((id) => groups.get(id).tabButton);
  order = others;
  flip(allTabs, () => {
    for (const id of order) tabsEl.appendChild(groups.get(id).tabButton);
  });
}

/** Multi-element FLIP — same technique as widget/app-grid's single-element
 *  version, just capturing/animating a whole list at once. */
function flip(els, mutate) {
  const before = els.map((el) => el.getBoundingClientRect());
  mutate();
  els.forEach((el, i) => {
    const after = el.getBoundingClientRect();
    const dx = before[i].left - after.left;
    if (!dx) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${dx}px)`;
    void el.offsetWidth; // commit the pre-transform before animating away from it
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.18s ease';
      el.style.transform = '';
      el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
    });
  });
}

/* ---------- overflow scroll arrows ---------- */

function updateScrollArrows() {
  const overflowing = tabsEl.scrollWidth > tabsEl.clientWidth + 1;
  scrollLeftBtn.hidden = !overflowing || tabsEl.scrollLeft <= 0;
  scrollRightBtn.hidden = !overflowing || tabsEl.scrollLeft >= tabsEl.scrollWidth - tabsEl.clientWidth - 1;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
