/* =====================================================================
   clock-panel.js
   The taskbar clock (time + date) and the slide-in panel it opens on
   click — same "kernel module with its own fixed slot in index.html"
   shape as start-menu.js/power.js, mirrored to the right edge instead
   of the left, and sliding in via a CSS transform instead of start-menu's
   plain show/hide (see .clock-panel in css/main.css). The clock itself
   always shows the real current time; the calendar underneath it is
   independently browsable (see renderCalendar/navigate below) and marks
   South African public holidays — nothing here persists any state, so
   there's no localStorage key and no os:reset listener to add.
   ===================================================================== */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// recurs every year — month is 0-indexed (0 = January), same as Date
const BIRTHDAY = { month: 0, day: 17, label: "William's Birthday" };

export function initClockPanel() {
  const button = document.getElementById('taskbar-clock-button');
  const timeEl = button.querySelector('.taskbar-clock-time');
  const dateEl = button.querySelector('.taskbar-clock-date');

  const panel = document.getElementById('clock-panel');
  const panelTime = panel.querySelector('.clock-panel-time');
  const panelDate = panel.querySelector('.clock-panel-date');
  const prevButton = panel.querySelector('.clock-panel-cal-prev');
  const nextButton = panel.querySelector('.clock-panel-cal-next');

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

  // the calendar's browsable month is independent of "now" above — it
  // starts on the current month but navigating it doesn't touch the clock
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();

  const renderView = () => renderCalendar(panel, viewYear, viewMonth, today);
  renderView();

  prevButton.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderView();
  });
  nextButton.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderView();
  });

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

function renderCalendar(panel, year, month, today) {
  const monthEl = panel.querySelector('.clock-panel-cal-month');
  const gridEl = panel.querySelector('.clock-panel-cal-grid');

  monthEl.textContent = `${MONTHS[month]} ${year}`;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidays = southAfricaHolidays(year);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const cells = WEEKDAYS.map((day) => `<span class="clock-panel-cal-weekday">${day}</span>`);
  for (let i = 0; i < firstWeekday; i++) cells.push('<span class="clock-panel-cal-day is-empty"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && day === today.getDate();
    const isBirthday = month === BIRTHDAY.month && day === BIRTHDAY.day;
    const holidayName = holidays.get(dateKey(year, month, day));

    const classes = ['clock-panel-cal-day'];
    if (isToday) classes.push('is-today');
    if (holidayName) classes.push('is-holiday');
    if (isBirthday) classes.push('is-birthday');

    const titles = [holidayName, isBirthday ? BIRTHDAY.label : null].filter(Boolean);
    const title = titles.length ? ` title="${titles.join(' · ')}"` : '';

    cells.push(`<span class="${classes.join(' ')}"${title}>${day}</span>`);
  }
  gridEl.innerHTML = cells.join('');
}

/**
 * South African public holidays for a given year: the ten fixed-date ones
 * plus the two Easter-based ones (Good Friday, Family Day/Easter Monday),
 * with the "falls on a Sunday -> following Monday is also a holiday" rule
 * the Public Holidays Act adds on top.
 * ponytail: doesn't special-case the rare year where that Monday-shift
 * would land Christmas Day's observed holiday on the same date as Day of
 * Goodwill (26 Dec) — real law nudges that one further to the 27th. Worth
 * fixing if this calendar ever needs to be authoritative; not worth the
 * extra branching for a "which day is Youth Day" panel.
 */
function southAfricaHolidays(year) {
  const easter = easterSunday(year);

  const fixed = [
    [0, 1, "New Year's Day"],
    [2, 21, 'Human Rights Day'],
    [3, 27, 'Freedom Day'],
    [4, 1, "Workers' Day"],
    [5, 16, 'Youth Day'],
    [7, 9, "National Women's Day"],
    [8, 24, 'Heritage Day'],
    [11, 16, 'Day of Reconciliation'],
    [11, 25, 'Christmas Day'],
    [11, 26, 'Day of Goodwill'],
  ];

  const holidays = new Map();
  const add = (date, name) => {
    holidays.set(dateKey(date.getFullYear(), date.getMonth(), date.getDate()), name);
    if (date.getDay() === 0) {
      const observed = addDays(date, 1);
      holidays.set(dateKey(observed.getFullYear(), observed.getMonth(), observed.getDate()), `${name} (observed)`);
    }
  };

  for (const [month, day, name] of fixed) add(new Date(year, month, day), name);
  add(addDays(easter, -2), 'Good Friday');
  add(addDays(easter, 1), 'Family Day');

  return holidays;
}

/** Meeus/Jones/Butcher Gregorian algorithm for the date of Easter Sunday. */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(year, Math.floor(n / 31) - 1, (n % 31) + 1);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateKey(year, month, day) {
  return `${year}-${month}-${day}`;
}
