import { loadWidget } from '../../loader.js';

// shared across every popup instance (this module is a singleton),
// so "bring to front" just means "give it a higher number than anyone else"
let zTop = 10;

/**
 * Called by loader.js after this widget's HTML is mounted.
 * @param {HTMLElement} container  this popup instance's own root element
 * @param {{id:string,name:string,path:string}} app  the app to display
 * @param {number} offset  pixel offset so multiple windows don't stack exactly
 * @param {any[]} appInitArgs  extra args passed straight through to the app's own init()
 */
export async function init(container, app, offset = 0, appInitArgs = []) {
  const win = container.querySelector('.popup-window');
  win.style.top = `${80 + offset}px`;
  win.style.left = `${80 + offset}px`;

  win.querySelector('.popup-title').textContent = app.name;

  win.querySelector('.popup-close').addEventListener('click', () => {
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
  makeMaximizable(win, handle, win.querySelector('.popup-maximize'));
  makeMinimizable(win, container, win.querySelector('.popup-minimize'));

  // load the actual app (its own html/css/js) into this window's body
  const body = win.querySelector('.popup-body');
  await loadWidget(app.path, body, { initArgs: appInitArgs });
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
 * Maximize fills the desktop area (#popup-layer — the space above the
 * taskbar), not the real browser window; that's just a CSS class
 * (.is-maximized, see index.css) rather than the Fullscreen API, which
 * would take over the whole browser and hide the taskbar along with it.
 * Toggled by the titlebar button or a titlebar double-click, same as any
 * normal OS window.
 */
function makeMaximizable(win, handle, button) {
  let restoreLeft = null;
  let restoreTop = null;

  const toggle = () => {
    const maximizing = !win.classList.contains('is-maximized');
    if (maximizing) {
      restoreLeft = win.style.left;
      restoreTop = win.style.top;
      win.style.left = '';
      win.style.top = '';
      win.classList.add('is-maximized');
    } else {
      win.classList.remove('is-maximized');
      win.style.left = restoreLeft;
      win.style.top = restoreTop;
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
