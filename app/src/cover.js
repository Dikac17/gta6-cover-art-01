// Draws a GTA-poster-style multi-panel cover: slanted panels, a colour grade and a bold Anton title block.
// State: { layout, photos[], panelPhoto[], panelZoom[], panelPan[], title, subtitle, grade }.
// photos[i] is an HTMLImageElement (or null); panelPhoto[p] is the index into photos (or -1 for empty);
// panelZoom[p] is a 0.5..3 multiplier; panelPan[p] is {x, y} in fractions of the panel size.

export const LAYOUTS = ['hero', 'split', 'poster', 'grid'];
export const GRADES = ['sunset', 'neon', 'golden', 'noir'];
export const PANEL_COUNT = { hero: 1, split: 2, poster: 3, grid: 4 };

export function defaultState() {
  return {
    layout: 'poster',
    photos: [null, null, null],
    panelPhoto: [0, 1, 2, 0],
    panelZoom: [1, 1, 1, 1],
    panelPan: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    title: 'PALMERA BAY',
    subtitle: 'Sun, Sea & Trouble',
    grade: 'sunset',
  };
}

/** Panel polygons for a layout, as arrays of [x, y] points, adapting to the canvas aspect. */
export function panelPolygons(layout, w, h) {
  const g = Math.max(3, Math.round(Math.min(w, h) * 0.008)); // white gap between panels
  const slant = Math.min(w, h) * 0.07;
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (layout === 'hero') return [rect(0, 0, w, h)];
  if (layout === 'split') {
    const m = w / 2;
    return [
      [[0, 0], [m + slant, 0], [m - slant, h], [0, h]],
      [[m + slant + g, 0], [w, 0], [w, h], [m - slant + g, h]],
    ];
  }
  if (layout === 'grid') {
    const mx = w / 2, my = h / 2;
    return [
      rect(0, 0, mx - g / 2, my - g / 2), rect(mx + g / 2, 0, w, my - g / 2),
      rect(0, my + g / 2, mx - g / 2, h), rect(mx + g / 2, my + g / 2, w, h),
    ];
  }
  // poster: one big panel + two stacked side panels, slanted dividers.
  if (w >= h * 0.9) { // big panel on the left
    const m = w * 0.62, my = h / 2;
    return [
      [[0, 0], [m + slant, 0], [m - slant, h], [0, h]],
      [[m + slant + g, 0], [w, 0], [w, my - g / 2], [m - slant + g * 0.5, my - g / 2]],
      [[m - slant + g * 0.5, my + g / 2], [w, my + g / 2], [w, h], [m - slant + g, h]],
    ];
  }
  const m = h * 0.62, mx = w / 2; // big panel on top (portrait)
  return [
    [[0, 0], [w, 0], [w, m - slant], [0, m + slant]],
    [[0, m + slant + g], [mx - g / 2, m - slant + g], [mx - g / 2, h], [0, h]],
    [[mx + g / 2, m - slant + g], [w, m + slant + g], [w, h], [mx + g / 2, h]],
  ];
}

/** Bounding box of a polygon, for cover-fit math and hit-testing. */
export function panelBounds(poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Index of the panel containing (x, y), or -1. */
export function panelAt(state, w, h, x, y) {
  const polys = panelPolygons(state.layout, w, h);
  for (let i = polys.length - 1; i >= 0; i--) if (pointInPolygon(x, y, polys[i])) return i;
  return -1;
}

const PLACEHOLDER = [
  ['#ff7a3d', '#c2185b'], ['#00e5ff', '#ff2ea6'], ['#ffc233', '#ff7a3d'], ['#8e6cff', '#00e5ff'],
];

function drawPhotoInPanel(ctx, photo, poly, zoom, pan) {
  const b = panelBounds(poly);
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const scale = Math.max(b.w / photo.naturalWidth, b.h / photo.naturalHeight) * zoom;
  const pw = photo.naturalWidth * scale, ph = photo.naturalHeight * scale;
  const cx = b.x + b.w / 2 + pan.x * b.w, cy = b.y + b.h / 2 + pan.y * b.h;
  ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

function drawPlaceholder(ctx, poly, index, w, h) {
  const b = panelBounds(poly);
  const [c0, c1] = PLACEHOLDER[index % PLACEHOLDER.length];
  const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `${Math.max(14, Math.min(b.w, b.h) * 0.16)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1}`, b.x + b.w / 2, b.y + b.h / 2 - Math.min(b.w, b.h) * 0.05);
  ctx.font = `${Math.max(10, Math.min(b.w, b.h) * 0.055)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('ADD A PHOTO', b.x + b.w / 2, b.y + b.h / 2 + Math.min(b.w, b.h) * 0.08);
  ctx.restore();
}

/** Colour-grade overlays, drawn over the panels (under the title block). Deterministic, no randomness. */
function applyGrade(ctx, w, h, grade) {
  if (grade === 'noir') {
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(255,255,255,0.06)');
    v.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const stops = {
    sunset: [['rgba(255,122,61,0.28)', 'overlay'], ['rgba(255,46,166,0.22)', 'soft-light']],
    neon: [['rgba(255,46,166,0.30)', 'overlay'], ['rgba(0,229,255,0.26)', 'soft-light']],
    golden: [['rgba(255,194,51,0.26)', 'overlay'], ['rgba(255,122,61,0.18)', 'soft-light']],
  }[grade] ?? [];
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,190,80,0.10)');
  grad.addColorStop(0.55, 'rgba(255,122,61,0.10)');
  grad.addColorStop(1, 'rgba(194,24,91,0.16)');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  for (const [color, mode] of stops) {
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawTitleBlock(ctx, w, h, title, subtitle) {
  // Dark scrim so the lettering always reads.
  const scrim = ctx.createLinearGradient(0, h * 0.66, 0, h);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(1, 'rgba(10,4,16,0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  // Thin diagonal accent stripe above the title.
  const stripeY = h * 0.735, stripeH = Math.max(4, h * 0.011), stripeW = w * 0.30, slant = stripeH * 2.2;
  const stripe = ctx.createLinearGradient(w * 0.04, 0, w * 0.04 + stripeW, 0);
  stripe.addColorStop(0, '#ff7a3d');
  stripe.addColorStop(0.5, '#ff2ea6');
  stripe.addColorStop(1, '#00e5ff');
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(w * 0.04 + slant, stripeY);
  ctx.lineTo(w * 0.04 + stripeW, stripeY);
  ctx.lineTo(w * 0.04 + stripeW - slant, stripeY + stripeH);
  ctx.lineTo(w * 0.04, stripeY + stripeH);
  ctx.closePath();
  ctx.fill();
  const text = (title || '').trim().toUpperCase();
  if (text) {
    let size = h * 0.115;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const setFont = () => { ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`; };
    setFont();
    while (ctx.measureText(text).width > w * 0.92 && size > 10) { size -= 2; setFont(); }
    const x = w * 0.04, y = h - h * 0.085;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(10,4,16,0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const size = Math.max(11, h * 0.028);
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    try { ctx.letterSpacing = `${Math.max(2, size * 0.35)}px`; } catch { /* older canvas: no letter-spacing */ }
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText(sub, w * 0.04, h - h * 0.028);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
}

/** Renders the whole cover onto the canvas at the canvas's own pixel size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.save();
  ctx.filter = 'none';
  ctx.fillStyle = '#ffffff'; // thin white gaps between panels
  ctx.fillRect(0, 0, w, h);
  const polys = panelPolygons(state.layout, w, h);
  const count = PANEL_COUNT[state.layout];
  for (let p = 0; p < count; p++) {
    const photoIndex = state.panelPhoto[p];
    const photo = photoIndex >= 0 ? state.photos[photoIndex] : null;
    if (photo) {
      if (state.grade === 'noir') ctx.filter = 'grayscale(1) contrast(1.28) brightness(1.02)';
      drawPhotoInPanel(ctx, photo, polys[p], state.panelZoom[p] ?? 1, state.panelPan[p] ?? { x: 0, y: 0 });
      ctx.filter = 'none';
    } else {
      drawPlaceholder(ctx, polys[p], p, w, h);
    }
  }
  applyGrade(ctx, w, h, state.grade);
  drawTitleBlock(ctx, w, h, state.title, state.subtitle);
  ctx.restore();
}
