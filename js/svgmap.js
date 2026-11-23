/* 把組員的 GeoJSON（鐵路、鎮界、據點）畫成一張靜態 SVG，用在首頁封面與通關畫面。
   換資料只要換 data/gis/context/ 的檔案，不用改這裡。 */
(function () {
  'use strict';
  const EXT = { lon0: 120.38, lon1: 120.54, lat0: 23.55, lat1: 23.68 };
  function render(rail, boundary, places, opts = {}) {
    const W = 1000, e = Object.assign({}, EXT, opts.extent || {});
    const H = Math.round(W * ((e.lat1 - e.lat0) * 110574) / ((e.lon1 - e.lon0) * 101900));
    const X = lon => ((lon - e.lon0) / (e.lon1 - e.lon0) * W).toFixed(1);
    const Y = lat => ((e.lat1 - lat) / (e.lat1 - e.lat0) * H).toFixed(1);
    const line = cs => 'M' + cs.map(c => X(c[0]) + ' ' + Y(c[1])).join('L');
    let g = '';
    for (let lon = Math.ceil(e.lon0 / .02) * .02; lon < e.lon1; lon += .02)
      g += `<line class="grid" x1="${X(lon)}" y1="0" x2="${X(lon)}" y2="${H}"/><text class="tick" x="${+X(lon) + 4}" y="${H - 6}">${lon.toFixed(2)}°E</text>`;
    for (let lat = Math.ceil(e.lat0 / .02) * .02; lat < e.lat1; lat += .02)
      g += `<line class="grid" x1="0" y1="${Y(lat)}" x2="${W}" y2="${Y(lat)}"/><text class="tick" x="4" y="${Y(lat) - 4}">${lat.toFixed(2)}°N</text>`;
    const polys = f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const b = boundary.features.map(f => polys(f).map(p => p.map(r => line(r) + 'Z').join('')).join('')).join('');
    const r = rail.features.map(f => {
      const cls = f.properties.layer === '1939鐵路' ? 'r1939' : f.properties.layer === '1953鐵路' ? 'r1953' : 'r1953b';
      const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      return `<path class="rail ${cls}" d="${parts.map(line).join('')}"/>`;
    }).join('');
    const pts = places.features.map(f => {
      const [lon, lat] = f.geometry.coordinates, x = +X(lon), y = +Y(lat);
      const isFac = /糖廠/.test(f.properties.name);
      const short = f.properties.name.replace('臺鐵', '').replace(/站$/, '車站');
      return isFac
        ? `<g class="pt fac"><circle cx="${x}" cy="${y}" r="9"/><text class="lbl" x="${x + 16}" y="${y + 7}">${short}</text></g>`
        : `<g class="pt sta"><rect x="${x - 5}" y="${y - 5}" width="10" height="10"/><text class="lbl" x="${x + 16}" y="${y + 20}">${short}</text></g>`;
    }).join('');
    return `<svg class="dmap" viewBox="0 0 ${W} ${H}" preserveAspectRatio="${opts.fit || 'xMidYMid slice'}" role="img" aria-label="大林周邊 1939、1953 年鐵路與大林鎮界（組員依歷史地圖數化）"><g>${g}</g><path class="bound" d="${b}"/><g>${r}</g>${pts}</svg>`;
  }
  async function load() {
    const [rail, boundary, places] = await Promise.all([
      Game.loadJSON('data/gis/context/rail_1939_1953.geojson'),
      Game.loadJSON('data/gis/context/dalin_boundary.geojson'),
      Game.loadJSON('data/gis/context/places.geojson')]);
    return { rail, boundary, places };
  }
  window.GameSVGMap = { render, load };
})();
