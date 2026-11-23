// 檢查 data/gis 底下的 GeoJSON 欄位是否齊全（從 QGIS 匯出新資料後執行）。
// 用法：在 game/ 資料夾執行  node tools/validate_data.mjs
import { readFileSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/^﻿/, ''));
let errors = 0, warns = 0;
const err = m => { errors++; console.log('✗ 錯誤：' + m); };
const warn = m => { warns++; console.log('△ 提醒：' + m); };

function check(file, required, geomTypes, idField) {
  let fc;
  try { fc = read(file); } catch (e) { return err(`${file} 讀不到或不是合法 JSON（${e.message}）`); }
  if (fc.crs && !/CRS84|4326/.test(JSON.stringify(fc.crs))) err(`${file} 座標系統不是 WGS84（EPSG:4326），請在 QGIS 匯出時選 EPSG:4326`);
  const ids = new Set();
  let demo = 0;
  fc.features.forEach((f, i) => {
    const p = f.properties || {}, name = `${file} 第 ${i + 1} 筆（${p[idField] ?? '無 id'}）`;
    for (const k of required) if (!(k in p)) err(`${name} 缺少欄位 ${k}`);
    if (!f.geometry) err(`${name} 沒有幾何`);
    else if (!geomTypes.includes(f.geometry.type)) err(`${name} 幾何類型 ${f.geometry.type}，應為 ${geomTypes.join('/')}`);
    else {
      const c = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.?\d*/g).map(Number);
      const lon = c.filter((_, j) => j % 2 === 0), lat = c.filter((_, j) => j % 2 === 1);
      if (Math.min(...lon) < 119 || Math.max(...lon) > 123 || Math.min(...lat) < 21 || Math.max(...lat) > 26)
        err(`${name} 座標不在台灣範圍，可能是 TWD97（EPSG:3826）沒有轉成 WGS84`);
    }
    if (ids.has(p[idField])) err(`${name} 的 ${idField} 重複`);
    ids.add(p[idField]);
    if (String(p.confidence || '').startsWith('DEMO') || p.is_demo === true || p.source_id === 'DEMO') demo++;
  });
  if (demo) warn(`${file} 有 ${demo} 筆仍是示範資料（DEMO）`);
  console.log(`✓ ${file}：${fc.features.length} 筆`);
  return fc;
}

check('data/gis/level1/level1_targets.geojson',
  ['task_id', 'title', 'description', 'historical_year', 'comparison_year', 'historical_description', 'evidence_source', 'confidence', 'hint', 'points', 'left_basemap', 'right_basemap'],
  ['Polygon', 'MultiPolygon'], 'task_id');
const b = check('data/gis/level2/level2_buildings.geojson',
  ['building_id', 'name', 'historical_use', 'current_use', 'first_observed_year', 'construction_year', 'current_status', 'historical_description', 'historical_photo', 'current_photo', 'source', 'confidence', 'public_access'],
  ['Point', 'Polygon', 'MultiPolygon'], 'building_id');
if (b) b.features.forEach(f => {
  const p = f.properties;
  if (p.construction_year != null && !/文獻|xlsx|大事紀|來源|紀錄|誌/.test((p.construction_year_note || '') + p.source))
    warn(`${p.building_id} 有 construction_year 但 construction_year_note／source 沒寫文獻依據；沒有可靠證據請留空（null）`);
});
for (const k of ['A', 'B']) check(`data/gis/level3/landuse_${k}.geojson`, ['feature_id', 'year', 'landuse_type', 'area_m2', 'source_id', 'confidence'], ['Polygon', 'MultiPolygon'], 'feature_id');
check('data/gis/level3/landuse_change.geojson', ['from_year', 'to_year', 'from_type', 'to_type', 'area_m2'], ['Polygon', 'MultiPolygon'], 'change_id');

const l2 = read('data/game/level2.json');
const bid = new Set(b ? b.features.map(f => f.properties.building_id) : []);
l2.quests.forEach(q => { if (!bid.has(q)) err(`level2.json 的 quests 有 ${q}，但建築圖層找不到這個 building_id`); });
const bm = read('data/config/basemaps.json').basemaps;
read('data/gis/level1/level1_targets.geojson').features.forEach(f => {
  for (const k of ['left_basemap', 'right_basemap']) if (!bm[f.properties[k]]) err(`${f.properties.task_id} 的 ${k}「${f.properties[k]}」不在 basemaps.json`);
});
const tr = readFileSync(new URL('../data/gis/level3/landuse_transitions.csv', import.meta.url), 'utf8');
if (!/^﻿?from_year,to_year,from_type,to_type,area_m2/.test(tr)) err('landuse_transitions.csv 第一行應為 from_year,to_year,from_type,to_type,area_m2');
console.log(`\n完成：${errors} 個錯誤、${warns} 個提醒`);
process.exit(errors ? 1 : 0);
