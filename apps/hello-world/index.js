/**
 * Called by loader.js after this app's HTML is mounted inside the popup.
 * @param {HTMLElement} container  this app's own root element
 */
export function init(container) {
  const text = container.querySelector('.hello-text');
  const btn = container.querySelector('.hello-btn');
  let clicks = 0;

  btn.addEventListener('click', () => {
    clicks++;
    text.textContent = clicks === 1 ? "You clicked once!" : `You clicked ${clicks} times!`;
  });
}
