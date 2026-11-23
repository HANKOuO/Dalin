/* 共用遊戲系統：進度儲存、分數、記憶碎片、收藏卡、對話框與提示訊息。
   這個檔案不碰地圖，地圖功能在 js/map.js。 */
(function () {
  'use strict';
  const KEY = 'dalin-timefiles-v1';
  const EMPTY = () => ({ completed: {}, scores: {}, fragments: [], cards: [], unlockAll: false, mode: 'easy' });

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return EMPTY();
      return Object.assign(EMPTY(), JSON.parse(raw));
    } catch (e) { return EMPTY(); }
  }
  function write(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* 無痕模式等情況無法儲存，遊戲仍可玩 */ }
  }

  const Progress = {
    get: read,
    save: write,
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} },
    isDone(level) { return !!read().completed[level]; },
    isUnlocked(level) {
      const p = read();
      if (level === 1 || p.unlockAll) return true;
      return !!p.completed[level - 1];
    },
    /** 完成關卡：保留最高分；回傳 {best, isNewBest, firstTime} */
    completeLevel(level, score) {
      const p = read();
      const firstTime = !p.completed[level];
      const prev = p.scores[level] || 0;
      p.completed[level] = true;
      p.scores[level] = Math.max(prev, score);
      if (!p.fragments.includes(level)) p.fragments.push(level);
      p.fragments.sort();
      write(p);
      return { best: p.scores[level], isNewBest: score > prev, firstTime };
    },
    unlockCard(id) {
      const p = read();
      if (!p.cards.includes(id)) { p.cards.push(id); write(p); return true; }
      return false;
    },
    total() { const s = read().scores; return [1, 2, 3].reduce((a, k) => a + (s[k] || 0), 0); },
    set(key, val) { const p = read(); p[key] = val; write(p); }
  };

  /** 單題計分：答對時呼叫。wrong = 答錯次數，hints = 提示扣分比例加總 */
  function taskScore(points, wrong, hintRatio, scoring) {
    const s = Object.assign({ wrong_penalty: 0.2, min_ratio: 0.3 }, scoring || {});
    const ratio = Math.max(s.min_ratio, 1 - wrong * s.wrong_penalty - hintRatio);
    return Math.round(points * ratio);
  }

  async function loadJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('讀不到 ' + path + '（HTTP ' + r.status + '）');
    return r.json();
  }
  async function loadCSV(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('讀不到 ' + path);
    const text = (await r.text()).replace(/^﻿/, '').trim();
    const [head, ...lines] = text.split(/\r?\n/);
    const keys = head.split(',').map(s => s.trim());
    return lines.filter(Boolean).map(l => {
      const v = l.split(',');
      const o = {};
      keys.forEach((k, i) => { const x = (v[i] || '').trim(); o[k] = x !== '' && !isNaN(+x) ? +x : x; });
      return o;
    });
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 對話框。buttons: [{label, cls, value}]，回傳 Promise<value> */
  function modal(html, buttons = [{ label: '確定', cls: 'btn-primary', value: true }], opts = {}) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<div class="btn-row"></div></div>`;
      const row = back.querySelector('.btn-row');
      const close = v => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      buttons.forEach(b => {
        const el = document.createElement(b.href ? 'a' : 'button');
        el.className = 'btn ' + (b.cls || '');
        el.textContent = b.label;
        if (b.href) el.href = b.href; else el.addEventListener('click', () => close(b.value));
        row.appendChild(el);
      });
      const onKey = e => { if (e.key === 'Escape' && opts.dismissable !== false) close(null); };
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
      const first = row.querySelector('.btn-primary, .btn');
      if (first) first.focus();
    });
  }

  function toast(msg, type = '', ms = 2600) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /** 更新頂部列的總分與碎片數 */
  function renderStats() {
    const p = read();
    document.querySelectorAll('[data-stat="total"]').forEach(el => el.textContent = Progress.total());
    document.querySelectorAll('[data-stat="fragments"]').forEach(el => el.textContent = p.fragments.length);
  }

  /** 用 file:// 直接開啟時，瀏覽器會擋 fetch，提醒使用者 */
  function checkProtocol() {
    if (location.protocol === 'file:') {
      modal(`<span class="kicker">開啟方式</span><h2>請用本機伺服器開啟</h2><p>直接雙擊 HTML 檔時，瀏覽器不允許讀取 GeoJSON／JSON 資料。</p>
        <p>請在 <code>game</code> 資料夾開終端機，執行：</p><pre>python -m http.server 8000</pre>
        <p>再用瀏覽器打開 <code>http://localhost:8000</code>。詳細說明見 README.md。</p>`);
      return false;
    }
    return true;
  }

  function fail(err) {
    console.error(err);
    modal(`<span class="kicker">錯誤</span><h2>資料載入失敗</h2><p>${esc(err.message || err)}</p><p class="note">請確認是用本機伺服器或 GitHub Pages 開啟，並檢查 data 資料夾的檔名。</p>`,
      [{ label: '回目次', cls: 'btn-primary', href: 'index.html' }]);
  }

  /** 關卡完成：直排碎片名＋本篇得分 */
  async function fragmentModal(levelInfo, score, result) {
    const no = String(levelInfo.id).padStart(2, '0');
    const next = levelInfo.id < 3 ? { label: `讀下一篇：第 ${String(levelInfo.id + 1).padStart(2, '0')} 篇`, cls: 'btn-primary', href: `level${levelInfo.id + 1}.html` }
                                  : { label: '翻到封底', cls: 'btn-primary', href: 'finale.html' };
    return modal(`<span class="kicker">第 <b>${no}</b> 篇・讀完</span>
      <div class="frag"><div class="vt-s">${esc(levelInfo.fragment)}</div>
        <div><h2>取得第 ${no} 份記憶碎片</h2>
          <p class="score">${score}<small>　／ 100 分${result.isNewBest && !result.firstTime ? '・新高分' : ''}</small></p>
          <p class="note">本篇最高 ${result.best} 分・三篇合計 ${Progress.total()} 分</p></div></div>`,
      [{ label: '回目次', href: 'index.html' }, next], { dismissable: false });
  }

  function setupPanelToggle() {
    const panel = document.querySelector('.panel');
    const h = panel && panel.querySelector('.handle');
    if (!h) return;
    h.addEventListener('click', () => {
      panel.classList.toggle('open');
      h.setAttribute('aria-expanded', panel.classList.contains('open'));
      h.querySelector('span').textContent = panel.classList.contains('open') ? '收起文章' : '展開文章・提示與證據';
    });
  }

  window.Game = { Progress, taskScore, loadJSON, loadCSV, esc, modal, toast, renderStats, checkProtocol, fail, fragmentModal, setupPanelToggle };
})();
