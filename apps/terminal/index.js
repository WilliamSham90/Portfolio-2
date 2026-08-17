/* =====================================================================
   apps/terminal/index.js
   A tiny fake terminal: type a command, get a line (or a few) back. Every
   response is typed out character by character rather than just dropped
   in — the same effect js/power.js's boot log uses (a fixed-interval
   setTimeout loop appending one character at a time) — since this was
   asked to feel like that same boot sequence. The user's own typed input
   isn't re-animated on echo; it's already been typed once, by them.
   ===================================================================== */

const PROMPT = 'guest@williams-os:~$';

const COLORS = {
  green:   '#4dff6a', // default — matches power.js's boot-log green exactly
  white:   '#f5f5f5',
  amber:   '#ffb000',
  cyan:    '#4ad9ff',
  magenta: '#ff4ad9',
  red:     '#ff4d4d',
  blue:    '#4d8bff',
  orange:  '#ff8c3d',
};

const HELP_TEXT = [
  'Available commands:',
  '  help            show this list of commands',
  '  sysinfo         show info about this portfolio / OS',
  `  color <name>    change the text color (${Object.keys(COLORS).join(', ')})`,
  '  clear           clear the terminal',
].join('\n');

const SYSINFO_TEXT = [
  'OS: Williams OS',
  'Host: William Sham',
  'Role: Full Stack Developer',
  'Location: South Africa',
  'Uptime: Turning ideas into code since day one',
  'Passion: Websites, Digital Art, 3D Models, Game Design, Creating Solutions',
  '',
  'I turn ideas into code and code into solutions — full-stack web',
  'developer with a love for clean design, intuitive user experiences,',
  'and making things work behind the scenes.',
].join('\n');

/**
 * @param {HTMLElement} container  this app's own root element
 */
export function init(container) {
  const app = container.querySelector('.term-app');
  const output = container.querySelector('.term-output');
  const input = container.querySelector('.term-input');

  let color = COLORS.green;
  let busy = false;
  app.style.setProperty('--term-fg', color);

  // click anywhere in the window to focus the input, not just the input
  // row itself — same expectation a real terminal window sets
  app.addEventListener('pointerdown', (event) => {
    if (event.target !== input) input.focus();
  });

  input.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' || busy) return;
    const raw = input.value;
    input.value = '';
    printLine(`${PROMPT} ${raw}`);
    const trimmed = raw.trim();
    if (!trimmed) return;
    await runCommand(trimmed);
  });

  runIntro();

  async function runIntro() {
    await withInputLocked(() => typeText('Williams OS terminal — type "help" to get started.'));
  }

  async function runCommand(raw) {
    await withInputLocked(async () => {
      const [name, ...args] = raw.split(/\s+/);
      switch (name.toLowerCase()) {
        case 'clear':
          output.textContent = '';
          return;
        case 'help':
          return typeText(HELP_TEXT);
        case 'sysinfo':
          return typeText(SYSINFO_TEXT);
        case 'color':
          return runColor(args[0]);
        default:
          return typeText(`command not found: ${name}. Type "help" for a list of commands.`);
      }
    });
  }

  async function runColor(name) {
    if (!name) {
      const current = Object.keys(COLORS).find((key) => COLORS[key] === color);
      return typeText(`current color: ${current}\nusage: color <${Object.keys(COLORS).join('|')}>`);
    }
    const hex = COLORS[name.toLowerCase()];
    if (!hex) {
      return typeText(`unknown color: ${name}. Choose one of: ${Object.keys(COLORS).join(', ')}`);
    }
    color = hex;
    app.style.setProperty('--term-fg', color);
    return typeText(`color set to ${name.toLowerCase()}`);
  }

  // disables the input for the duration of an async response so a second
  // command can't get typed mid-animation and have its own output interleave
  async function withInputLocked(run) {
    busy = true;
    input.disabled = true;
    await run();
    input.disabled = false;
    input.focus();
    busy = false;
  }

  function printLine(text) {
    const line = document.createElement('div');
    line.className = 'term-line';
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    return line;
  }

  function typeText(text) {
    const line = printLine('');
    line.classList.add('term-typing');
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        line.textContent += text[i];
        i += 1;
        output.scrollTop = output.scrollHeight;
        if (i < text.length) {
          setTimeout(tick, 8); // faster than power.js's boot log — command output tends to run longer
        } else {
          line.classList.remove('term-typing');
          resolve();
        }
      };
      tick();
    });
  }
}
