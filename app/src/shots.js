// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos;
// ?shot=cover shows the cover alone at the size the query asks for (w/h).
// photo1/photo2/photo3 pick samples, layout/grade/title/subtitle set the scene.
// window.__shotReady is set once the scene is fully painted (fonts ready + 2 frames).
export async function runShot(shot, query, api) {
  const { state, canvas, loadSample, applyScene, redraw } = api;
  const names = [query.get('photo1') ?? 'pier', query.get('photo2') ?? 'boulevard', query.get('photo3') ?? 'portrait'];
  // An optional fourth photo (photo4) feeds panel 4 in the grid layout,
  // so no photo has to repeat; shots without it keep the old 3-photo behaviour.
  if (query.get('photo4')) names.push(query.get('photo4'));
  // Load each requested sample into its own slot; a missing one falls back to the first loaded photo.
  const loaded = [];
  for (let i = 0; i < names.length; i++) loaded.push(await loadSample(names[i], i));
  for (let i = 0; i < names.length; i++) {
    if (!loaded[i]) {
      const first = loaded.findIndex(Boolean);
      if (first !== -1) state.photos[i] = state.photos[first];
    }
  }
  // Point panel 4 at the fourth photo only when it actually loaded.
  if (names.length > 3 && loaded[3]) state.panelPhoto[3] = 3;
  applyScene({
    layout: query.get('layout') ?? undefined,
    grade: query.get('grade') ?? undefined,
    title: query.get('title') ?? undefined,
    subtitle: query.get('subtitle') ?? undefined,
  });
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const w = Number(query.get('w')) || 1920;
    const h = Number(query.get('h')) || 1080;
    canvas.width = w;
    canvas.height = h;
  }
  redraw();
  try { await document.fonts.ready; } catch { /* fonts are local; continue without them */ }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  redraw();
  window.__shotReady = true;
}
