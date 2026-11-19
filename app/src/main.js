// Wires the cover maker: photos, layouts, caption, grades, pan/zoom and PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, defaultState, panelAt, panelPolygons, panelBounds, PANEL_COUNT, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

export const SAMPLES = ['boulevard', 'pier', 'portrait', 'sportscar', 'street'];
export const SAMPLE_LABELS = { boulevard: 'Boulevard', pier: 'Pier', portrait: 'Portrait', sportscar: 'Sports car', street: 'Street' };

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = defaultState();
let selectedPanel = 0;

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

function redraw() { drawCover(canvas, state); }

/** Puts an image into photo slot i and repaints. */
export function setPhoto(i, img) {
  state.photos[i] = img;
  redraw();
}

/** Loads a sample photo into slot i; a missing sample is skipped quietly. */
export async function loadSample(name, slot) {
  try { setPhoto(slot, await loadImage(`samples/${name}.jpg`)); return true; }
  catch { return false; }
}

/** Applies a shot scene's layout/grade/caption to the editor state. */
export function applyScene({ layout, grade, title, subtitle }) {
  if (layout && LAYOUTS.includes(layout)) state.layout = layout;
  if (grade && GRADES.includes(grade)) state.grade = grade;
  if (title !== undefined) state.title = title;
  if (subtitle !== undefined) state.subtitle = subtitle;
  syncControls();
  redraw();
}

function syncControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('zoom').value = String(state.panelZoom[selectedPanel] ?? 1);
  document.getElementById('selectedPanel').textContent = String(selectedPanel + 1);
  for (const btn of document.querySelectorAll('#layouts button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.layout === state.layout));
  }
  for (const btn of document.querySelectorAll('#grades button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.grade === state.grade));
  }
  for (const btn of document.querySelectorAll('#panelPhotos button')) {
    btn.setAttribute('aria-pressed', String(state.panelPhoto[selectedPanel] === Number(btn.dataset.photo)));
  }
}

// --- layout radio buttons with small diagrams ---
const DIAGRAMS = {
  hero: '<rect x="2" y="2" width="52" height="36" rx="2"/>',
  split: '<path d="M2 2 L34 2 L26 38 L2 38 Z"/><path d="M36 2 L54 2 L54 38 L28 38 Z"/>',
  poster: '<path d="M2 2 L36 2 L30 38 L2 38 Z"/><rect x="38" y="2" width="16" height="16"/><rect x="38" y="20" width="16" height="18"/>',
  grid: '<rect x="2" y="2" width="24" height="16"/><rect x="30" y="2" width="24" height="16"/><rect x="2" y="22" width="24" height="16"/><rect x="30" y="22" width="24" height="16"/>',
};
const layoutsEl = document.getElementById('layouts');
for (const layout of LAYOUTS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.layout = layout;
  btn.setAttribute('aria-pressed', String(layout === state.layout));
  btn.innerHTML = `<svg viewBox="0 0 56 40" fill="#ff7a3d" aria-hidden="true">${DIAGRAMS[layout]}</svg>${layout[0].toUpperCase() + layout.slice(1)}`;
  btn.addEventListener('click', () => {
    state.layout = layout;
    selectedPanel = Math.min(selectedPanel, PANEL_COUNT[layout] - 1);
    syncControls();
    redraw();
  });
  layoutsEl.appendChild(btn);
}

// --- grade buttons with swatches ---
const GRADE_LABELS = { sunset: 'Sunset', neon: 'Neon Night', golden: 'Golden Hour', noir: 'Noir' };
const gradesEl = document.getElementById('grades');
for (const grade of GRADES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.grade = grade;
  btn.setAttribute('aria-pressed', String(grade === state.grade));
  btn.innerHTML = `<span class="swatch swatch-${grade}"></span>${GRADE_LABELS[grade]}`;
  btn.addEventListener('click', () => { state.grade = grade; syncControls(); redraw(); });
  gradesEl.appendChild(btn);
}

// --- sample photo buttons ---
const samplesEl = document.getElementById('samples');
for (const name of SAMPLES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = `Use sample: ${SAMPLE_LABELS[name]}`;
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `<img src="samples/${name}.jpg" alt="${SAMPLE_LABELS[name]} sample photo">`;
  btn.addEventListener('click', async () => {
    const slot = state.photos.findIndex((p) => !p);
    const target = slot === -1 ? 0 : slot;
    if (await loadSample(name, target)) {
      for (const b of samplesEl.querySelectorAll('button')) b.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-pressed', 'true');
      status.textContent = `Loaded sample ${SAMPLE_LABELS[name]} into photo ${target + 1}.`;
    } else {
      status.textContent = `Sample ${SAMPLE_LABELS[name]} is not available yet.`;
    }
  });
  samplesEl.appendChild(btn);
}

// --- photo slots for the selected panel ---
const panelPhotosEl = document.getElementById('panelPhotos');
for (let i = 0; i < 3; i++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.photo = String(i);
  btn.textContent = `Photo ${i + 1}`;
  btn.setAttribute('aria-pressed', String(state.panelPhoto[selectedPanel] === i));
  btn.addEventListener('click', () => { state.panelPhoto[selectedPanel] = i; syncControls(); redraw(); });
  panelPhotosEl.appendChild(btn);
}
document.getElementById('fillAll').addEventListener('click', () => {
  const photo = state.panelPhoto[selectedPanel];
  for (let p = 0; p < PANEL_COUNT[state.layout]; p++) state.panelPhoto[p] = photo;
  status.textContent = `All panels now use photo ${photo + 1}.`;
  redraw();
});

// --- uploads, caption, zoom ---
for (let i = 0; i < 3; i++) {
  document.getElementById(`upload${i}`).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setPhoto(i, await loadImage(URL.createObjectURL(file)));
      status.textContent = `Loaded ${file.name} into photo ${i + 1}.`;
    } catch { status.textContent = `Could not read ${file.name}.`; }
  });
}
document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('zoom').addEventListener('input', (e) => {
  state.panelZoom[selectedPanel] = Number(e.target.value);
  redraw();
});

// --- click to select a panel, drag to pan its photo ---
let drag = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const panel = panelAt(state, canvas.width, canvas.height, x, y);
  if (panel === -1) return;
  selectedPanel = panel;
  syncControls();
  drag = { x, y, pan: { ...state.panelPan[panel] } };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = canvasPoint(e);
  const b = panelBounds(panelPolygons(state.layout, canvas.width, canvas.height)[selectedPanel]);
  state.panelPan[selectedPanel] = {
    x: drag.pan.x + (x - drag.x) / b.w,
    y: drag.pan.y + (y - drag.y) / b.h,
  };
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// --- export ---
function parseSize(value) {
  const [w, h] = value.split('x').map(Number);
  return { w, h };
}
/** Renders the cover at w x h and resolves with the PNG blob. */
export function exportCover(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  return new Promise((resolve, reject) => {
    off.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export failed'))), 'image/png');
  });
}
window.__exportCover = (w, h) => exportCover(w, h);
document.getElementById('export').addEventListener('click', async () => {
  const { w, h } = parseSize(document.getElementById('exportSize').value);
  try {
    const blob = await exportCover(w, h);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `palmera-bay-cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved palmera-bay-cover-${w}x${h}.png`;
  } catch { status.textContent = 'Export failed — try again.'; }
});

// --- shot scenes ---
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, { state, canvas, loadSample, applyScene, redraw, setPhoto });
} else {
  loadSample('boulevard', 0).then(() => loadSample('pier', 1));
  redraw();
}
