// 產生「示範資料（DEMO）」的 GeoJSON 與統計檔。
// 用法：在 game/ 資料夾執行  node tools/make_demo_data.mjs
// 注意：這支程式只產生示範資料，讓遊戲在真實 QGIS 成果完成前可以操作。
// 正式資料請用 QGIS 匯出，覆蓋 data/gis/ 底下同名檔案（欄位規格見 docs/QGIS資料規格.md）。
// 已經有正式資料時，不要再執行這支程式，否則會被覆寫。
import { writeFileSync } from 'node:fs';

// 大林糖廠點位（來源：1939糖廠.shp，見 zip擷取_大林/大林周邊_據點.csv）
const F = [120.4560635, 23.6122451];
const STATION = [120.455844, 23.601096];
const M_LAT = 1 / 110574;
const M_LON = 1 / (111320 * Math.cos((F[1] * Math.PI) / 180));
const off = ([lon, lat], east, north) => [+(lon + east * M_LON).toFixed(7), +(lat + north * M_LAT).toFixed(7)];
const circle = (c, r, n = 32) => {
  const ring = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; ring.push(off(c, r * Math.cos(a), r * Math.sin(a))); }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
};
const rect = (c, w, h) => {
  const a = off(c, -w / 2, -h / 2), b = off(c, w / 2, h / 2);
  return { type: 'Polygon', coordinates: [[[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]]] };
};
// 平面近似面積（研究範圍小於 2 公里，誤差可忽略；正式資料請用 QGIS 以 EPSG:3826 計算）
const areaM2 = (geom) => {
  const ring = geom.coordinates[0];
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [ring[i][0] / M_LON, ring[i][1] / M_LAT];
    const [x2, y2] = [ring[i + 1][0] / M_LON, ring[i + 1][1] / M_LAT];
    s += x1 * y2 - x2 * y1;
  }
  return Math.round(Math.abs(s) / 2);
};
const fc = (name, features) => ({ type: 'FeatureCollection', name, features });
const save = (p, obj) => { writeFileSync(new URL('../' + p, import.meta.url), JSON.stringify(obj, null, 1)); console.log('寫入', p); };

// ---------- 第一關：任務目標面 ----------
const solarCenter = off(F, 200, -250);
const l1 = fc('level1_targets', [
  {
    type: 'Feature',
    properties: {
      task_id: 'L1-T1', order: 1, task_type: 'C', is_demo: false,
      title: '百年前的煙囪在哪裡？',
      description: '線索：1913 年，新高製糖在大莆林完成第一座製糖工場，壓榨能力 1200 公噸。請在左側的 1921 年堡圖上找出這座糖廠的位置，然後在地圖上點一下。',
      left_basemap: 'JM20K_1921', right_basemap: 'EMAP',
      historical_year: 1921, comparison_year: 2025,
      historical_description: '你找到的是大林糖廠舊址。1909 年新高製糖會社選定大林設廠，1913 年第一工場完成，1935 年改名「大林製糖所」，1995 年 7 月 1 日製糖工場停閉。現代地圖上同一個位置，仍標示為台糖大林糖廠區。',
      evidence_source: '點位：1939糖廠.shp（組員原始資料）；沿革：台灣糖業公司各糖廠歷史.xlsx、台糖大事紀（sn=246）、台灣製糖工場百年文史地圖（map.net.tw，僅連結）',
      confidence: '中：點位為糖廠代表點，目標範圍為半徑 350 公尺緩衝區，尚未依 1921 堡圖數化實際廠區範圍',
      hint: '從臺鐵大林車站往北約 1.1 公里。看看老地圖上有沒有一大片整齊的廠房區塊。',
      hint2_zoom: true, points: 40
    },
    geometry: circle(F, 350)
  },
  {
    type: 'Feature',
    properties: {
      task_id: 'L1-T2', order: 2, task_type: 'A', is_demo: true,
      title: '從甘蔗到太陽',
      description: '線索：台糖大事紀記載，2018 年 3 月 20 日，台糖在大林糖廠的土地上動土設置太陽能發電廠。請比較 1966 年 Corona 衛星影像與現代正射影像，找出用途改變成太陽能發電的地方。',
      left_basemap: 'Taiwan_Corona_1966', right_basemap: 'PHOTO2',
      historical_year: 1966, comparison_year: 2025,
      historical_description: '2018 年台糖在大林糖廠動土設置太陽能發電廠，這是糖廠土地從「製糖」轉為「發電」的例子。（【DEMO】本題的目標範圍是示範位置，尚未依正射影像數化，可能與實際太陽能板的位置不同。）',
      evidence_source: '事件：台糖大事紀 sn=356（2018-03-20）；目標範圍：示範資料',
      confidence: 'DEMO：事件已查證，位置未查證',
      hint: '在現代正射影像上，太陽能板通常是一大片深藍或深灰、排列很整齊的長方形。',
      hint2_zoom: true, points: 30
    },
    geometry: rect(solarCenter, 220, 160)
  },
  {
    type: 'Feature',
    properties: {
      task_id: 'L1-T3', order: 3, task_type: 'B', is_demo: true,
      title: '消失的鐵道彎',
      description: '【示範任務】組員數化的 1939 年鐵路圖層（棕色虛線）在糖廠北邊轉了一個大彎。請找出這段彎道，並觀察現代地圖上它是否還在。',
      left_basemap: 'PAPER', right_basemap: 'EMAP', show_rail: true,
      historical_year: 1939, comparison_year: 2025,
      historical_description: '【DEMO】這段彎道出現在 1939 年的鐵路圖層上。原始圖層沒有屬性，無法分辨是臺鐵還是糖業鐵道，現代是否還存在也尚未查證。等組員用 1953 年臺糖鐵道網圖確認後，再改寫這段說明。',
      evidence_source: '1939鐵路.shp（src_id 15，組員數化）；變化：未查證',
      confidence: 'DEMO：線形來自組員圖層，變化尚未查證',
      hint: '打開「1939／1953 鐵路」圖層，沿著棕色虛線往糖廠北邊找彎道。',
      hint2_zoom: true, points: 30
    },
    geometry: rect(off(F, 300, 1450), 520, 420)
  }
]);
save('data/gis/level1/level1_targets.geojson', l1);

// ---------- 第二關：建築與景點 ----------
const b = (id, props, geometry) => ({ type: 'Feature', properties: { building_id: id, ...props }, geometry });
const l2 = fc('level2_buildings', [
  b('B01', {
    name: '大林糖廠（製糖工場舊址）', is_demo: false,
    historical_use: '製糖工場（甘蔗壓榨、製糖）',
    current_use: '台糖大林糖廠廠區；2018 年在廠區動土設置太陽能發電廠',
    first_observed_year: null, construction_year: 1913,
    construction_year_note: '1913 年第一工場完成（台灣糖業公司各糖廠歷史.xlsx、map.net.tw 沿革）。最早出現在哪一張歷史圖資尚未比對。',
    current_status: '1995 年 7 月 1 日製糖工場停閉',
    historical_description: '1909 年新高製糖會社選定大林設廠，1913 年第一工場完成，1926 年由大日本製糖收購，1935 年改名「大林製糖所」。戰後屬台糖，1974 年產製耕地白糖，被稱為遠東第一座此類糖廠；1995 年停止製糖。',
    historical_photo: '', historical_photo_credit: '',
    current_photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Dalin_Sugar_Factory_D8958.jpg/500px-Dalin_Sugar_Factory_D8958.jpg',
    current_photo_credit: 'Wikimedia Commons：Dalin Sugar Factory D8958.jpg（授權請至檔案頁確認，拍攝年份未記錄）',
    source: '1939糖廠.shp；台灣糖業公司各糖廠歷史.xlsx；台糖大事紀 sn=194、246',
    confidence: '高：沿革有文獻；點位為代表點',
    public_access: '待確認（請實地或向台糖確認開放情形）',
    clue_easy: '找出照片中的這座糖廠：大林糖廠。',
    clue_normal: '它在 1913 年完成第一座工場，1995 年停止製糖。位置在大林車站的北邊。',
    clue_hard: '過去：壓榨甘蔗。位置：大林車站北方約 1 公里。',
    card_title: '百年製糖工場', card_rarity: 'SSR'
  }, { type: 'Point', coordinates: F }),
  b('B02', {
    name: '台糖大林太陽能發電廠', is_demo: true,
    historical_use: '糖廠土地（過去細部用途未查證）',
    current_use: '太陽能發電',
    first_observed_year: null, construction_year: 2018,
    construction_year_note: '2018 年 3 月 20 日動土（台糖大事紀 sn=356）。完工年份未查證。',
    current_status: '用途已轉為發電（完工與營運狀態待查）',
    historical_description: '2018 年台糖在大林糖廠土地上動土設置太陽能發電廠。【DEMO】地圖上的範圍是示範位置，尚未依正射影像數化。',
    historical_photo: '', current_photo: 'assets/demo/demo_photo_solar.svg',
    current_photo_credit: '示範圖片（非真實照片）',
    source: '台糖大事紀 sn=356；位置：示範資料',
    confidence: 'DEMO：事件已查證，位置未查證',
    public_access: '待確認',
    clue_easy: '找出：台糖大林太陽能發電廠。',
    clue_normal: '2018 年，糖廠的一部分土地開始「種太陽」。它在糖廠點位的東南方。',
    clue_hard: '過去：糖廠土地。現在：發電。',
    card_title: '種太陽的糖廠', card_rarity: 'R'
  }, rect(solarCenter, 220, 160)),
  b('B03', {
    name: '臺鐵大林車站', is_demo: false,
    historical_use: '鐵路車站',
    current_use: '鐵路車站（營運中）',
    first_observed_year: null, construction_year: null,
    construction_year_note: '設站年份尚未查證，請組員補上文獻來源後再填。',
    current_status: '營運中',
    historical_description: '位於嘉義縣大林鎮中山路 2 號，距離糖廠點位直線約 1.1 公里。車站和糖廠之間的運輸關係，有待組員從文獻補充。',
    historical_photo: '', current_photo: '',
    source: 'MARK_臺鐵車站_1140206.shp',
    confidence: '高：點位與地址；歷史內容待補',
    public_access: '開放（營運中車站）',
    clue_easy: '找出：臺鐵大林車站。',
    clue_normal: '從糖廠往南走大約 1.1 公里，搭火車的地方。',
    clue_hard: '過去與現在都是交通節點，位在縱貫線上。',
    card_title: '大林的出入口', card_rarity: 'R'
  }, { type: 'Point', coordinates: STATION }),
  b('B04', {
    name: '【DEMO】示範建築甲', is_demo: true,
    historical_use: '（示範）待組員查證後填入', current_use: '（示範）待填',
    first_observed_year: null, construction_year: null,
    construction_year_note: '示範資料，沒有興建年份。',
    current_status: '示範', historical_description: '這是測試用的示範點位，不是真實建築。請在 QGIS 數化真實建築後替換。',
    historical_photo: 'assets/demo/demo_photo_a.svg', current_photo: '',
    current_photo_credit: '示範圖片（非真實照片）',
    source: '示範資料', confidence: 'DEMO', public_access: '示範',
    clue_easy: '找出地圖上的「示範建築甲」。', clue_normal: '它在糖廠點位的西北方大約 150 公尺。', clue_hard: '示範',
    card_title: '示範收藏卡甲', card_rarity: 'N'
  }, { type: 'Point', coordinates: off(F, -120, 90) }),
  b('B05', {
    name: '【DEMO】示範建築乙', is_demo: true,
    historical_use: '（示範）待組員查證後填入', current_use: '（示範）待填',
    first_observed_year: null, construction_year: null,
    construction_year_note: '示範資料，沒有興建年份。',
    current_status: '示範', historical_description: '這是測試用的示範點位，不是真實建築。請在 QGIS 數化真實建築後替換。',
    historical_photo: 'assets/demo/demo_photo_b.svg', current_photo: '',
    current_photo_credit: '示範圖片（非真實照片）',
    source: '示範資料', confidence: 'DEMO', public_access: '示範',
    clue_easy: '找出地圖上的「示範建築乙」。', clue_normal: '它在糖廠點位的東北方大約 200 公尺。', clue_hard: '示範',
    card_title: '示範收藏卡乙', card_rarity: 'N'
  }, { type: 'Point', coordinates: off(F, 150, 150) })
]);
save('data/gis/level2/level2_buildings.geojson', l2);

// ---------- 第三關：土地利用（示範格網） ----------
// 7 x 5 格、每格 250 m。分類是人工編排的示範圖樣，不代表真實土地利用。
const A = [ // 年代 A（DEMO）；列由北到南
  'AAAAAAA',
  'AAIIIAA',
  'AAIIIAG',
  'UUAIAAG',
  'UUAAAAG'
];
const B = [ // 年代 B（DEMO）
  'AUAAAUA',
  'AAIIIAA',
  'AAIIEEG',
  'UUUIEEG',
  'UUUUAAG'
];
const TYPES = { A: '農業用地', I: '糖業工業用地', U: '建成區', G: '綠地水域', E: '能源設施' };
const cell = 250, cols = 7, rows = 5;
const nw = off(F, -(cols * cell) / 2, (rows * cell) / 2);
const yearA = 1966, yearB = 2025;
const fa = [], fb = [], fch = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const p0 = off(nw, c * cell, -r * cell), p1 = off(nw, (c + 1) * cell, -(r + 1) * cell);
  const geom = { type: 'Polygon', coordinates: [[[p0[0], p0[1]], [p1[0], p0[1]], [p1[0], p1[1]], [p0[0], p1[1]], [p0[0], p0[1]]]] };
  const id = `R${r + 1}C${c + 1}`;
  const area = areaM2(geom);
  const ta = TYPES[A[r][c]], tb = TYPES[B[r][c]];
  fa.push({ type: 'Feature', properties: { feature_id: `A-${id}`, year: yearA, landuse_type: ta, area_m2: area, source_id: 'DEMO', confidence: 'DEMO' }, geometry: geom });
  fb.push({ type: 'Feature', properties: { feature_id: `B-${id}`, year: yearB, landuse_type: tb, area_m2: area, source_id: 'DEMO', confidence: 'DEMO' }, geometry: geom });
  fch.push({ type: 'Feature', properties: { change_id: `C-${id}`, from_year: yearA, to_year: yearB, from_type: ta, to_type: tb, changed: ta !== tb, area_m2: area, source_id: 'DEMO' }, geometry: geom });
}
save('data/gis/level3/landuse_A.geojson', fc('landuse_A', fa));
save('data/gis/level3/landuse_B.geojson', fc('landuse_B', fb));
save('data/gis/level3/landuse_change.geojson', fc('landuse_change', fch));
// 轉換統計表（等同 QGIS「交集」後依 from_type、to_type 分組加總）
const tr = {};
for (const f of fch) { const k = f.properties.from_type + '→' + f.properties.to_type; tr[k] = (tr[k] || 0) + f.properties.area_m2; }
const rowsOut = ['from_year,to_year,from_type,to_type,area_m2'];
for (const [k, v] of Object.entries(tr)) { const [a, bb] = k.split('→'); rowsOut.push(`${yearA},${yearB},${a},${bb},${v}`); }
writeFileSync(new URL('../data/gis/level3/landuse_transitions.csv', import.meta.url), rowsOut.join('\n') + '\n');
console.log('寫入 data/gis/level3/landuse_transitions.csv');
