import { listThemes, getActiveThemeId } from '../../js/theme.js';

/**
 * Called by loader.js after this app's HTML is mounted.
 * @param {HTMLElement} container  this app instance's own root element
 */
export function init(container) {
  const list = container.querySelector('.theme-list');
  const themes = listThemes();
  let activeId = getActiveThemeId();

  document.addEventListener('os:theme-changed', (event) => {
    activeId = event.detail.id;
    render();
  });

  function render() {
    list.replaceChildren(...themes.map((theme) => buildCard(theme, theme.id === activeId)));
  }

  function buildCard(theme, isActive) {
    const { colors, fonts } = theme;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card' + (isActive ? ' is-active' : '');
    card.style.setProperty('--card-accent', colors.hotrose);
    card.setAttribute('aria-pressed', String(isActive));
    card.innerHTML = `
      <span class="theme-preview" style="background: linear-gradient(135deg, ${colors.wrapA}, ${colors.wrapB} 50%, ${colors.wrapC});">
        <span class="theme-preview-glow" style="background: radial-gradient(circle, ${colors.hotrose}, transparent 70%);"></span>
      </span>
      <span class="theme-swatches">
        ${[colors.hotrose, colors.rose, colors.aqua, colors.lilac, colors.pearl]
          .map((c) => `<span class="theme-swatch" style="background:${c}"></span>`)
          .join('')}
      </span>
      <span class="theme-name" style="font-family: '${fonts.display.family}', ${fonts.display.fallback};">${theme.name}</span>
      <span class="theme-font-label">${fonts.display.family}${isActive ? ' · active' : ''}</span>
    `;
    card.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('os:set-theme', { detail: { id: theme.id } }));
    });
    return card;
  }

  render();
}
