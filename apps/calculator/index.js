/* =====================================================================
   calculator/index.js
   A standard (non-scientific) calculator — same left-to-right chained
   evaluation real "Standard mode" calculators use (2 + 3 × 4 = 20, not
   14; parentheses/precedence are a scientific-mode feature, out of scope
   here), not a parsed-expression evaluator. State lives entirely in this
   module's closure — a fresh instance is created each time the app
   opens (loader.js), so nothing needs resetting between windows.

   Keyboard shortcuts (0-9, +, Enter for "=", etc.) were deliberately left
   out: real <button> elements already give free, correct keyboard
   accessibility (Tab + Enter/Space activates one, no extra ARIA needed —
   the actual accessibility requirement), and number-key shortcuts would
   need a document-level keydown listener scoped to "this window is the
   active one" and torn down when it closes — machinery no other app here
   has, for a convenience feature, not an accessibility one.
   ===================================================================== */

const MAX_DIGITS = 15;

export function init(container) {
  const expressionEl = container.querySelector('.calc-expression');
  const resultEl = container.querySelector('.calc-result');
  const clearBtn = container.querySelector('[data-action="clear"]');

  // `display` is always the plain, re-parseable numeric string ("1234.5",
  // never "1,234.5") — thousands separators are applied only in render(),
  // to resultEl's text, never fed back into this state (see groupThousands)
  let display = '0';
  let previousValue = null;
  let pendingOperator = null;
  let expression = '';
  let overwrite = true; // next digit press replaces display instead of appending
  let errored = false;

  container.querySelector('.calc-pad').addEventListener('click', (event) => {
    const btn = event.target.closest('.calc-btn');
    if (!btn) return;

    if (btn.dataset.digit !== undefined) inputDigit(btn.dataset.digit);
    else if (btn.dataset.op !== undefined) chooseOperator(btn.dataset.op);
    else if (btn.dataset.action === 'decimal') inputDigit('.');
    else if (btn.dataset.action === 'clear') clearAll();
    else if (btn.dataset.action === 'negate') negate();
    else if (btn.dataset.action === 'percent') percent();
    else if (btn.dataset.action === 'equals') equals();
  });

  function inputDigit(digit) {
    if (errored) clearAll();
    if (overwrite) {
      display = digit === '.' ? '0.' : digit;
      overwrite = false;
    } else if (digit === '.') {
      if (!display.includes('.')) display += '.';
    } else if (digitCount(display) < MAX_DIGITS) {
      display = display === '0' ? digit : display + digit;
    }
    render();
  }

  function chooseOperator(op) {
    if (errored) return;
    const current = parseFloat(display);
    if (pendingOperator && !overwrite) {
      if (!settle(compute(previousValue, current, pendingOperator))) return;
    } else {
      previousValue = current;
    }
    pendingOperator = op;
    overwrite = true;
    expression = `${groupThousands(formatNumber(previousValue))} ${op}`;
    render();
  }

  function equals() {
    if (errored || pendingOperator === null) return;
    const a = previousValue;
    const b = parseFloat(display);
    const op = pendingOperator;
    expression = `${groupThousands(formatNumber(a))} ${op} ${groupThousands(formatNumber(b))} =`;
    if (!settle(compute(a, b, op))) return;
    previousValue = null;
    pendingOperator = null;
    overwrite = true;
    render();
  }

  function negate() {
    if (errored || display === '0') return;
    display = display.startsWith('-') ? display.slice(1) : `-${display}`;
    render();
  }

  function percent() {
    if (errored) return;
    const current = parseFloat(display);
    // "200 + 10%" means "10% of 200" (20), not "0.1" — matches Windows
    // Calculator's Standard mode, not the flatter "just divide by 100"
    // behavior simpler calculators use
    const result = pendingOperator && previousValue !== null
      ? previousValue * (current / 100)
      : current / 100;
    // only the current entry becomes the percentage — unlike settle()
    // below, previousValue (the running total "+" still applies to) must
    // stay exactly what it was, or a later "=" adds/subtracts/etc. against
    // the wrong number
    const formatted = formatOrFail(result);
    if (formatted === null) return;
    display = formatted;
    overwrite = true;
    render();
  }

  function clearAll() {
    display = '0';
    previousValue = null;
    pendingOperator = null;
    expression = '';
    overwrite = true;
    errored = false;
    render();
  }

  /** Applies a computed value as the new display/previousValue, or fails
   *  cleanly (divide-by-zero, overflow) — the one place either can happen. */
  function settle(value) {
    const formatted = formatOrFail(value);
    if (formatted === null) return false;
    display = formatted;
    previousValue = value; // full precision kept for further chaining — see formatNumber
    return true;
  }

  /** Shared by settle() and percent(): null in (divide-by-zero) or an
   *  unrepresentable result (overflow) both fail the same way. */
  function formatOrFail(value) {
    if (value === null) {
      fail();
      return null;
    }
    const formatted = formatNumber(value);
    if (formatted === null) {
      fail();
      return null;
    }
    return formatted;
  }

  function fail() {
    display = 'Error';
    previousValue = null;
    pendingOperator = null;
    overwrite = true;
    errored = true;
    render();
  }

  function render() {
    expressionEl.textContent = expression;
    resultEl.textContent = display === 'Error' ? display : groupThousands(display);
    clearBtn.textContent = display === '0' && previousValue === null && pendingOperator === null
      ? 'AC'
      : 'C';
  }

  render();
}

function compute(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
    default: return null;
  }
}

/**
 * Rounds off binary floating-point noise (0.1 + 0.2 -> 0.30000000000000004)
 * for display only — every calculation above works off the raw, unrounded
 * numbers (previousValue), this just decides what gets shown/reparsed.
 * Returns null for anything that can't be shown as a plain decimal — an
 * overflow into exponential notation, basically — a real basic calculator
 * shows "Error" there too rather than raw scientific notation.
 */
function formatNumber(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toPrecision(12));
  const str = String(rounded);
  if (str.includes('e') || digitCount(str) > MAX_DIGITS) return null;
  return str;
}

/** Adds thousands separators to a plain numeric string, for display only. */
function groupThousands(numStr) {
  const negative = numStr.startsWith('-');
  const [intPart, fracPart] = (negative ? numStr.slice(1) : numStr).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + grouped + (fracPart !== undefined ? `.${fracPart}` : '');
}

function digitCount(str) {
  return str.replace(/[-.]/g, '').length;
}
