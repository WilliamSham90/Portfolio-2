import { loadWidget } from '../../js/loader.js';
import { isImageIcon } from '../../js/icon.js';

// shared across every popup instance (this module is a singleton),
// so "bring to front" just means "give it a higher number than anyone else"
let zTop = 10;

const MIN_WIDTH = 260;
const MIN_HEIGHT = 180;

/**
 * Called by loader.js after this widget's HTML is mounted.
 * @param {HTMLElement} container  this popup instance's own root element
 * @param {{id:string,name:string,path:string}} app  the app to display
 * @param {number} offset  pixel offset so multiple windows don't stack exactly
 * @param {any[]} appInitArgs  extra args passed straight through to the app's own init()
 */
export async function init(container, app, offset = 0, appInitArgs = []) {
  const win = container.querySelector('.popup-window');
  const body = win.querySelector('.popup-body');

  // opens centered, clamped so it's never off-screen either — matters most
  // on a narrow (mobile) viewport, where a window sized/centered for a
  // wider one could otherwise land partly past the edge before it's ever
  // been touched. This can't just measure win.offsetWidth/Height here (the
  // obvious thing to reach for, and what the drag/resize clamps below
  // both do) — the window has no width of its own, only min/max-width
  // bounds, so its real size depends on the app's content, which hasn't
  // loaded into .popup-body yet at this point. Mirroring the CSS max-width
  // formula instead gives the window's worst-case (largest possible) size
  // without needing to wait for that; the real size, once content loads,
  // is always that or smaller, so a window centered/clamped against this
  // can't end up overflowing (or noticeably off-center) once it settles.
  const layerBounds = container.parentElement.getBoundingClientRect();
  const maxPossibleWidth = Math.min(600, layerBounds.width * 0.9); // matches index.css's max-width: min(600px, 90vw)
  const maxPossibleHeight = Math.min(layerBounds.height * 0.7 + 30, layerBounds.height); // 70vh body cap + ~30px titlebar
  const openLeft = Math.max(layerBounds.width - maxPossibleWidth, 0);
  const openTop = Math.max(layerBounds.height - maxPossibleHeight, 0);
  // centered by default (openLeft/openTop already equal the leftover space
  // around a worst-case-sized window, so half of that is dead center) —
  // `offset` still nudges each additional window from the last, same
  // diagonal cascade as before, just anchored to the middle instead of a
  // fixed top-left corner
  win.style.left = `${clamp(openLeft / 2 + offset, 0, openLeft)}px`;
  win.style.top = `${clamp(openTop / 2 + offset, 0, openTop)}px`;

  win.querySelector('.popup-title').textContent = app.name;
  const iconEl = win.querySelector('.popup-icon');
  if (isImageIcon(app.icon)) {
    iconEl.innerHTML = `<img class="popup-icon-img" src="${app.icon}" alt="" draggable="false">`;
  } else {
    iconEl.textContent = app.icon;
  }

  // an app can veto/delay closing (Notepad's unsaved-changes prompt, say)
  // by exporting an async beforeClose() that resolves false — set below,
  // once the app's own module has actually loaded; null until then just
  // means "nothing to ask", so a close click that somehow lands before
  // that load finishes still closes immediately rather than erroring
  let beforeClose = null;

  win.querySelector('.popup-close').addEventListener('click', async () => {
    if (beforeClose && !(await beforeClose())) return;
    container.dispatchEvent(new CustomEvent('popup:closed', { bubbles: false }));
  });

  // clicking anywhere on the window brings it to front + tells the
  // taskbar tab to highlight itself as the active one
  win.addEventListener('pointerdown', () => activate(win, container));
  // the taskbar tab asks for this directly when clicked
  container.addEventListener('popup:focus', () => activate(win, container));
  activate(win, container);

  const handle = win.querySelector('.popup-titlebar');
  makeDraggable(win, handle);
  makeResizable(win, body, win.querySelector('.popup-resize-handle'));
  makeMaximizable(win, body, handle, win.querySelector('.popup-maximize'));
  makeMinimizable(win, container, win.querySelector('.popup-minimize'));

  // load the actual app (its own html/css/js) into this window's body
  const { initResult } = await loadWidget(app.path, body, { initArgs: appInitArgs });
  if (initResult && typeof initResult.beforeClose === 'function') beforeClose = initResult.beforeClose;
}

function activate(win, container) {
  zTop += 1;
  win.style.zIndex = String(zTop);
  container.dispatchEvent(new CustomEvent('popup:activated', { bubbles: true }));
}

/**
 * Drag the window by its titlebar, clamped so it always stays fully
 * visible on the desktop. Uses a CSS transform while dragging (cheap for
 * the browser to animate) and only "bakes" that into real left/top once,
 * on release — much smoother than writing left/top on every pixel of
 * movement, especially on a blurred/translucent window like this one.
 */
function makeDraggable(win, handle) {
  let dragging = false;
  let startX = 0, startY = 0;
  let originLeft = 0, originTop = 0;
  let dx = 0, dy = 0;
  let rafId = null;

  const applyFrame = () => {
    rafId = null;
    win.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.popup-titlebar-actions')) return; // minimize/maximize/close, not a drag
    if (win.classList.contains('is-maximized')) return; // nothing to drag when it's filling the screen
    dragging = true;
    dx = 0;
    dy = 0;
    startX = event.clientX;
    startY = event.clientY;
    originLeft = win.offsetLeft;
    originTop = win.offsetTop;
    handle.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);
    document.body.style.userSelect = 'none';
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dx = event.clientX - startX;
    dy = event.clientY - startY;
    if (rafId === null) {
      rafId = requestAnimationFrame(applyFrame);
    }
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    // a pointermove right before release can leave a frame queued; without
    // cancelling it here, that stale frame fires on the next paint (after
    // left/top have already been baked below) and re-applies the old
    // transform on top of the new position — the "jumps somewhere else on
    // release" bug.
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    handle.classList.remove('is-dragging');
    handle.releasePointerCapture(event.pointerId);
    document.body.style.userSelect = '';

    // bounds = the popup's positioned ancestor (#popup-layer), which is
    // sized to exactly the visible desktop area above the taskbar
    const bounds = win.offsetParent.getBoundingClientRect();
    const maxLeft = Math.max(bounds.width - win.offsetWidth, 0);
    const maxTop = Math.max(bounds.height - win.offsetHeight, 0);

    const newLeft = clamp(originLeft + dx, 0, maxLeft);
    const newTop = clamp(originTop + dy, 0, maxTop);

    win.style.transform = 'none';
    win.style.left = `${newLeft}px`;
    win.style.top = `${newTop}px`;
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

/**
 * Drag the bottom-right corner to resize. Once a window's been resized it
 * has an explicit width/height/max-width from here on (rather than the
 * CSS min/max-width + content-driven height it starts with) — real
 * layout reflow on every frame, not a scaled-up snapshot, so content
 * genuinely re-wraps/rescales as it goes rather than just stretching.
 */
function makeResizable(win, body, handle) {
  let resizing = false;
  let startX = 0, startY = 0;
  let startWidth = 0, startHeight = 0;
  let pendingWidth = 0, pendingHeight = 0;
  let rafId = null;

  const applyFrame = () => {
    rafId = null;
    win.style.width = `${pendingWidth}px`;
    win.style.height = `${pendingHeight}px`;
  };

  handle.addEventListener('pointerdown', (event) => {
    if (win.classList.contains('is-maximized')) return; // nothing to resize when it already fills the screen
    resizing = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = win.offsetWidth;
    startHeight = win.offsetHeight;
    // switch from CSS-driven sizing (min/max-width, content-height) to an
    // explicit size the drag can add pixels to; the 70vh cap on .popup-body
    // (index.css) only makes sense for a content-driven window, so it's
    // lifted here too, same as when maximizing
    win.style.width = `${startWidth}px`;
    win.style.height = `${startHeight}px`;
    win.style.maxWidth = 'none';
    body.style.maxHeight = 'none';
    handle.classList.add('is-resizing');
    handle.setPointerCapture(event.pointerId);
    document.body.style.userSelect = 'none';
    event.preventDefault(); // don't let this also read as a titlebar drag or text selection
  });

  handle.addEventListener('pointermove', (event) => {
    if (!resizing) return;
    // bounds = the popup's positioned ancestor (#popup-layer) — can't grow
    // past the visible desktop, same rule dragging already follows
    const bounds = win.offsetParent.getBoundingClientRect();
    const maxWidth = Math.max(MIN_WIDTH, bounds.width - win.offsetLeft);
    const maxHeight = Math.max(MIN_HEIGHT, bounds.height - win.offsetTop);
    pendingWidth = clamp(startWidth + (event.clientX - startX), MIN_WIDTH, maxWidth);
    pendingHeight = clamp(startHeight + (event.clientY - startY), MIN_HEIGHT, maxHeight);
    if (rafId === null) rafId = requestAnimationFrame(applyFrame);
  });

  const endResize = (event) => {
    if (!resizing) return;
    resizing = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    handle.classList.remove('is-resizing');
    try { handle.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    document.body.style.userSelect = '';
  };

  handle.addEventListener('pointerup', endResize);
  handle.addEventListener('pointercancel', endResize);
}

/**
 * Maximize fills the desktop area (#popup-layer — the space above the
 * taskbar), not the real browser window; that's just a CSS class
 * (.is-maximized, see index.css) rather than the Fullscreen API, which
 * would take over the whole browser and hide the taskbar along with it.
 * Toggled by the titlebar button or a titlebar double-click, same as any
 * normal OS window. Restores whatever geometry — position, and size if
 * it's ever been manually resized — the window had right before.
 */
function makeMaximizable(win, body, handle, button) {
  let restore = null;

  const toggle = () => {
    const maximizing = !win.classList.contains('is-maximized');
    if (maximizing) {
      restore = {
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
        maxWidth: win.style.maxWidth,
        bodyMaxHeight: body.style.maxHeight,
      };
      win.style.left = '';
      win.style.top = '';
      win.style.width = '';
      win.style.height = '';
      win.style.maxWidth = '';
      body.style.maxHeight = 'none';
      win.classList.add('is-maximized');
    } else {
      win.classList.remove('is-maximized');
      win.style.left = restore.left;
      win.style.top = restore.top;
      win.style.width = restore.width;
      win.style.height = restore.height;
      win.style.maxWidth = restore.maxWidth;
      body.style.maxHeight = restore.bodyMaxHeight;
    }
    button.innerHTML = maximizing ? '&#9635;' : '&#9633;';
    button.setAttribute('aria-label', maximizing ? 'Restore' : 'Maximize');
  };

  button.addEventListener('click', toggle);
  handle.addEventListener('dblclick', (event) => {
    if (event.target.closest('.popup-titlebar-actions')) return;
    toggle();
  });
}

/** Minimize just hides the window (see .is-minimized in index.css) — its
 *  taskbar tab is what brings it back. */
function makeMinimizable(win, container, button) {
  const setMinimized = (minimized) => {
    win.classList.toggle('is-minimized', minimized);
    container.dispatchEvent(new CustomEvent('popup:minimized', { detail: { minimized }, bubbles: true }));
    if (!minimized) activate(win, container);
  };

  button.addEventListener('click', () => setMinimized(true));
  // the taskbar tab dispatches this when its window is minimized (restore
  // it) or already active (minimize it) — see createTaskbarTab in main.js
  container.addEventListener('popup:toggle-minimize', () => {
    setMinimized(!win.classList.contains('is-minimized'));
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
