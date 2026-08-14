/* =====================================================================
   clock-panel.js
   The taskbar clock (time + date) and the slide-in panel it opens on
   click — same "kernel module with its own fixed slot in index.html"
   shape as start-menu.js/power.js, mirrored to the right edge instead
   of the left, and sliding in via a CSS transform instead of start-menu's
   plain show/hide (see .clock-panel in css/main.css). Read-only — a
   clock and the current month's calendar, nothing persisted, so there's
   no localStorage key and no os:reset listener to add.
   ===================================================================== */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function initClockPanel() {
  const button = document.getElementById('taskbar-clock-button');
  const timeEl = button.querySelector('.taskbar-clock-time');
  const dateEl = button.querySelector('.taskbar-clock-date');

  const panel = document.getElementById('clock-panel');
  const panelTime = panel.querySelector('.clock-panel-time');
  const panelDate = panel.querySelector('.clock-panel-date');

  const tick = () => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timeEl.textContent = time;
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    panelTime.textContent = time;
    panelDate.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  tick();
  setInterval(tick, 1000 * 15);

  renderCalendar(panel, new Date());

  let hideTimer = null;

  const show = () => {
    clearTimeout(hideTimer);
    panel.hidden = false;
    void panel.offsetWidth; // force reflow before the transition, same trick power.js uses for its overlay
    panel.classList.add('is-open');
    button.classList.add('is-active');
  };

  const hide = () => {
    panel.classList.remove('is-open');
    button.classList.remove('is-active');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { panel.hidden = true; }, 300); // matches the CSS transition duration
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (panel.hidden || !panel.classList.contains('is-open')) show(); else hide();
  });
  document.addEventListener('pointerdown', (event) => {
    if (panel.classList.contains('is-open') && !panel.contains(event.target) && event.target !== button) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
}

function renderCalendar(panel, today) {
  const monthEl = panel.querySelector('.clock-panel-cal-month');
  const gridEl = panel.querySelector('.clock-panel-cal-grid');

  const year = today.getFullYear();
  const month = today.getMonth();
  monthEl.textContent = `${MONTHS[month]} ${year}`;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = WEEKDAYS.map((day) => `<span class="clock-panel-cal-weekday">${day}</span>`);
  for (let i = 0; i < firstWeekday; i++) cells.push('<span class="clock-panel-cal-day is-empty"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === today.getDate();
    cells.push(`<span class="clock-panel-cal-day${isToday ? ' is-today' : ''}">${day}</span>`);
  }
  gridEl.innerHTML = cells.join('');
}
