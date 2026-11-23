/* 封底：總分、三份碎片、印章、成果摘要、可下載的完成卡 */
(async function () {
  'use strict';
  const { Progress, esc } = Game;
  if (!Game.checkProtocol()) return;
  Game.renderStats();
  const main = document.getElementById('main');
  let story;
  try { story = await Game.loadJSON('data/game/story.json'); } catch (e) { return Game.fail(e); }
  const p = Progress.get();
  const no = id => String(id).padStart(2, '0');
  const short = l => l.name.replace(/^第.份檔案：/, '');
  if (!story.levels.every(l => p.completed[l.id])) {
    const left = story.levels.filter(l => !p.completed[l.id]);
    main.innerHTML = `<section class="back"><h1 class="vt">還沒翻完</h1><div>
      <h1>還有 ${left.length} 篇沒有讀完</h1>
      <p>${left.map(l => `第 ${no(l.id)} 篇「${esc(short(l))}」`).join('、')}。讀完三篇、找回三份記憶碎片，就能翻到封底。</p>
      <div class="btn-row" style="margin-top:18px"><a class="btn btn-primary" href="${left[0].page}">讀第 ${no(left[0].id)} 篇</a><a class="btn" href="index.html">回目次</a></div></div></section>`;
    return;
  }
  const total = Progress.total();
  const rank = total >= 270 ? '甲' : total >= 210 ? '乙' : '丙';
  // 印章：朱紅方印，取代原本的獎牌圖示。等第用甲乙丙，不用金銀銅，跟刊物的語氣一致。
  const seal = `<svg class="seal" viewBox="0 0 150 150" role="img" aria-label="調查員印章，等第${rank}">
    <rect x="6" y="6" width="138" height="138" fill="none" stroke="#d2452f" stroke-width="6"/>
    <rect x="16" y="16" width="118" height="118" fill="#d2452f"/>
    <g fill="#f5f3ec" font-family="Noto Serif TC, serif" font-weight="900" text-anchor="middle">
      <text x="103" y="70" font-size="44">大</text><text x="103" y="122" font-size="44">林</text>
      <text x="47" y="70" font-size="44">調</text><text x="47" y="122" font-size="44">查</text></g>
    <line x1="75" y1="24" x2="75" y2="126" stroke="#f5f3ec" stroke-width="2"/></svg>`;

  main.innerHTML = `
    <section class="back">
      <h1 class="vt">時光檔案<small>封底</small></h1>
      <div>
        <div class="total">${total}<small>總分　滿分 300</small></div>
        <h1>${esc(story.finale.title)}</h1>
        <p>你是本期的<b>${esc(story.finale.badge)}</b>，等第「${rank}」。</p>
        <div class="frags">${story.levels.map(l => `<div><b>${no(l.id)}</b><span>${esc(l.fragment)}</span><small>${esc(short(l))}・${p.scores[l.id]} 分</small></div>`).join('')}</div>
      </div>
      <aside>${seal}<p class="hint-line" style="margin-top:12px">印章依總分給等第：270 分以上為甲，210 分以上為乙，其餘為丙。</p></aside>
    </section>
    <section class="band" aria-labelledby="sum-h">
      <h2 class="sec-h" id="sum-h">這一期讀到的<small>SUMMARY</small></h2>
      <div><ol class="howto">${story.finale.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <p class="demo-note">遊戲中標示「示範資料 DEMO」的內容是示範資料，不是大林糖廠的真實歷史。</p></div>
    </section>
    <section class="band" aria-labelledby="card-h">
      <h2 class="sec-h" id="card-h">完成卡<small>下載成圖片</small></h2>
      <div class="cardgrid">
        <canvas id="card" width="840" height="1176" aria-label="完成卡預覽"></canvas>
        <div>
          <label for="name" class="kick-s" style="display:block;margin:0 0 8px">調查員名字（會印在卡片上）</label>
          <input class="input" id="name" maxlength="16" placeholder="例如：小林" autocomplete="off">
          <div class="btn-row" style="margin-top:16px"><button class="btn btn-primary" id="dl">下載完成卡（PNG）</button></div>
          <p class="hint-line">卡片只在這台裝置上產生，不會上傳。</p>
        </div>
      </div>
    </section>
    <footer class="colophon"><div>進度存在這台裝置的瀏覽器裡。</div>
      <div><a class="link-btn" href="index.html">回目次</a><button class="link-btn" id="replay">清除進度，從頭再讀</button></div></footer>`;

  // ---------- 完成卡（與網站同一套紙、墨、朱紅） ----------
  const cv = document.getElementById('card'), ctx = cv.getContext('2d');
  const SERIF = '"Noto Serif TC","PingFang TC","Microsoft JhengHei",serif', SANS = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const C = { paper: '#f5f3ec', paper2: '#ebe7dc', ink: '#191917', ink2: '#4f4d47', hair: '#cfcabd', ver: '#d2452f', cane: '#3f5f2a' };
  function vtext(str, x, y, size) { [...str].forEach((ch, i) => ctx.fillText(ch, x, y + i * size * 1.08)); }
  function draw() {
    const W = cv.width, H = cv.height, name = document.getElementById('name').value.trim() || '時光調查員';
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    // 刊頭
    ctx.fillStyle = C.ink; ctx.fillRect(56, 56, W - 112, 6);
    ctx.font = `700 22px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText(story.issue || '地方文史特集', 56, 100);
    ctx.textAlign = 'right'; ctx.fillText('封底', W - 56, 100);
    ctx.fillRect(56, 116, W - 112, 1.5);
    // 直排標題
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.font = `900 96px ${SERIF}`;
    vtext('大林糖廠', W - 120, 230, 96);
    ctx.font = `400 30px ${SERIF}`; ctx.fillStyle = C.ink2; vtext('失落的時光檔案', W - 200, 220, 30);
    // 總分
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `900 220px ${SERIF}`; ctx.fillText(String(total), 56, 360);
    ctx.font = `500 24px ${SANS}`; ctx.fillStyle = C.ink2; ctx.fillText('總分　滿分 300', 62, 410);
    ctx.fillStyle = C.ink; ctx.font = `900 60px ${SERIF}`; ctx.fillText(name, 56, 530);
    ctx.font = `400 28px ${SERIF}`; ctx.fillStyle = C.ink2; ctx.fillText(story.finale.badge + '・等第' + rank, 58, 580);
    // 碎片
    ctx.fillStyle = C.ink; ctx.fillRect(56, 680, W - 112, 1.5);
    const colW = (W - 112) / 3;
    story.levels.forEach((l, i) => {
      const x = 56 + i * colW + (i ? 24 : 0);
      if (i) { ctx.fillStyle = C.hair; ctx.fillRect(56 + i * colW, 700, 1.5, 200); }
      ctx.fillStyle = C.ver; ctx.font = `900 80px ${SERIF}`; ctx.fillText(no(l.id), x, 780);
      ctx.fillStyle = C.ink; ctx.font = `700 34px ${SERIF}`; ctx.fillText(l.fragment, x, 840);
      ctx.fillStyle = C.ink2; ctx.font = `400 24px ${SANS}`; ctx.fillText(p.scores[l.id] + ' 分', x, 880);
    });
    // 印章
    const sx = W - 56 - 170, sy = 940;
    ctx.strokeStyle = C.ver; ctx.lineWidth = 6; ctx.strokeRect(sx, sy, 170, 170);
    ctx.fillStyle = C.ver; ctx.fillRect(sx + 12, sy + 12, 146, 146);
    ctx.fillStyle = C.paper; ctx.font = `900 54px ${SERIF}`; ctx.textAlign = 'center';
    ctx.fillText('大', sx + 122, sy + 78); ctx.fillText('林', sx + 122, sy + 140);
    ctx.fillText('調', sx + 50, sy + 78); ctx.fillText('查', sx + 50, sy + 140);
    // 版權列
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink2; ctx.font = `400 22px ${SANS}`;
    ctx.fillText('大林糖廠歷史空間變遷分析與遊戲化互動展示', 56, H - 110);
    ctx.fillText(new Date().toLocaleDateString('zh-TW'), 56, H - 74);
    ctx.fillStyle = C.ink; ctx.fillRect(56, H - 56, W - 112, 6);
  }
  document.getElementById('name').addEventListener('input', draw);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(draw);
  draw();
  document.getElementById('dl').onclick = () => {
    cv.toBlob(blob => {
      const a = document.createElement('a');
      a.download = 'dalin-timefiles-card.png';
      a.href = URL.createObjectURL(blob);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  };
  document.getElementById('replay').onclick = async () => {
    const ok = await Game.modal('<span class="kicker">設定</span><h2>清除進度，從頭再讀？</h2><p>會刪除這台裝置上的分數、記憶碎片與收藏卡，無法復原。</p>',
      [{ label: '取消', value: false }, { label: '清除並從頭讀', cls: 'btn-primary', value: true }]);
    if (ok) { Progress.reset(); location.href = 'index.html'; }
  };
})();
