/* =====================================================================
   paint/index.js
   A small MS-Paint-style editor — https://github.com/1j01/jspaint was
   the reference for which tools a "real" paint program has and roughly
   how they behave; this isn't a port of it, just built to the same
   16-tool toolbox, kept deliberately simpler everywhere jspaint itself
   goes further (one brush shape not several, no fill-style picker for
   shapes, a native `<input type="color">` instead of a full palette +
   custom-color dialog).

   Two real `<canvas>` elements stacked on top of each other, not one:
   `.paint-canvas` is the actual artwork (what gets saved), `.paint-overlay`
   (pointer-events: none, so it never intercepts input) is where every
   tool's live preview goes instead — a selection marquee, a shape being
   dragged out, a polygon's in-progress edges. Committing a tool's action
   draws once onto the real canvas and clears the overlay; nothing a
   preview draws can ever end up baked into the saved image, because it
   never touches the canvas that gets saved.

   Every tool is `{onDown, onMove, onUp, onDoubleClick, commitPending}` —
   see tool() below, which fills in whichever of those a given tool
   doesn't need with a no-op. `onMove(pos, isPointerDown)` fires on every
   pointer move regardless of button state (not just while dragging) —
   most tools only act when isPointerDown is true, but Polygon's live
   "next edge" preview specifically needs to track the cursor while the
   button is *up*, between clicks. `commitPending()` finalizes whatever a
   multi-step tool (a select move in progress, a curve's un-bent line, a
   polygon not yet closed, an unfinished text box) was in the middle of —
   called when switching tools and again from beforeClose(), so nothing
   is ever silently lost or left half-drawn.

   Closing with unsaved changes prompts first, via the beforeClose() this
   file returns from init() — see widget/popup/index.js for the other
   half of that contract — and the toolbar Save button prompts too,
   before it downloads anything, same as apps/notepad.
   ===================================================================== */

import { confirmDialog } from '../../js/confirm-dialog.js';
import { downloadFile } from '../../js/download-file.js';

const FILE_NAME = 'painting.jpg';
const ZOOM_LEVELS = [1, 2, 4];
const ERASER_SIZE = 14;
const SHAPE_LINE_WIDTH = 2;

export function init(container) {
  const canvas = container.querySelector('.paint-canvas');
  const overlay = container.querySelector('.paint-overlay');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const overlayCtx = overlay.getContext('2d');
  const colorInput = container.querySelector('.paint-color');
  const saveBtn = container.querySelector('.paint-save');
  const statusEl = container.querySelector('.paint-status');
  const toolButtons = [...container.querySelectorAll('.paint-tool')];
  const titleEl = container.closest('.popup-window')?.querySelector('.popup-title');

  let color = colorInput.value;
  let currentTool = 'select-rect';
  let dirty = false;
  let zoomIndex = 0;
  let pointerDown = false;

  // JPEG has no alpha channel — an untouched (default-transparent) canvas
  // would export as solid black in most browsers otherwise
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  setStatus(false);

  function setStatus(isDirty) {
    dirty = isDirty;
    statusEl.textContent = dirty ? 'Unsaved changes' : 'Saved';
    // same "reach up to its own window chrome" apps/media-viewer already
    // does to rename its title — a dot here is the one place a visual
    // "you have unsaved changes" cue is genuinely useful even when the
    // toolbar status text isn't in view (a maximized or scrolled window)
    if (titleEl) titleEl.textContent = `Paint${isDirty ? ' •' : ''}`;
  }
  const markDirty = () => setStatus(true);

  function getPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function clearOverlay() {
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  }

  /* ---------- shared tool shape: fills in whichever hooks a tool doesn't need ---------- */
  function tool(handlers) {
    return { onDown() {}, onMove() {}, onUp() {}, onDoubleClick() {}, commitPending() {}, ...handlers };
  }

  /* ---------- freehand tools: Pencil, Brush ---------- */
  function makeFreehandTool(lineWidth) {
    let drawing = false;
    return tool({
      onDown(pos) {
        drawing = true;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x, pos.y); // a plain click leaves a dot, not nothing
        ctx.stroke();
      },
      onMove(pos, isDown) {
        if (!isDown || !drawing) return;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      },
      onUp() {
        if (!drawing) return;
        drawing = false;
        markDirty();
      },
    });
  }

  /* ---------- Eraser: a plain white square stamp, same as a real rubber ---------- */
  function makeEraserTool() {
    let erasing = false;
    const stamp = (pos) => ctx.fillRect(pos.x - ERASER_SIZE / 2, pos.y - ERASER_SIZE / 2, ERASER_SIZE, ERASER_SIZE);
    return tool({
      onDown(pos) {
        erasing = true;
        ctx.fillStyle = '#ffffff';
        stamp(pos);
      },
      onMove(pos, isDown) {
        if (isDown && erasing) stamp(pos);
      },
      onUp() {
        if (!erasing) return;
        erasing = false;
        markDirty();
      },
    });
  }

  /* ---------- Airbrush: scatters dots on an interval while held, not once per move event ---------- */
  function makeAirbrushTool() {
    let timer = null;
    let last = null;
    function spray() {
      if (!last) return;
      ctx.fillStyle = color;
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 7;
        ctx.beginPath();
        ctx.arc(last.x + Math.cos(angle) * radius, last.y + Math.sin(angle) * radius, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return tool({
      onDown(pos) {
        last = pos;
        spray();
        timer = setInterval(spray, 45);
      },
      onMove(pos, isDown) {
        if (isDown) last = pos;
      },
      onUp() {
        if (!timer) return;
        clearInterval(timer);
        timer = null;
        markDirty();
      },
    });
  }

  /* ---------- shape tools: Line, Rectangle, Ellipse, Rounded Rectangle
     share the exact same drag-a-box-then-commit-once shape, differing
     only in what gets drawn inside it ---------- */
  function makeShapeTool(drawShape) {
    let active = false;
    let startX = 0, startY = 0;
    return tool({
      onDown(pos) {
        active = true;
        startX = pos.x;
        startY = pos.y;
      },
      onMove(pos, isDown) {
        if (!active || !isDown) return;
        clearOverlay();
        overlayCtx.strokeStyle = color;
        overlayCtx.lineWidth = SHAPE_LINE_WIDTH;
        drawShape(overlayCtx, startX, startY, pos.x, pos.y);
      },
      onUp(pos) {
        if (!active) return;
        active = false;
        clearOverlay();
        ctx.strokeStyle = color;
        ctx.lineWidth = SHAPE_LINE_WIDTH;
        drawShape(ctx, startX, startY, pos.x, pos.y);
        markDirty();
      },
      commitPending: clearOverlay,
    });
  }
  function drawLine(c, x0, y0, x1, y1) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  function drawRect(c, x0, y0, x1, y1) {
    c.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
  function drawEllipse(c, x0, y0, x1, y1) {
    c.beginPath();
    c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    c.stroke();
  }
  function drawRoundedRect(c, x0, y0, x1, y1) {
    const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    c.beginPath();
    c.roundRect(x, y, w, h, Math.max(0, Math.min(16, w / 2, h / 2)));
    c.stroke();
  }

  /* ---------- Curve: a straight line first, then one more drag bends it —
     a simplified single control point (quadraticCurveTo) rather than real
     MS Paint's two independent bends (bezierCurveTo) ---------- */
  function makeCurveTool() {
    let phase = 'idle'; // idle -> baseline -> bend -> idle
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    const drawBaseline = (c) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const drawBent = (c, cx, cy) => { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); };
    return tool({
      onDown(pos) {
        if (phase === 'idle') {
          phase = 'baseline';
          x0 = pos.x; y0 = pos.y; x1 = pos.x; y1 = pos.y;
        }
      },
      onMove(pos, isDown) {
        if (!isDown) return;
        if (phase === 'baseline') {
          x1 = pos.x; y1 = pos.y;
          clearOverlay();
          overlayCtx.strokeStyle = color;
          overlayCtx.lineWidth = SHAPE_LINE_WIDTH;
          drawBaseline(overlayCtx);
        } else if (phase === 'bend') {
          clearOverlay();
          overlayCtx.strokeStyle = color;
          overlayCtx.lineWidth = SHAPE_LINE_WIDTH;
          drawBent(overlayCtx, pos.x, pos.y);
        }
      },
      onUp(pos) {
        if (phase === 'baseline') {
          phase = 'bend'; // wait for the next drag, which bends it
        } else if (phase === 'bend') {
          clearOverlay();
          ctx.strokeStyle = color;
          ctx.lineWidth = SHAPE_LINE_WIDTH;
          drawBent(ctx, pos.x, pos.y);
          phase = 'idle';
          markDirty();
        }
      },
      commitPending() {
        clearOverlay();
        phase = 'idle';
      },
    });
  }

  /* ---------- Polygon: click to place each vertex, double-click to close ---------- */
  function makePolygonTool() {
    let active = false;
    let points = [];
    function preview(hoverPos) {
      clearOverlay();
      overlayCtx.strokeStyle = color;
      overlayCtx.lineWidth = SHAPE_LINE_WIDTH;
      overlayCtx.beginPath();
      overlayCtx.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) overlayCtx.lineTo(p.x, p.y);
      if (hoverPos) overlayCtx.lineTo(hoverPos.x, hoverPos.y);
      overlayCtx.stroke();
    }
    function reset() {
      clearOverlay();
      active = false;
      points = [];
    }
    return tool({
      onDown(pos) {
        if (!active) { active = true; points = [pos]; } else { points.push(pos); preview(); }
      },
      onMove(pos, isDown) {
        if (active && !isDown) preview(pos); // the live edge following the cursor between clicks
      },
      onDoubleClick() {
        if (!active) return;
        if (points.length > 1) {
          ctx.strokeStyle = color;
          ctx.lineWidth = SHAPE_LINE_WIDTH;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.closePath();
          ctx.stroke();
          markDirty();
        }
        reset();
      },
      commitPending: reset,
    });
  }

  /* ---------- Select (Rectangular / Free-Form): drag out a marquee, then
     drag again *inside* it to cut+move those pixels; the two only differ
     in how the region's outline is built (a box vs. the traced path) ---------- */
  function makeSelectTool(shape) {
    let phase = 'idle'; // idle -> defining -> selected -> moving -> idle
    let points = [];
    let bounds = null;
    let path = null;
    let captured = null; // an offscreen canvas holding just the selected pixels
    let moveStart = null;
    let moveOffset = { x: 0, y: 0 };

    function buildPath() {
      const p = new Path2D();
      if (shape === 'rect') {
        const [a, b] = points;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        p.rect(x, y, w, h);
        bounds = { x, y, w, h };
      } else {
        p.moveTo(points[0].x, points[0].y);
        for (const pt of points.slice(1)) p.lineTo(pt.x, pt.y);
        p.closePath();
        const xs = points.map((pt) => pt.x), ys = points.map((pt) => pt.y);
        const x = Math.min(...xs), y = Math.min(...ys);
        bounds = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
      }
      path = p;
    }

    function drawMarquee(offsetX = 0, offsetY = 0) {
      clearOverlay();
      overlayCtx.save();
      overlayCtx.setLineDash([4, 3]);
      overlayCtx.strokeStyle = '#333';
      overlayCtx.lineWidth = 1;
      overlayCtx.translate(offsetX, offsetY);
      overlayCtx.stroke(path);
      overlayCtx.restore();
      if (offsetX || offsetY) overlayCtx.drawImage(captured, offsetX, offsetY);
    }

    /** Cuts the selected pixels out onto an offscreen canvas and clears
     *  that area (to white) on the real canvas — done the moment a move
     *  actually starts, not the moment the selection is made, so just
     *  drawing a marquee and never dragging it never touches the image. */
    function cut() {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const octx = off.getContext('2d');
      octx.save();
      octx.clip(path);
      octx.drawImage(canvas, 0, 0);
      octx.restore();
      captured = off;

      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.restore();
    }

    function pointInBounds(pos) {
      return !!bounds && pos.x >= bounds.x && pos.x <= bounds.x + bounds.w && pos.y >= bounds.y && pos.y <= bounds.y + bounds.h;
    }

    function reset() {
      clearOverlay();
      phase = 'idle';
      points = [];
      path = null;
      bounds = null;
      captured = null;
    }

    return tool({
      onDown(pos) {
        if (phase === 'selected' && pointInBounds(pos)) {
          cut();
          phase = 'moving';
          moveStart = pos;
          moveOffset = { x: 0, y: 0 };
        } else {
          phase = 'defining';
          points = shape === 'rect' ? [pos, pos] : [pos];
        }
      },
      onMove(pos, isDown) {
        if (!isDown) return;
        if (phase === 'defining') {
          if (shape === 'rect') points[1] = pos; else points.push(pos);
          buildPath();
          drawMarquee();
        } else if (phase === 'moving') {
          moveOffset = { x: pos.x - moveStart.x, y: pos.y - moveStart.y };
          drawMarquee(moveOffset.x, moveOffset.y);
        }
      },
      onUp() {
        if (phase === 'defining') {
          phase = points.length > 1 ? 'selected' : 'idle';
          if (phase === 'idle') clearOverlay();
        } else if (phase === 'moving') {
          ctx.drawImage(captured, moveOffset.x, moveOffset.y);
          reset();
          markDirty();
        }
      },
      commitPending() {
        if (phase === 'moving') {
          ctx.drawImage(captured, moveOffset.x, moveOffset.y);
          markDirty();
        }
        reset();
      },
    });
  }

  /* ---------- Fill: classic iterative (stack-based, not recursive —
     avoids a stack-overflow on a large fill) flood fill ---------- */
  function floodFill(startX, startY, hex) {
    const { width, height } = canvas;
    const x0 = Math.floor(startX), y0 = Math.floor(startY);
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const startIdx = (y0 * width + x0) * 4;
    const target = [data[startIdx], data[startIdx + 1], data[startIdx + 2], data[startIdx + 3]];
    const [fr, fg, fb] = hexToRgb(hex);
    if (target[0] === fr && target[1] === fg && target[2] === fb && target[3] === 255) return; // already this color

    const matches = (idx) => data[idx] === target[0] && data[idx + 1] === target[1] && data[idx + 2] === target[2] && data[idx + 3] === target[3];
    const stack = [[x0, y0]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const idx = (y * width + x) * 4;
      if (!matches(idx)) continue;
      data[idx] = fr; data[idx + 1] = fg; data[idx + 2] = fb; data[idx + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(image, 0, 0);
  }

  /* ---------- Text: a real <input>, positioned over the click point,
     stamped onto the canvas with fillText() on Enter/blur ---------- */
  function makeTextTool() {
    let input = null;
    function commit() {
      if (!input) return;
      const box = input;
      const value = box.value;
      const x = Number(box.dataset.x), y = Number(box.dataset.y);
      // cleared before remove(), not after: removing a focused element
      // fires 'blur' on it synchronously, re-entering this same commit()
      // from the blur listener below *before* remove() itself returns —
      // with input already null by then, that re-entrant call is a no-op
      // instead of trying to remove the same node from the DOM twice
      input = null;
      box.remove();
      if (!value.trim()) return;
      ctx.fillStyle = color;
      ctx.font = '20px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(value, x, y);
      markDirty();
    }
    return tool({
      onDown(pos, event) {
        // without this, the browser's own default mousedown behavior
        // steals focus right back (to <body>, since <canvas> isn't
        // focusable) the instant this handler returns — input.focus()
        // below would "work" for a single frame and then immediately
        // blur, which the blur listener treats as "commit", silently
        // deleting the box before a real user could ever type into it
        event.preventDefault();
        commit(); // stamp any previous text box first
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'paint-text-input';
        input.dataset.x = String(pos.x);
        input.dataset.y = String(pos.y);
        input.style.left = `${event.clientX}px`;
        input.style.top = `${event.clientY}px`;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
        input.addEventListener('blur', commit);
        document.body.appendChild(input);
        input.focus();
      },
      commitPending: commit,
    });
  }

  /* ---------- Eyedropper, Magnifier: read-only tools — neither one marks the drawing dirty ---------- */
  const eyedropperTool = tool({
    onDown(pos) {
      const [r, g, b] = ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
      color = rgbToHex(r, g, b);
      colorInput.value = color;
    },
  });
  const zoomTool = tool({
    onDown() {
      zoomIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
      const scale = ZOOM_LEVELS[zoomIndex];
      for (const el of [canvas, overlay]) {
        el.style.width = `${el.width * scale}px`;
        el.style.height = `${el.height * scale}px`;
        el.classList.toggle('is-zoomed', scale !== 1);
      }
    },
  });

  const TOOLS = {
    'select-rect': makeSelectTool('rect'),
    'select-lasso': makeSelectTool('lasso'),
    eraser: makeEraserTool(),
    fill: tool({ onDown(pos) { floodFill(pos.x, pos.y, color); markDirty(); } }),
    eyedropper: eyedropperTool,
    zoom: zoomTool,
    pencil: makeFreehandTool(1),
    brush: makeFreehandTool(4),
    airbrush: makeAirbrushTool(),
    text: makeTextTool(),
    line: makeShapeTool(drawLine),
    curve: makeCurveTool(),
    rectangle: makeShapeTool(drawRect),
    polygon: makePolygonTool(),
    ellipse: makeShapeTool(drawEllipse),
    'rounded-rect': makeShapeTool(drawRoundedRect),
  };

  /* ---------- wiring ---------- */
  colorInput.addEventListener('input', () => { color = colorInput.value; });

  toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      TOOLS[currentTool].commitPending();
      currentTool = btn.dataset.tool;
      toolButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
    });
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    canvas.setPointerCapture(event.pointerId);
    TOOLS[currentTool].onDown(getPos(event), event);
  });
  canvas.addEventListener('pointermove', (event) => {
    TOOLS[currentTool].onMove(getPos(event), pointerDown);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDown) return;
    pointerDown = false;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    TOOLS[currentTool].onUp(getPos(event), event);
  });
  canvas.addEventListener('dblclick', (event) => {
    TOOLS[currentTool].onDoubleClick(getPos(event));
  });

  function saveDrawing() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadFile(blob, FILE_NAME);
      setStatus(false);
    }, 'image/jpeg', 0.92);
  }

  saveBtn.addEventListener('click', async () => {
    // confirms before the toolbar button downloads anything — the
    // beforeClose prompt below doesn't need this same confirmation on top
    // of its own, since choosing "Save" there already *is* the deliberate
    // choice this dialog exists to check for
    const proceed = await confirmDialog(`Save this drawing as "${FILE_NAME}" to your computer?`, {
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
    });
    if (proceed) saveDrawing();
  });

  return {
    async beforeClose() {
      TOOLS[currentTool].commitPending(); // finish an in-progress move/curve/polygon/text rather than silently dropping it
      if (!dirty) return true;
      const shouldSave = await confirmDialog('Save this drawing as a .jpg file before closing?', {
        confirmLabel: 'Save',
        cancelLabel: "Don't Save",
      });
      if (shouldSave) saveDrawing();
      return true; // either choice closes the window — Save just downloads it first
    },
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
