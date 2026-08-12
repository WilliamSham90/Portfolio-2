import { loadWidget } from '../../loader.js';

// shared across every popup instance (this module is a singleton),
// so "bring to front" just means "give it a higher number than anyone else"
let zTop = 10;

/**
 * Called by loader.js after this widget's HTML is mounted.
 * @param {HTMLElement} container  this popup instance's own root element
 * @param {{id:string,name:string,path:string}} app  the app to display
 * @param {number} offset  pixel offset so multiple windows don't stack exactly
 */
export async function init(container, app, offset = 0) {
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

  makeDraggable(win, win.querySelector('.popup-titlebar'));

  // load the actual app (its own html/css/js) into this window's body
  const body = win.querySelector('.popup-body');
  await loadWidget(app.path, body);
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
  let frameRequested = false;

  const applyFrame = () => {
    frameRequested = false;
    win.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.popup-close')) return;
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
    if (!frameRequested) {
      frameRequested = true;
      requestAnimationFrame(applyFrame);
    }
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
