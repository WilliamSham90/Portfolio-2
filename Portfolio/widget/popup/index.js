import { loadWidget } from '../../loader.js';

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

  // load the actual app (its own html/css/js) into this window's body
  const body = win.querySelector('.popup-body');
  await loadWidget(app.path, body);
}
