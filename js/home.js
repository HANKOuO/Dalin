/* 首頁（封面＋目次）：故事、三篇進度、碎片、收藏卡、設定 */
(async function () {
  'use strict';
  const { Progress, esc } = Game;
  if (!Game.checkProtocol()) return;
  let story, buildings, ctx;
  try {
    story = await Game.loadJSON('data/game/story.json');
    const l2 = await Game.loadJSON('data/game/level2.json');
    buildings = await Game.loadJSON(l2.buildings_file);
    ctx = await GameSVGMap.load();
  } catch (e) { return Game.fail(e); }

  document.getElementById('cover-map').insertAdjacentHTML('afterbegin', GameSVGMap.render(ctx.rail, ctx.boundary, ctx.places));
  document.getElementById('issue').textContent = story.issue;
  document.getElementById('cover-kicker').textContent = story.cover_kicker;
  const q = story.cover_quote;
  document.getElementById('quote').innerHTML = q.slice(0, -1).map(esc).join('<br>') + `<em>${esc(q[q.length - 1])}</em>`;
  document.getElementById('lede').textContent = story.cover_lede;
  document.getElementById('years').innerHTML = story.years.map(([y, t]) => `<div><b>${y}</b><span>${esc(t)}</span></div>`).join('');
  document.getElementById('howto').innerHTML = story.how_to_play.map(t => `<li>${esc(t)}</li>`).join('');
  document.getElementById('credits').textContent = story.credits;

  function render() {
    const p = Progress.get();
    const all = story.levels.every(l => Progress.isDone(l.id));
    const next = story.levels.find(l => !Progress.isDone(l.id) && Progress.isUnlocked(l.id));

    document.getElementById('levels').innerHTML = story.levels.map(l => {
      const no = String(l.id).padStart(2, '0');
      const done = Progress.isDone(l.id), open = Progress.isUnlocked(l.id), now = next && next.id === l.id;
      const note = done ? `已讀完・${p.scores[l.id] || 0} 分・可重讀 →` : open ? '現在可以閱讀 →' : `讀完第 ${String(l.id - 1).padStart(2, '0')} 篇後開放`;
      const cls = ['item', now ? 'now' : '', done ? 'done' : '', open ? '' : 'lock'].join(' ');
      const inner = `<span class="pg">${no}</span><h3>${esc(l.name.replace(/^第.份檔案：/, ''))}</h3><p>${esc(l.intro)}</p><span class="note">${note}</span>`;
      return open ? `<a class="${cls}" href="${l.page}">${inner}</a>` : `<div class="${cls}" aria-disabled="true">${inner}</div>`;
    }).join('');

    document.getElementById('cards').innerHTML = buildings.features.map(f => {
      const b = f.properties, got = p.cards.includes(b.building_id);
      if (!got) return `<div class="ccard locked"><div class="ph">？</div><div class="cap"><b>未收藏</b>${esc(b.building_id)}</div></div>`;
      const img = b.current_photo || b.historical_photo;
      return `<div class="ccard"><div class="ph" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : esc(b.building_id)}</div>
        ${b.is_demo ? '<span class="tag tag-demo demo">示範</span>' : ''}<span class="rar">${esc(b.card_rarity || '')}</span>
        <div class="cap"><b>${esc(b.card_title || b.name)}</b>${esc(b.name)}</div></div>`;
    }).join('');

    const start = document.getElementById('start');
    start.href = all ? 'finale.html' : (next ? next.page : 'level1.html');
    start.innerHTML = all ? '翻到封底<small>三份碎片都找回來了</small>'
      : `${p.fragments.length ? '繼續閱讀' : '開始閱讀'}<small>從第 ${String(next ? next.id : 1).padStart(2, '0')} 篇開始調查</small>`;
    document.getElementById('unlock').textContent = p.unlockAll ? '展示模式：已解鎖（點此關閉）' : '展示模式：解鎖全部篇章';
    Game.renderStats();
  }

  document.getElementById('unlock').addEventListener('click', () => { Progress.set('unlockAll', !Progress.get().unlockAll); render(); });
  document.getElementById('reset').addEventListener('click', async () => {
    const ok = await Game.modal('<span class="kicker">設定</span><h2>清除閱讀進度？</h2><p>會刪除這台裝置上的分數、記憶碎片與收藏卡，無法復原。</p>',
      [{ label: '取消', value: false }, { label: '清除', cls: 'btn-primary', value: true }]);
    if (ok) { Progress.reset(); render(); Game.toast('已清除閱讀進度'); }
  });
  render();
})();
