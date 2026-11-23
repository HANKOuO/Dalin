// 自動測試：模擬圖磚後走完三關與通關畫面。用法：先在 game/ 執行 python -m http.server 8765，再執行 node tests/e2e_playwright.js [desk|mobile]（需安裝 playwright）。截圖存在目前資料夾。
const { chromium, devices } = require('playwright');
const VP = process.argv[2] === 'mobile' ? devices['iPhone 13'] : { viewport: { width: 1280, height: 800 } };
const tag = process.argv[2] || 'desk';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(VP);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errs.push('CONSOLE ' + m.text()); });
  await p.route(/gis\.sinica|nlsc|openstreetmap|fonts\.g|wikimedia/, r => {
    const u = r.request().url();
    if (u.includes('fonts')) return r.fulfill({ status: 200, body: '' });
    const c = u.includes('sinica') ? '#c8a36a' : u.includes('wikimedia') ? '#a88' : '#9fc7c0';
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${c}"/><path d="M0 0H256V256" stroke="#0003" fill="none"/></svg>` });
  });
  const tapLL = async (lat, lng, zoom) => {
    const xy = await p.evaluate(([lat, lng, zoom]) => { const m = window.__map; if (zoom) { m.setView([lat, lng], zoom, { animate: false }); m.panBy([80, 60], { animate: false }); } const cp = m.latLngToContainerPoint([lat, lng]); return [cp.x, cp.y]; }, [lat, lng, zoom]);
    const mb = await (await p.$('#map')).boundingBox();
    await p.waitForTimeout(250);
    if (tag === 'mobile') await p.touchscreen.tap(mb.x + xy[0], mb.y + xy[1]); else await p.mouse.click(mb.x + xy[0], mb.y + xy[1]);
    await p.waitForTimeout(250);
  };
  const center = async (file, filter) => p.evaluate(async ([file, filter]) => {
    const gj = await (await fetch(file)).json();
    return gj.features.filter(f => eval(filter)).map(f => { const L2 = window.L.geoJSON(f).getBounds().getCenter(); return [L2.lat, L2.lng, f.properties]; });
  }, [file, filter]);

  // 首頁
  await p.goto('http://localhost:8765/index.html');
  await p.waitForSelector('.toc .item');
  await p.screenshot({ path: `${tag}_home.png`, fullPage: tag !== 'mobile' });
  console.log('level2 locked?', await p.evaluate(() => document.querySelectorAll('.toc .item')[1].classList.contains('lock')));
  // 直接開第二關（應被擋）
  await p.goto('http://localhost:8765/level2.html'); await p.waitForSelector('.modal h2');
  console.log('L2 locked modal:', await p.textContent('.modal h2'));

  // 第一關
  await p.goto('http://localhost:8765/level1.html'); await p.waitForSelector('.modal');
  await p.click('.modal .btn-primary'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${tag}_l1.png` });
  // 手機：拖動分隔線
  if (tag === 'mobile') {
    const h = await (await p.$('.swipe-handle')).boundingBox();
    await p.dispatchEvent('.swipe-handle', 'pointerdown', { pointerId: 1, clientX: h.x + 26, clientY: h.y + 26, isPrimary: true });
    await p.dispatchEvent('.swipe-handle', 'pointermove', { pointerId: 1, clientX: h.x - 80, clientY: h.y + 26, isPrimary: true });
    await p.dispatchEvent('.swipe-handle', 'pointerup', { pointerId: 1, clientX: h.x - 80, clientY: h.y + 26, isPrimary: true });
    console.log('mobile clip', await p.evaluate(() => document.querySelector('.leaflet-swipeLeft-pane').style.clip));
    await p.click('.panel .handle'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${tag}_l1_panel.png` });
    await p.click('.panel .handle'); await p.waitForTimeout(400);
  }
  const t1 = (await center('data/gis/level1/level1_targets.geojson', 'true')).sort((a, b) => a[2].order - b[2].order);
  for (const [lat, lng] of t1) {
    await tapLL(lat, lng, 15);
    await p.waitForSelector('.modal .btn-primary');
    await p.click('.modal .btn-primary'); await p.waitForTimeout(300);
  }
  await p.waitForSelector('.modal'); console.log('L1 end:', (await p.textContent('.modal h2')));
  await p.goto('http://localhost:8765/level2.html'); await p.waitForSelector('.modal');
  await p.click('.modal .btn:nth-child(2)'); // 普通
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${tag}_l2.png` });
  const quests = (await p.evaluate(async () => (await (await fetch('data/game/level2.json')).json()).quests));
  const bs = await center('data/gis/level2/level2_buildings.geojson', 'true');
  // 先點錯一次
  const wrongB = bs.find(x => x[2].building_id !== quests[0]);
  await tapLL(wrongB[0], wrongB[1], 16);
  console.log('L2 wrong feedback:', await p.textContent('#feedback'));
  for (const q of quests) {
    const [lat, lng] = bs.find(x => x[2].building_id === q);
    await tapLL(lat, lng, 16);
    await p.waitForSelector('.modal .btn-primary');
    if (q === quests[0]) await p.screenshot({ path: `${tag}_l2_card.png` });
    await p.click('.modal .btn-primary'); await p.waitForTimeout(300);
  }
  await p.waitForSelector('.modal'); console.log('L2 end:', (await p.textContent('.modal h2')));

  // 第三關
  await p.goto('http://localhost:8765/level3.html'); await p.waitForSelector('.modal');
  await p.click('.modal .btn-primary'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${tag}_l3.png` });
  if (tag === 'mobile') { await p.click('.panel .handle'); await p.waitForTimeout(400); }
  // Q1 先答錯
  await p.click('#choices button[data-t="農業用地"]');
  console.log('Q1 wrong:', await p.textContent('#feedback'));
  await p.click('#choices button[data-t="建成區"]');
  console.log('Q1 right:', await p.textContent('#feedback'));
  await p.screenshot({ path: `${tag}_l3_q1.png` });
  await p.click('#btn-next');
  await p.click('#choices button[data-t="農業用地"]');
  console.log('Q2:', await p.textContent('#feedback'));
  await p.click('#btn-next');
  if (tag === 'mobile') { await p.click('.panel .handle'); await p.waitForTimeout(400); }
  const ch = await center('data/gis/level3/landuse_change.geojson', 'true');
  const agri = ch.find(x => x[2].from_type === '農業用地' && x[2].to_type !== '農業用地');
  const same = ch.find(x => x[2].from_type === x[2].to_type);
  await p.evaluate(() => window.__map.setZoom(15, { animate: false }));
  await tapLL(same[0], same[1]); console.log('Q3 wrong:', await p.textContent('#feedback'));
  await tapLL(agri[0], agri[1]); console.log('Q3 right:', await p.textContent('#feedback'));
  await p.screenshot({ path: `${tag}_l3_q3.png` });
  await p.click('#btn-next');
  if (tag === 'mobile') { await p.evaluate(() => document.getElementById('panel').classList.remove('open')); await p.waitForTimeout(400); }
  await tapLL(same[0], same[1]); console.log('Q4:', await p.textContent('#feedback'));
  await p.click('#btn-next');
  await p.waitForSelector('.modal'); console.log('L3 end:', (await p.textContent('.modal h2')));

  await p.goto('http://localhost:8765/finale.html'); await p.waitForSelector('canvas');
  await p.waitForTimeout(500);
  await p.fill('#name', '測試員');
  await p.screenshot({ path: `${tag}_finale.png`, fullPage: true });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dl')]);
  console.log('download:', dl.suggestedFilename());
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.toc .item');
  await p.screenshot({ path: `${tag}_home_done.png`, fullPage: tag !== 'mobile' });
  console.log('storage', await p.evaluate(() => localStorage.getItem('dalin-timefiles-v1')));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
