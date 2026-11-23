/* 第 01 篇：消失的地景（左右比較 + 點選目標面判斷） */
(async function () {
  'use strict';
  const { Progress, esc } = Game;
  if (!Game.checkProtocol()) return;
  Game.setupPanelToggle();
  Game.renderStats();

  let story, cfg, bm, targets, rail, boundary;
  try {
    [story, cfg, bm] = await Promise.all([
      Game.loadJSON('data/game/story.json'), Game.loadJSON('data/game/level1.json'), GameMap.loadBasemaps()]);
    [targets, rail, boundary] = await Promise.all([
      Game.loadJSON(cfg.targets_file),
      Game.loadJSON('data/gis/context/rail_1939_1953.geojson'),
      Game.loadJSON('data/gis/context/dalin_boundary.geojson')]);
  } catch (e) { return Game.fail(e); }

  const info = story.levels[0];
  const tasks = targets.features.slice().sort((a, b) => (a.properties.order || 0) - (b.properties.order || 0)).slice(0, cfg.tasks_required || 99);
  const totalPts = tasks.reduce((s, t) => s + (t.properties.points || 0), 0);

  // ---------- 地圖 ----------
  const map = GameMap.createMap('map', bm, { zoom: 15 });
  const swipe = new GameMap.Swipe(map);
  const railLayer = L.geoJSON(rail, {
    pane: 'swipeLeftVector',
    style: f => f.properties.start_year === 1939
      ? { color: '#d2452f', weight: 3.5, opacity: .95 }
      : { color: '#191917', weight: 3, opacity: .9, dashArray: f.properties.layer === '1953支線' ? '2 7' : null, lineCap: 'round' },
    onEachFeature: (f, l) => l.bindTooltip(`${f.properties.layer}（組員數化；${f.properties.note}）`, { sticky: true })
  });
  const boundaryLayer = L.geoJSON(boundary, { interactive: false, style: { color: '#191917', weight: 1.5, dashArray: '6 5', fill: false } }).addTo(map);
  const markLayer = L.layerGroup().addTo(map);
  const solvedLayer = L.layerGroup().addTo(map);
  const mark = ok => L.divIcon({
    className: 'click-mark', iconSize: [30, 30], iconAnchor: [15, 15],
    html: ok ? '<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="#3f5f2a" stroke="#f5f3ec" stroke-width="3"/><path d="M9.5 15.5l4 4 7-8" fill="none" stroke="#f5f3ec" stroke-width="2.6"/></svg>'
             : '<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="#f5f3ec" stroke="#d2452f" stroke-width="2.5"/><path d="M10.5 10.5l9 9M19.5 10.5l-9 9" stroke="#d2452f" stroke-width="2.5"/></svg>'
  });

  // ---------- 狀態 ----------
  const S = { idx: 0, wrong: 0, hint: 0, hintsShown: [], zoomUsed: false, scores: [], busy: false, done: false, fb: null };
  const panel = document.getElementById('panel-body');
  const typeName = { A: '用途改變', B: '地物消失或改變', C: '依文字線索找地點' };
  const yl = id => (bm.basemaps[id] || {}).year_label || '';

  function basemapOptions(sel, historical) {
    return Object.entries(bm.basemaps).filter(([, v]) => !!v.is_historical === historical)
      .map(([id, v]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  }

  function render() {
    const t = tasks[S.idx].properties;
    const steps = tasks.map((_, i) => `<span class="${i < S.idx ? 'done' : i === S.idx ? 'now' : ''}"></span>`).join('');
    panel.innerHTML = `
      <header class="art-head">
        <span class="pg">01</span><h1>${esc(info.name.replace(/^第.份檔案：/, ''))}</h1>
        <div class="kicker"><span>任務 <b>${S.idx + 1}</b>／${tasks.length}</span><span>本題 ${t.points} 分</span></div>
        <div class="steps" style="grid-column:1/-1">${steps}</div>
      </header>
      <section class="task">
        <div class="meta"><span>類型 ${esc(t.task_type)}｜${typeName[t.task_type] || ''}</span>
          ${t.is_demo ? '<span class="tag tag-demo">示範資料 DEMO</span>' : '<span class="tag tag-real">事件已查證</span>'}</div>
        <h2>${esc(t.title)}</h2>
        <p>${esc(t.description)}</p>
        <div class="compare" aria-label="比較的兩個年代">
          <span><b>${esc(yl(swipe.leftId))}</b>${esc(GameMap.basemapName(swipe.leftId))}</span><i>⇄</i>
          <span class="r"><b>${esc(yl(swipe.rightId))}</b>${esc(GameMap.basemapName(swipe.rightId))}</span>
        </div>
      </section>
      ${S.fb ? `<div class="feedback ${S.fb.cls}" id="feedback" role="status">${S.fb.html}</div>` : ''}
      <div class="notes">${S.hintsShown.map((h, i) => `<div class="note-fn"><b>編者註 ${i + 1}</b>${esc(h)}</div>`).join('')}</div>
      <div class="tools">
        <button class="link-btn" id="btn-hint" ${S.hintsShown.length ? 'disabled' : ''}>※ 看文字提示（−${Math.round(cfg.scoring.hint_penalty * 100)}%）</button>
        <button class="link-btn" id="btn-zoom" ${S.zoomUsed ? 'disabled' : ''}>◎ 移到目標附近（−${Math.round(cfg.scoring.zoom_hint_penalty * 100)}%）</button>
      </div>
      <p class="hint-line">拖動地圖中間的黑色把手比較兩個年代，再在地圖上點你認為的位置。答錯可以一直重試。</p>
      <details class="fold"><summary>換底圖與圖層</summary><div class="in">
        <label for="sel-left">左側（歷史）</label><select class="basemap" id="sel-left">${basemapOptions(swipe.leftId, true)}</select>
        <label for="sel-right">右側（現代）</label><select class="basemap" id="sel-right">${basemapOptions(swipe.rightId, false)}</select>
        <div class="layer-toggles" style="margin-top:6px">
          <label><input type="checkbox" id="tg-rail" ${map.hasLayer(railLayer) ? 'checked' : ''}> 1939（朱紅）／1953（墨線）鐵路，只顯示在左側</label>
          <label><input type="checkbox" id="tg-bound" ${map.hasLayer(boundaryLayer) ? 'checked' : ''}> 大林鎮界</label>
        </div>
        歷史底圖來自中研院 GIS 專題中心 WMTS；現代底圖來自國土測繪中心 WMTS 或 OpenStreetMap。中研院與國土測繪中心的服務沒有公開授權條款，正式公開前需確認。
      </div></details>
      <details class="fold"><summary>為什麼沒有 1959 年航照</summary><div class="in">
        ${esc(cfg.note_1959)}<br>${cfg.external_links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('<br>')}
      </div></details>`;
    document.getElementById('btn-hint').onclick = useHint;
    document.getElementById('btn-zoom').onclick = useZoom;
    document.getElementById('sel-left').onchange = e => { swipe.setBasemaps(e.target.value, swipe.rightId); render(); };
    document.getElementById('sel-right').onchange = e => { swipe.setBasemaps(swipe.leftId, e.target.value); render(); };
    document.getElementById('tg-rail').onchange = e => e.target.checked ? railLayer.addTo(map) : map.removeLayer(railLayer);
    document.getElementById('tg-bound').onchange = e => e.target.checked ? boundaryLayer.addTo(map) : map.removeLayer(boundaryLayer);
    document.getElementById('level-score').textContent = S.scores.reduce((a, b) => a + b, 0);
  }

  function feedback(html, cls) { S.fb = { html, cls }; render(); }

  function startTask(i) {
    Object.assign(S, { idx: i, wrong: 0, hint: 0, hintsShown: [], zoomUsed: false, busy: false, fb: null });
    markLayer.clearLayers();
    const t = tasks[i].properties;
    swipe.setBasemaps(bm.basemaps[t.left_basemap] ? t.left_basemap : 'PAPER', bm.basemaps[t.right_basemap] ? t.right_basemap : bm.fallback_modern);
    if (t.show_rail) railLayer.addTo(map); else map.removeLayer(railLayer);
    map.setView(bm.default_center, 14);
    render();
  }

  function useHint() {
    if (!S.hintsShown.length) { S.hintsShown.push(tasks[S.idx].properties.hint); S.hint += cfg.scoring.hint_penalty; }
    render();
  }
  function useZoom() {
    if (S.zoomUsed) return;
    S.zoomUsed = true; S.hint += cfg.scoring.zoom_hint_penalty;
    map.flyToBounds(L.geoJSON(tasks[S.idx]).getBounds().pad(1.2), { duration: .8 });
    feedback('地圖已移到目標附近，目標就在畫面中的某處。', 'good');
  }

  function bearingName(from, to) {
    const dy = to.lat - from.lat, dx = (to.lng - from.lng) * Math.cos(from.lat * Math.PI / 180);
    const a = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][Math.round(a / 45) % 8];
  }

  map.on('click', async e => {
    if (S.busy || S.done) return;
    const f = tasks[S.idx], t = f.properties;
    markLayer.clearLayers();
    if (GameMap.pointInFeature(e.latlng, f)) {
      S.busy = true;
      L.marker(e.latlng, { icon: mark(true), interactive: false }).addTo(markLayer);
      const score = Game.taskScore(t.points, S.wrong, S.hint, cfg.scoring);
      S.scores.push(score);
      L.geoJSON(f, { interactive: false, style: { color: '#3f5f2a', weight: 2.5, fillColor: '#c9d4b0', fillOpacity: .35, dashArray: t.is_demo ? '6 6' : null } }).addTo(solvedLayer);
      document.getElementById('level-score').textContent = S.scores.reduce((a, b) => a + b, 0);
      await Game.modal(`<span class="kicker">第 <b>01</b> 篇・任務 ${S.idx + 1}　找到了</span>
        <h2>${esc(t.title)}</h2>
        ${t.is_demo ? '<p><span class="tag tag-demo">示範資料 DEMO</span>　本題的目標範圍是示範資料</p>' : ''}
        <p>${esc(t.historical_description)}</p>
        <dl class="kv">
          <dt>比較年代</dt><dd>${esc(t.historical_year)} ⇄ ${esc(t.comparison_year)}</dd>
          <dt>證據來源</dt><dd>${esc(t.evidence_source)}</dd>
          <dt>可信度</dt><dd>${esc(t.confidence)}</dd>
          <dt>得分</dt><dd>${score}／${t.points}${S.wrong ? `（答錯 ${S.wrong} 次）` : ''}${S.hint ? '（用了提示）' : ''}</dd>
        </dl>`, [{ label: S.idx + 1 < tasks.length ? '下一個任務' : '讀完本篇', cls: 'btn-primary', value: true }], { dismissable: false });
      if (S.idx + 1 < tasks.length) startTask(S.idx + 1); else finish();
    } else {
      S.wrong++;
      L.marker(e.latlng, { icon: mark(false), interactive: false }).addTo(markLayer);
      const c = GameMap.featureCenter(f), d = map.distance(e.latlng, c);
      const near = d < 300 ? '很接近了。' : d < 800 ? '有點接近。' : '還有一段距離。';
      const dir = S.wrong >= 2 ? `目標大約在你點的位置的<b>${bearingName(e.latlng, c)}方</b>。` : '';
      feedback(`不是這裡，${near}${dir}${S.wrong >= 2 && !S.hintsShown.length ? '可以看看文字提示。' : ''}`, 'bad');
      if (window.matchMedia('(max-width: 860px)').matches) Game.toast('不是這裡，' + near, 'bad', 1600);
    }
  });

  async function finish() {
    S.done = true;
    const score = Math.min(100, Math.round(S.scores.reduce((a, b) => a + b, 0) * 100 / (totalPts || 100)));
    document.getElementById('level-score').textContent = score;
    const r = Progress.completeLevel(1, score);
    Game.renderStats();
    panel.innerHTML = `<header class="art-head"><span class="pg">01</span><h1>本篇讀完</h1></header>
      <section class="task"><p>得分 <b class="num" style="font-size:28px">${score}</b>／100。地圖上的綠色範圍是你找到的地點，可以繼續拖動把手比較。</p></section>
      <div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="level2.html">讀第 02 篇</a><button class="btn" id="again">重讀本篇</button></div>`;
    document.getElementById('again').onclick = () => location.reload();
    await Game.fragmentModal(info, score, r);
  }

  // ---------- 開場 ----------
  startTask(0);
  await Game.modal(`<span class="kicker">第 <b>01</b> 篇</span><h2>${esc(info.name.replace(/^第.份檔案：/, ''))}</h2><p>${esc(info.intro)}</p>
    <ol>${info.tutorial.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="note">標示「示範資料 DEMO」的任務，目標範圍是示範資料，只用來測試玩法。</p>`,
    [{ label: '開始調查', cls: 'btn-primary', value: true }]);
})();
