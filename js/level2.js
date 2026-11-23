/* 第 02 篇：糖廠記憶解謎（依檔案線索在地圖上找建築、解鎖收藏卡） */
(async function () {
  'use strict';
  const { Progress, esc } = Game;
  if (!Game.checkProtocol()) return;
  Game.setupPanelToggle();
  Game.renderStats();

  let story, cfg, bm, data, rail, boundary;
  try {
    [story, cfg, bm] = await Promise.all([
      Game.loadJSON('data/game/story.json'), Game.loadJSON('data/game/level2.json'), GameMap.loadBasemaps()]);
    [data, rail, boundary] = await Promise.all([
      Game.loadJSON(cfg.buildings_file),
      Game.loadJSON('data/gis/context/rail_1939_1953.geojson'),
      Game.loadJSON('data/gis/context/dalin_boundary.geojson')]);
  } catch (e) { return Game.fail(e); }
  const info = story.levels[1];
  const title = info.name.replace(/^第.份檔案：/, '');
  if (!Progress.isUnlocked(2)) {
    await Game.modal('<span class="kicker">第 <b>02</b> 篇</span><h2>這一篇還沒開放</h2><p>先讀完第 01 篇「消失的地景」，就能翻到這一篇。</p>',
      [{ label: '回目次', href: 'index.html' }, { label: '讀第 01 篇', cls: 'btn-primary', href: 'level1.html' }], { dismissable: false });
    return;
  }
  const byId = Object.fromEntries(data.features.map(f => [f.properties.building_id, f]));
  const quests = cfg.quests.filter(id => byId[id]);
  const ptsEach = 100 / quests.length;

  // ---------- 地圖 ----------
  const map = GameMap.createMap('map', bm, { zoom: 15 });
  const base = GameMap.baseLayer(bm.basemaps[cfg.basemap] ? cfg.basemap : bm.fallback_modern);
  base.addTo(map); GameMap.watchTiles(map, base);
  L.geoJSON(boundary, { interactive: false, style: { color: '#191917', weight: 1.5, dashArray: '6 5', fill: false } }).addTo(map);
  L.geoJSON(rail, { interactive: false, style: f => f.properties.start_year === 1939
    ? { color: '#d2452f', weight: 2.5, opacity: .75 }
    : { color: '#191917', weight: 2, opacity: .6, dashArray: f.properties.layer === '1953支線' ? '2 7' : null } }).addTo(map);

  const S = { idx: 0, wrong: 0, hint: 0, hinted: false, scores: [], busy: false, done: false, fb: null, found: new Set(),
    mode: Progress.get().mode === 'normal' ? 'normal' : 'easy' };

  // 待調查＝紙底墨框；已找到＝甘蔗綠。不用橘色，避免和朱紅的錯誤提示混淆。
  const styleFor = id => S.found.has(id)
    ? { color: '#191917', weight: 2, fillColor: '#3f5f2a', fillOpacity: 1, radius: 11 }
    : { color: '#191917', weight: 2.5, fillColor: '#f5f3ec', fillOpacity: 1, radius: 11 };
  const layer = L.geoJSON(data, {
    pointToLayer: (f, ll) => L.circleMarker(ll, styleFor(f.properties.building_id)),
    style: f => Object.assign(styleFor(f.properties.building_id), { fillOpacity: .45 }),
    onEachFeature: (f, l) => l.on('click', ev => { L.DomEvent.stopPropagation(ev); onPick(f); })
  }).addTo(map);
  // 手機觸控：點位外圍加一圈透明的大圓（半徑 24px）
  const touch = L.layerGroup().addTo(map);
  data.features.filter(f => f.geometry.type === 'Point').forEach(f => {
    L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { radius: 24, stroke: false, fillOpacity: 0 })
      .on('click', ev => { L.DomEvent.stopPropagation(ev); onPick(f); }).addTo(touch);
  });
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  map.fitBounds(layer.getBounds().pad(0.25), mobile ? { paddingBottomRight: [0, 150] } : {});
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'legend');
    d.innerHTML = '<b>圖例</b><br><i style="background:#f5f3ec;border-radius:50%;border-width:2px"></i>待調查的地點<br><i style="background:#3f5f2a;border-radius:50%"></i>已收進檔案<br><i style="background:#d2452f;height:3px;border:0;vertical-align:3px"></i>1939 鐵路（組員數化）';
    return d;
  };
  legend.addTo(map);
  if (data.features.some(f => f.properties.is_demo)) {
    const wm = document.createElement('div'); wm.className = 'map-demo-watermark'; wm.textContent = '含示範點位 DEMO';
    document.querySelector('.map-wrap').appendChild(wm);
  }

  const panel = document.getElementById('panel-body');
  const photoOf = b => b.historical_photo || b.current_photo;
  const fallback = `onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'noimg',textContent:'照片無法載入'}))"`;
  const noimg = '<div class="noimg">尚無經查證的照片<br>等組員補上</div>';
  const imgHTML = (src, cap) => `<figure>${src ? `<img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" ${fallback}>` : noimg}<figcaption>${esc(cap)}</figcaption></figure>`;
  const shelfCard = q => { const bb = byId[q].properties, ph = photoOf(bb);
    return `<div class="ccard" title="${esc(bb.name)}"><div class="ph" ${ph ? `style="background-image:url('${esc(ph)}')"` : ''}>${ph ? '' : esc(q)}</div><div class="cap"><b>${esc(bb.card_title)}</b></div></div>`; };

  function render() {
    const id = quests[S.idx], b = byId[id].properties, m = cfg.modes[S.mode];
    const steps = quests.map((_, i) => `<span class="${i < S.idx ? 'done' : i === S.idx ? 'now' : ''}"></span>`).join('');
    const photo = photoOf(b);
    const cap = photo ? `${b.historical_photo ? '歷史照片' : '現況照片'}　${b.historical_photo_credit || b.current_photo_credit || ''}` : '照片待補';
    panel.innerHTML = `
      <header class="art-head">
        <span class="pg">02</span><h1>${esc(title)}</h1>
        <div class="kicker"><span>檔案 <b>${S.idx + 1}</b>／${quests.length}</span><span>本題 ${Math.round(ptsEach)} 分</span></div>
        <div class="steps" style="grid-column:1/-1">${steps}</div>
      </header>
      <div class="seg" role="group" aria-label="閱讀難度">${Object.entries(cfg.modes).map(([k, v]) =>
        `<button type="button" data-mode="${k}" class="${k === S.mode ? 'on' : ''}" aria-pressed="${k === S.mode}" ${v.disabled ? 'disabled title="尚未開放"' : ''}>${esc(v.label)}</button>`).join('')}</div>
      <p class="hint-line" style="margin-top:6px">${esc(m.desc)}</p>
      <section class="file">
        <div class="meta"><span class="tag tag-type">檔案編號 ${esc(id)}</span>${b.is_demo ? '<span class="tag tag-demo">示範資料 DEMO</span>' : ''}</div>
        ${m.show_photo ? `<figure class="sleeve">${photo ? `<img src="${esc(photo)}" alt="${esc(cap)}" ${fallback}>` : noimg}<figcaption>${esc(cap)}</figcaption></figure>` : ''}
        <h2>${m.show_name ? `要找的是：${esc(b.name)}` : '這張照片拍的是哪裡？'}</h2>
        <p class="clue">${esc(b[m.clue_field] || '')}</p>
      </section>
      ${S.fb ? `<div class="feedback ${S.fb.cls}" id="feedback" role="status">${S.fb.html}</div>` : ''}
      <div class="notes">${S.hinted ? `<div class="note-fn"><b>編者註</b>這棟建築過去的用途是「${esc(b.historical_use)}」。地圖已經移到附近，目標就在畫面裡。</div>` : ''}</div>
      <div class="tools"><button class="link-btn" id="btn-hint" ${S.hinted ? 'disabled' : ''}>※ 看提示並移到附近（−${Math.round(cfg.scoring.hint_penalty * 100)}%）</button></div>
      <p class="hint-line">點地圖上的白色圓點來調查。圓點不寫名稱，請依照片與線索判斷。</p>
      <div class="kick-s">收藏卡　${S.found.size}／${quests.length}</div>
      <div class="shelf">${quests.map(q => S.found.has(q) ? shelfCard(q) : '<div class="ccard locked"><div class="ph">？</div><div class="cap"><b>未收藏</b></div></div>').join('')}</div>`;
    panel.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => {
      if (cfg.modes[btn.dataset.mode].disabled) return;
      S.mode = btn.dataset.mode; Progress.set('mode', S.mode); render();
    });
    document.getElementById('btn-hint').onclick = () => {
      S.hinted = true; S.hint += cfg.scoring.hint_penalty;
      const f = byId[quests[S.idx]];
      const c = f.geometry.type === 'Point' ? L.latLng(f.geometry.coordinates[1], f.geometry.coordinates[0]) : L.geoJSON(f).getBounds().getCenter();
      map.flyToBounds(c.toBounds(900), { duration: .8 });
      render();
    };
    document.getElementById('level-score').textContent = Math.round(S.scores.reduce((a, b) => a + b, 0));
  }

  function feedback(html, cls) { S.fb = { html, cls }; render(); }

  async function onPick(f) {
    if (S.busy || S.done) return;
    const want = quests[S.idx], b = f.properties;
    if (b.building_id !== want) {
      S.wrong++;
      const msg = S.found.has(b.building_id) ? `這是已經收進檔案的「${b.name}」。` : `這裡是「${b.name}」，不是檔案裡的地點。`;
      feedback(esc(msg) + (S.wrong >= 2 && !S.hinted ? '可以看看提示。' : ''), 'bad');
      if (mobile) Game.toast('不是這裡，再看一次線索', 'bad', 1500);
      return;
    }
    S.busy = true;
    const score = Game.taskScore(ptsEach, S.wrong, S.hint, cfg.scoring);
    S.scores.push(score);
    S.found.add(want);
    const isNew = Progress.unlockCard(want);
    layer.setStyle(f2 => Object.assign(styleFor(f2.properties.building_id), f2.geometry.type === 'Point' ? {} : { fillOpacity: .45 }));
    const yr = v => v == null ? '<span class="note">未查證（不推測）</span>' : esc(v);
    await Game.modal(`
      <span class="kicker">第 <b>02</b> 篇・檔案 ${S.idx + 1}　${isNew ? '收進新的收藏卡' : '收藏卡（已擁有）'}</span>
      <h2>${esc(b.card_title)}<small class="sub">${esc(b.name)}</small></h2>
      ${b.is_demo ? '<p><span class="tag tag-demo">示範資料 DEMO</span>　這張卡的地點、照片與文字是示範資料，不是真實建築</p>' : ''}
      <div class="story-card">
        ${imgHTML(b.historical_photo, '過去' + (b.historical_photo_credit ? '　' + b.historical_photo_credit : ''))}
        ${imgHTML(b.current_photo, '現在' + (b.current_photo_credit ? '　' + b.current_photo_credit : ''))}
      </div>
      <p>${esc(b.historical_description)}</p>
      <dl class="kv">
        <dt>過去用途</dt><dd>${esc(b.historical_use)}</dd>
        <dt>現在用途</dt><dd>${esc(b.current_use)}</dd>
        <dt>現況</dt><dd>${esc(b.current_status)}</dd>
        <dt>文獻興建年</dt><dd>${yr(b.construction_year)}</dd>
        <dt>圖資最早辨識</dt><dd>${yr(b.first_observed_year)}</dd>
        ${b.construction_year_note ? `<dt>年份說明</dt><dd>${esc(b.construction_year_note)}</dd>` : ''}
        <dt>開放參觀</dt><dd>${esc(b.public_access)}</dd>
        <dt>來源</dt><dd>${esc(b.source)}</dd>
        <dt>可信度</dt><dd>${esc(b.confidence)}</dd>
        <dt>得分</dt><dd>${Math.round(score)}／${Math.round(ptsEach)}</dd>
      </dl>
      <p class="note">「文獻興建年」是有文獻證實的興建年份；「圖資最早辨識」是在歷史地圖或航照上最早看得到的年份，兩者不一定相同。</p>`,
      [{ label: S.idx + 1 < quests.length ? '下一份檔案' : '讀完本篇', cls: 'btn-primary', value: true }], { dismissable: false });
    if (S.idx + 1 < quests.length) { Object.assign(S, { idx: S.idx + 1, wrong: 0, hint: 0, hinted: false, busy: false, fb: null }); render(); }
    else finish();
  }

  map.on('click', () => { if (!S.done && !S.busy) feedback('這裡沒有調查地點，請點地圖上的白色圓點。', 'bad'); });

  async function finish() {
    S.done = true;
    const score = Math.min(100, Math.round(S.scores.reduce((a, b) => a + b, 0)));
    const r = Progress.completeLevel(2, score);
    Game.renderStats();
    panel.innerHTML = `<header class="art-head"><span class="pg">02</span><h1>本篇讀完</h1></header>
      <section class="task"><p>得分 <b class="num" style="font-size:28px">${score}</b>／100。${quests.length} 張收藏卡都收進檔案了，也會出現在目次頁的「建築收藏」。</p></section>
      <div class="shelf">${quests.map(shelfCard).join('')}</div>
      <div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="level3.html">讀第 03 篇</a><button class="btn" id="again">重讀本篇</button></div>`;
    document.getElementById('level-score').textContent = score;
    document.getElementById('again').onclick = () => location.reload();
    await Game.fragmentModal(info, score, r);
  }

  render();
  const choice = await Game.modal(`<span class="kicker">第 <b>02</b> 篇</span><h2>${esc(title)}</h2><p>${esc(info.intro)}</p>
    <ol>${info.tutorial.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p><b>選擇難度。</b>簡單：照片加名稱。普通：照片加部分線索。困難模式之後開放。</p>
    <p class="note">標示「示範資料 DEMO」的地點與照片是示範資料，不是真實建築。</p>`,
    [{ label: '簡單', value: 'easy', cls: S.mode === 'easy' ? 'btn-primary' : '' }, { label: '普通', value: 'normal', cls: S.mode === 'normal' ? 'btn-primary' : '' }]);
  if (choice) { S.mode = choice; Progress.set('mode', choice); render(); }
})();
