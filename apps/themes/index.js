import { listThemes, getActiveThemeId } from '../../js/theme.js';
import { listIconStyles, getIconStyle, setIconStyle } from '../../js/icon-style.js';
import { listWallpapers, getWallpaperId, setWallpaper } from '../../js/wallpaper.js';

/**
 * Called by loader.js after this app's HTML is mounted.
 * @param {HTMLElement} container  this app instance's own root element
 */
export function init(container) {
  initThemeSection(container);
  initIconStyleSection(container);
  initWallpaperSection(container);
}

function initThemeSection(container) {
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

function initIconStyleSection(container) {
  const list = container.querySelector('.icon-style-list');
  const styles = listIconStyles();
  let activeId = getIconStyle();

  document.addEventListener('os:icon-style-changed', (event) => {
    activeId = event.detail.id;
    render();
  });

  function render() {
    list.replaceChildren(...styles.map((style) => buildCard(style, style.id === activeId)));
  }

  function buildCard(style, isActive) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'icon-style-card' + (isActive ? ' is-active' : '');
    card.setAttribute('aria-pressed', String(isActive));
    card.innerHTML = `
      <img class="icon-style-preview" src="${style.folderIcon}" alt="" draggable="false" />
      <span class="icon-style-name">${style.name}${isActive ? ' · active' : ''}</span>
    `;
    card.addEventListener('click', () => setIconStyle(style.id));
    return card;
  }

  render();
}

function initWallpaperSection(container) {
  const list = container.querySelector('.wallpaper-list');
  const wallpapers = listWallpapers();
  let activeId = getWallpaperId();

  document.addEventListener('os:wallpaper-changed', (event) => {
    activeId = event.detail.id;
    render();
  });

  function render() {
    list.replaceChildren(...wallpapers.map((wallpaper) => buildCard(wallpaper, wallpaper.id === activeId)));
  }

  function buildCard(wallpaper, isActive) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'wallpaper-card' + (isActive ? ' is-active' : '');
    card.setAttribute('aria-pressed', String(isActive));
    // "None" gets the same gradient the desktop itself falls back to
    // (--desktop-gradient, main.css) instead of an <img> — there's no
    // photo to fetch for it, so it shouldn't request one
    const previewHtml = wallpaper.url
      ? `<img class="wallpaper-preview" src="${wallpaper.url}" alt="" draggable="false" loading="lazy" decoding="async">`
      : `<span class="wallpaper-preview wallpaper-preview-none"></span>`;
    card.innerHTML = `
      ${previewHtml}
      <span class="wallpaper-name">${wallpaper.name}${isActive ? ' · active' : ''}</span>
    `;
    card.addEventListener('click', () => setWallpaper(wallpaper.id));
    return card;
  }

  render();
}
