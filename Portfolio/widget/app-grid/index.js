/**
 * Called by loader.js after this widget's HTML is mounted.
 * @param {HTMLElement} container  this widget's own root element
 * @param {Array<{id:string,name:string,icon:string}>} apps
 */
export function init(container, apps) {
  const grid = container.querySelector('.app-grid');

  for (const app of apps) {
    const btn = document.createElement('button');
    btn.className = 'app-icon';
    btn.type = 'button';
    btn.setAttribute('aria-label', `Open ${app.name}`);
    btn.innerHTML = `
      <span class="app-icon-glyph">${app.icon}</span>
      <span class="app-icon-label">${app.name}</span>
    `;
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('os:launch-app', { detail: { id: app.id } }));
    });
    grid.appendChild(btn);
  }
}
