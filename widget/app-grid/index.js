const STORAGE_KEY = 'os-app-grid-slots-v1';
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag, not a tap

/**
 * Called by loader.js after this widget's HTML is mounted.
 * @param {HTMLElement} container  this widget's own root element
 * @param {Array<{id:string,name:string,icon:string}>} apps
 */
export function init(container, apps) {
  const grid = container.querySelector('.app-grid');
  const elsByAppId = new Map();

  const ctx = {
    grid,
    apps,
    elsByAppId,
    slotMap: loadSlots(apps),
    highlight: document.createElement('div'),
  };
  ctx.highlight.className = 'drop-highlight';
  grid.appendChild(ctx.highlight);

  for (const app of apps) {
    const btn = document.createElement('button');
    btn.className = 'app-icon';
    btn.type = 'button';
    btn.setAttribute('aria-label', `Open ${app.name}`);
    btn.innerHTML = `
      <span class="app-icon-glyph">${app.icon}</span>
      <span class="app-icon-label">${app.name}</span>
    `;
    grid.appendChild(btn);
    elsByAppId.set(app.id, btn);
    makeIconDraggable(btn, app, ctx);
  }

  layout(ctx);

  // reflow (column count can change) whenever the grid is resized — window
  // resize, orientation change, sidebar toggling, etc.
  const resizeObserver = new ResizeObserver(() => layout(ctx));
  resizeObserver.observe(grid);
}

/* ---------- grid geometry ---------- */

function metrics(ctx) {
  const style = getComputedStyle(ctx.grid);
  const cell = parseFloat(style.getPropertyValue('--cell-size'));
  const gap = parseFloat(style.getPropertyValue('--cell-gap'));
  const pad = parseFloat(style.getPropertyValue('--grid-pad'));
  const rect = ctx.grid.getBoundingClientRect();
  const innerWidth = rect.width - pad * 2;
  const cols = Math.max(1, Math.floor((innerWidth + gap) / (cell + gap)));
  const rows = Math.max(1, Math.ceil(ctx.apps.length / cols));
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
  for (const app of ctx.apps) {
    placeElAt(ctx.elsByAppId.get(app.id), ctx.slotMap[app.id], cols);
  }
}

function appIdAtSlot(ctx, slot, excludeAppId) {
  for (const app of ctx.apps) {
    if (app.id !== excludeAppId && ctx.slotMap[app.id] === slot) return app.id;
  }
  return null;
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

/* ---------- dragging an icon to reposition it ---------- */

function makeIconDraggable(el, app, ctx) {
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
      originSlot = ctx.slotMap[app.id];
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
      const occupantId = appIdAtSlot(ctx, slot, app.id);
      showHighlight(ctx, row, col, m, Boolean(occupantId));
      if (occupantId) {
        swapTargetEl = ctx.elsByAppId.get(occupantId);
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

    if (!dragging) return; // it was just a tap — let the click handler open the app

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
      const occupantId = appIdAtSlot(ctx, targetSlot, app.id);
      if (occupantId) {
        const occupantEl = ctx.elsByAppId.get(occupantId);
        flip(occupantEl, () => {
          ctx.slotMap[occupantId] = originSlot;
          placeElAt(occupantEl, originSlot, cols);
        });
      }
      flip(el, () => {
        el.style.transform = '';
        ctx.slotMap[app.id] = targetSlot;
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
    document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id: app.id } }));
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ---------- persistence: which slot each app icon is parked in ---------- */

function loadSlots(apps) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    saved = {};
  }

  const used = new Set();
  const slots = {};

  for (const app of apps) {
    const slot = saved[app.id];
    if (Number.isInteger(slot) && slot >= 0 && !used.has(slot)) {
      slots[app.id] = slot;
      used.add(slot);
    }
  }

  let next = 0;
  for (const app of apps) {
    if (slots[app.id] === undefined) {
      while (used.has(next)) next++;
      slots[app.id] = next;
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
