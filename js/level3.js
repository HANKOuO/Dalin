/* 第 03 篇：土地留下的秘密（土地利用變遷推理）
   正確答案一律由 GeoJSON 的 area_m2 與 landuse_change 的屬性計算，程式裡沒有寫死答案。 */
(async function () {
  'use strict';
  const { Progress, esc } = Game;
  if (!Game.checkProtocol()) return;
  Game.setupPanelToggle();
  Game.renderStats();

  let story, cfg, bm, A, B, CH, TR;
  try {
    [story, cfg, bm] = await Promise.all([
      Game.loadJSON('data/game/story.json'), Game.loadJSON('data/game/level3.json'), GameMap.loadBasemaps()]);
    [A, B, CH, TR] = await Promise.all([
      Game.loadJSON(cfg.layers.A), Game.loadJSON(cfg.layers.B), Game.loadJSON(cfg.layers.change), Game.loadCSV(cfg.layers.transitions)]);
  } catch (e) { return Game.fail(e); }
  const info = story.levels[2];
  const title = info.name.replace(/^第.份檔案：/, '');
  if (!Progress.isUnlocked(3)) {
    await Game.modal('<span class="kicker">第 <b>03</b> 篇</span><h2>這一篇還沒開放</h2><p>先讀完第 02 篇「被遺忘的建築」，就能翻到這一篇。</p>',
      [{ label: '回目次', href: 'index.html' }, { label: '讀第 02 篇', cls: 'btn-primary', href: 'level2.html' }], { dismissable: false });
    return;
  }

  // ---------- 由資料計算統計 ----------
  const yearA = A.features[0].properties.year, yearB = B.features[0].properties.year;
  const sumBy = fc => fc.features.reduce((o, f) => { const t = f.properties.landuse_type; o[t] = (o[t] || 0) + (+f.properties.area_m2 || 0); return o; }, {});
  const sumA = sumBy(A), sumB = sumBy(B);
  const types = Array.from(new Set([...Object.keys(cfg.colors), ...Object.keys(sumA), ...Object.keys(sumB)])).filter(t => sumA[t] || sumB[t]);
  const diff = Object.fromEntries(types.map(t => [t, (sumB[t] || 0) - (sumA[t] || 0)]));
  const maxD = Math.max(...Object.values(diff)), minD = Math.min(...Object.values(diff));
  const answers = {
    choice_max_increase: types.filter(t => diff[t] === maxD),
    choice_max_decrease: types.filter(t => diff[t] === minD)
  };
  const ha = m2 => (m2 / 10000).toFixed(1);
  const color = t => cfg.colors[t] || '#8b877e';
  const changeFeatures = CH.features.filter(f => (+f.properties.area_m2 || 0) >= (cfg.min_change_area_m2 || 0));
  const matchChange = (p, m) => {
    if (m.same) return p.from_type === p.to_type;
    if (m.from_type && p.from_type !== m.from_type) return false;
    if (m.to_type && p.to_type !== m.to_type) return false;
    if (m.to_type_not && p.to_type === m.to_type_not) return false;
    return true;
  };

  // ---------- 地圖 ----------
  const map = GameMap.createMap('map', bm, { zoom: 15 });
  const base = GameMap.baseLayer(bm.basemaps[cfg.basemap] ? cfg.basemap : bm.fallback_modern);
  base.setOpacity(.5); base.addTo(map); GameMap.watchTiles(map, base);
  const popupHTML = p => `<dl class="kv">${Object.entries(p).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  const luStyle = f => ({ color: '#191917', weight: .8, fillColor: color(f.properties.landuse_type), fillOpacity: .78 });
  // 變遷圖：有改變＝填後期用途色＋墨色粗框；沒改變＝淡灰
  const chStyle = f => f.properties.from_type === f.properties.to_type
    ? { color: '#8b877e', weight: .8, fillColor: '#cfcabd', fillOpacity: .45 }
    : { color: '#191917', weight: 2.5, fillColor: color(f.properties.to_type), fillOpacity: .85 };
  const mk = (fc, style) => L.geoJSON(fc, { style, onEachFeature: (f, l) => l.on('click', ev => onParcel(ev, f)) });
  const layers = { A: mk(A, luStyle), B: mk(B, luStyle), change: mk(CH, chStyle) };
  const hl = L.layerGroup().addTo(map);
  const viewName = { A: `${yearA} 年土地利用`, B: `${yearB} 年土地利用`, change: `${yearA}→${yearB} 變遷（粗框＝有改變，填色＝後期用途）` };
  let view = 'A';
  function setView(v) {
    Object.values(layers).forEach(l => map.removeLayer(l));
    layers[v].addTo(map); view = v;
    document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('on', b.dataset.view === v); b.setAttribute('aria-pressed', b.dataset.view === v); });
    banner.textContent = viewName[v] + (cfg.is_demo ? '・示範資料' : '');
  }
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  map.fitBounds(layers.A.getBounds().pad(0.15), mobile ? { paddingTopLeft: [0, 60], paddingBottomRight: [0, 150] } : {});
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); d.innerHTML = '<b>土地利用分類</b><br>' + types.map(t => `<i style="background:${color(t)}"></i>${esc(t)}`).join('<br>') + '<br><i style="background:#cfcabd"></i>未改變（變遷圖）'; return d; };
  legend.addTo(map);
  // 年代切換放在地圖右上角，手機不用打開文章也能切換
  const sw = L.control({ position: 'topright' });
  sw.onAdd = () => {
    const d = L.DomUtil.create('div', 'yearseg');
    d.setAttribute('role', 'group'); d.setAttribute('aria-label', '切換年代');
    d.innerHTML = `<button type="button" data-view="A">${yearA}</button><button type="button" data-view="B">${yearB}</button><button type="button" data-view="change">變遷</button>`;
    L.DomEvent.disableClickPropagation(d);
    d.querySelectorAll('button').forEach(b => b.onclick = () => setView(b.dataset.view));
    return d;
  };
  sw.addTo(map);
  const wrap = document.querySelector('.map-wrap');
  const banner = document.createElement('div'); banner.className = 'map-banner'; wrap.appendChild(banner);
  if (cfg.is_demo) { const wm = document.createElement('div'); wm.className = 'map-demo-watermark'; wm.textContent = '示範土地利用 DEMO'; wrap.appendChild(wm); }
  setView('A');

  // ---------- 統計圖（雜誌圖說樣式） ----------
  function chartSVG(highlight) {
    const max = Math.max(...types.map(t => Math.max(sumA[t] || 0, sumB[t] || 0)));
    const rowH = 46, w = 340, lab = 84, barW = w - lab - 70;
    const rows = types.map((t, i) => {
      const y = i * rowH + 18, a = sumA[t] || 0, b = sumB[t] || 0, d = diff[t];
      const hi = highlight && highlight.includes(t);
      return `<g>${hi ? `<rect x="0" y="${y - 15}" width="${w}" height="${rowH - 4}" fill="#ebe7dc"/><rect x="0" y="${y - 15}" width="3" height="${rowH - 4}" fill="#d2452f"/>` : ''}
        <text x="${hi ? 9 : 0}" y="${y + 8}" font-size="12.5" fill="#191917" font-weight="${hi ? 700 : 400}">${esc(t)}</text>
        <rect x="${lab}" y="${y - 8}" width="${Math.max(1, barW * a / max)}" height="11" fill="none" stroke="${color(t)}" stroke-width="1.5"/>
        <rect x="${lab}" y="${y + 5}" width="${Math.max(1, barW * b / max)}" height="11" fill="${color(t)}"/>
        <text x="${lab + barW * Math.max(a, b) / max + 5}" y="${y + 8}" font-size="11.5" font-weight="700" fill="${d > 0 ? '#3f5f2a' : d < 0 ? '#d2452f' : '#4f4d47'}">${d > 0 ? '+' : d < 0 ? '−' : ''}${ha(Math.abs(d))}</text></g>`;
    }).join('');
    return `<figure class="fig"><svg class="chart" viewBox="0 0 ${w} ${types.length * rowH + 6}" role="img" aria-label="${yearA} 與 ${yearB} 年各類土地利用面積">${rows}</svg>
      <figcaption><b>圖</b>空心框＝${yearA} 年，實心＝${yearB} 年；右側數字是增減（公頃）。依兩期圖層的 area_m2 加總。</figcaption></figure>`;
  }
  function transitionTable() {
    const rows = TR.filter(r => r.from_type !== r.to_type).sort((a, b) => b.area_m2 - a.area_m2);
    return `<figure class="fig" style="margin-top:14px"><table class="data"><thead><tr><th>從</th><th>變成</th><th style="text-align:right">公頃</th></tr></thead><tbody>${rows.map(r =>
      `<tr><td>${esc(r.from_type)}</td><td>${esc(r.to_type)}</td><td class="num">${ha(r.area_m2)}</td></tr>`).join('')}</tbody></table>
      <figcaption><b>表</b>轉換統計，取自 ${esc(cfg.layers.transitions)}（QGIS 交集後依 from_type、to_type 加總）。</figcaption></figure>`;
  }

  // ---------- 題目 ----------
  const panel = document.getElementById('panel-body');
  const Q = cfg.questions;
  const S = { idx: 0, wrong: 0, hint: 0, hinted: false, scores: [], answered: false, done: false, fb: null, explain: '', wrongT: [], rightT: [] };

  function render() {
    const q = Q[S.idx], isChoice = q.kind.startsWith('choice');
    const steps = Q.map((_, i) => `<span class="${i < S.idx || (i === S.idx && S.answered) ? 'done' : i === S.idx ? 'now' : ''}"></span>`).join('');
    const btnCls = t => S.rightT.includes(t) ? 'right' : S.wrongT.includes(t) ? 'wrong' : '';
    panel.innerHTML = `
      <header class="art-head">
        <span class="pg">03</span><h1>${esc(title)}</h1>
        <div class="kicker"><span>問題 <b>${S.idx + 1}</b>／${Q.length}</span><span>本題 ${q.points} 分</span></div>
        <div class="steps" style="grid-column:1/-1">${steps}</div>
      </header>
      ${cfg.is_demo ? `<p class="demo-note"><span class="tag tag-demo">示範資料 DEMO</span>　目前的土地利用是示範格網，分類是虛構的，答案只代表示範資料的計算結果，不是大林的真實變遷。換上 QGIS 匯出的正式資料後，答案會自動重新計算。</p>` : ''}
      <section class="task">
        <div class="meta"><span>${isChoice ? '選擇題' : '地圖點選題'}</span><span>${yearA} ⇄ ${yearB}</span></div>
        <h2>${esc(q.text)}</h2>
        ${isChoice ? `<ol class="choices" id="choices">${types.map(t => `<li><button type="button" data-t="${esc(t)}" class="${btnCls(t)}" ${S.answered || S.wrongT.includes(t) ? 'disabled' : ''}><i style="background:${color(t)}"></i>${esc(t)}</button></li>`).join('')}</ol>`
                   : '<p>用地圖右上角的年代切換觀察，然後在地圖上點一塊地。點任何地塊都會顯示它的屬性。</p>'}
      </section>
      ${S.fb ? `<div class="feedback ${S.fb.cls}" id="feedback" role="status">${S.fb.html}</div>` : ''}
      <div class="notes">${S.hinted ? `<div class="note-fn"><b>編者註</b>${esc(q.hint)}</div>${isChoice && !S.answered ? chartSVG() : ''}` : ''}</div>
      <div class="tools">
        ${S.answered ? `<button class="btn btn-primary" id="btn-next">${S.idx + 1 < Q.length ? '下一題' : '讀完本篇'}</button>`
                     : `<button class="link-btn" id="btn-hint" ${S.hinted ? 'disabled' : ''}>※ ${isChoice ? '看面積統計' : '看提示並切到變遷圖'}（−10%）</button>`}
      </div>
      ${S.explain ? `<section class="analysis"><h3>分析依據</h3>${S.explain}</section>` : ''}
      <details class="fold"><summary>資料說明</summary><div class="in">
        早期：${esc(cfg.layers.A)}（${yearA}）<br>後期：${esc(cfg.layers.B)}（${yearB}）<br>變遷：${esc(cfg.layers.change)}<br>
        面積小於 ${cfg.min_change_area_m2} 平方公尺的變遷碎片視為兩期圖資的配準誤差，不列入點選題判斷。</div></details>`;
    const h = document.getElementById('btn-hint');
    if (h) h.onclick = () => { S.hinted = true; S.hint += 0.1; if (!isChoice) setView('change'); render(); };
    const nx = document.getElementById('btn-next');
    if (nx) nx.onclick = next;
    if (isChoice) panel.querySelectorAll('#choices button').forEach(b => b.onclick = () => choose(b.dataset.t));
    document.getElementById('level-score').textContent = S.scores.reduce((a, b) => a + b, 0);
  }

  function feedback(html, cls) { S.fb = { html, cls }; render(); }

  function correct(explainHTML) {
    const q = Q[S.idx];
    const s = Game.taskScore(q.points, S.wrong, S.hint, { wrong_penalty: 0.2, min_ratio: 0.3 });
    S.scores.push(s); S.answered = true; S.explain = explainHTML;
    feedback(`答對了。本題得分 <b>${s}</b>／${q.points}。`, 'good');
    if (mobile) document.getElementById('panel').classList.add('open');
  }

  function choose(t) {
    if (S.answered) return;
    const q = Q[S.idx], ans = answers[q.kind];
    if (!ans.includes(t)) {
      S.wrong++; S.wrongT.push(t);
      feedback(`「${esc(t)}」不是答案。${S.hinted ? '再比較一次圖中每一類的增減。' : '切換兩個年代比較顏色，或看看面積統計。'}`, 'bad');
      return;
    }
    S.rightT = ans.slice();
    const verb = q.kind === 'choice_max_increase' ? '增加' : '減少';
    correct(`${chartSVG(ans)}<p>依兩期土地利用面積加總，<b>${ans.map(esc).join('、')}</b>${verb}了 ${ha(Math.abs(diff[ans[0]]))} 公頃，是所有類別中${verb}最多的。</p>${transitionTable()}`);
  }

  function onParcel(ev, f) {
    L.popup({ maxWidth: 260 }).setLatLng(ev.latlng).setContent(popupHTML(f.properties)).openOn(map);
    const q = Q[S.idx];
    if (S.done || S.answered || q.kind !== 'click_change') return;
    const cf = changeFeatures.find(c => GameMap.pointInFeature(ev.latlng, c));
    if (!cf) { feedback('這裡沒有可以判斷的變遷地塊（可能是配準誤差的小碎片），換一塊試試。', 'bad'); return; }
    const p = cf.properties;
    if (matchChange(p, q.match)) {
      hl.clearLayers();
      const all = changeFeatures.filter(c => matchChange(c.properties, q.match));
      L.geoJSON({ type: 'FeatureCollection', features: all }, { interactive: false, style: { color: '#d2452f', weight: 2.5, fill: false, dashArray: '5 4' } }).addTo(hl);
      L.geoJSON(cf, { interactive: false, style: { color: '#3f5f2a', weight: 5, fill: false } }).addTo(hl);
      const tot = all.reduce((s, c) => s + (+c.properties.area_m2 || 0), 0);
      correct(`<p>你點的地塊是 <b>${esc(p.from_type)} → ${esc(p.to_type)}</b>，${ha(p.area_m2)} 公頃。</p>
        <p>地圖上的朱紅虛線框是所有符合條件的地塊，共 ${all.length} 塊、${ha(tot)} 公頃，依 landuse_change 圖層計算。</p>${transitionTable()}`);
    } else {
      S.wrong++;
      feedback(`這塊是「${esc(p.from_type)} → ${esc(p.to_type)}」，不符合題目。${S.hinted ? '' : '試試切到「變遷」觀察。'}`, 'bad');
    }
  }

  function next() {
    hl.clearLayers(); map.closePopup();
    if (S.idx + 1 < Q.length) { Object.assign(S, { idx: S.idx + 1, wrong: 0, hint: 0, hinted: false, answered: false, fb: null, explain: '', wrongT: [], rightT: [] }); render(); }
    else finish();
  }

  async function finish() {
    S.done = true;
    const score = Math.min(100, S.scores.reduce((a, b) => a + b, 0));
    const r = Progress.completeLevel(3, score);
    Game.renderStats();
    document.getElementById('level-score').textContent = score;
    panel.innerHTML = `<header class="art-head"><span class="pg">03</span><h1>本篇讀完</h1></header>
      <section class="task"><p>得分 <b class="num" style="font-size:28px">${score}</b>／100。三篇都讀完了，翻到封底看看你找回的時光檔案。</p></section>
      <div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="finale.html">翻到封底</a><button class="btn" id="again">重讀本篇</button></div>
      <section class="analysis"><h3>面積統計</h3>${chartSVG()}${transitionTable()}</section>`;
    document.getElementById('again').onclick = () => location.reload();
    await Game.fragmentModal(info, score, r);
  }

  render();
  await Game.modal(`<span class="kicker">第 <b>03</b> 篇</span><h2>${esc(title)}</h2><p>${esc(info.intro)}</p>
    <ol>${info.tutorial.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${cfg.is_demo ? '<p class="note">目前使用示範格網（DEMO）。分類是虛構的，只用來測試玩法；換上 QGIS 分析資料後，答案會自動由資料重新計算。</p>' : ''}`,
    [{ label: '開始推理', cls: 'btn-primary', value: true }]);
})();
