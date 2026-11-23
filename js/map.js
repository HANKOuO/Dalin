/* 共用地圖元件：建立 Leaflet 地圖、底圖、左右比較（swipe）、GeoJSON 載入與點落在面內的判斷。
   遊戲邏輯不寫在這裡，關卡程式只呼叫這些函式。 */
(function () {
  'use strict';
  let BASEMAPS = null;

  async function loadBasemaps() {
    if (!BASEMAPS) BASEMAPS = await Game.loadJSON('data/config/basemaps.json');
    return BASEMAPS;
  }

  function createMap(el, cfg, opts = {}) {
    const map = L.map(el, Object.assign({
      center: cfg.default_center, zoom: cfg.default_zoom,
      minZoom: 11, maxZoom: 19, zoomControl: true, tap: true, attributionControl: true
    }, opts));
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    map.getContainer().style.background = '#efe3c8';
    window.__map = map; // 方便除錯與自動測試
    return map;
  }

  /** 依 basemaps.json 的 id 建立圖磚圖層；PAPER（無影像）回傳 null */
  function baseLayer(id, pane) {
    const c = BASEMAPS.basemaps[id];
    if (!c) throw new Error('basemaps.json 找不到底圖 id：' + id);
    if (!c.url) return null;
    const layer = L.tileLayer(c.url, {
      pane: pane || 'tilePane', maxZoom: c.maxZoom || 19, maxNativeZoom: c.maxNativeZoom || 18,
      attribution: c.attribution,
      crossOrigin: false
    });
    layer._gameId = id;
    return layer;
  }
  const basemapName = id => (BASEMAPS.basemaps[id] || {}).name || id;

  /** 偵測底圖載入失敗（例如沒有網路或服務暫停），在地圖上提示 */
  function watchTiles(map, layer) {
    if (!layer) return;
    let bad = 0, good = 0;
    const wrap = map.getContainer().parentElement;
    layer.on('tileerror', () => {
      bad++;
      if (bad >= 4 && good === 0 && !wrap.querySelector('.tile-warning')) {
        const w = document.createElement('div');
        w.className = 'tile-warning';
        w.innerHTML = `「${Game.esc(basemapName(layer._gameId))}」底圖暫時無法載入（可能是網路或圖資服務問題）。遊戲仍可進行，也可以在任務面板換一張底圖。`;
        wrap.appendChild(w);
        setTimeout(() => w.remove(), 9000);
      }
    });
    layer.on('tileload', () => { good++; });
  }

  /** 左右比較控制項：左側圖層只顯示在分隔線左邊，右側圖層顯示在右邊。
      作法與 leaflet-side-by-side 外掛相同（用 CSS clip 裁切圖層所在的 pane），
      但改寫為不需打包工具、支援觸控拖曳的版本。同一張地圖，所以移動與縮放天然同步。 */
  class Swipe {
    constructor(map) {
      this.map = map;
      this.ratio = 0.5;
      this.leftPane = map.createPane('swipeLeft');
      this.rightPane = map.createPane('swipeRight');
      this.leftPane.style.zIndex = 210;
      this.rightPane.style.zIndex = 200;
      // 左側也可以放向量圖層（例如歷史鐵路），一樣會被裁切
      this.leftVecPane = map.createPane('swipeLeftVector');
      this.leftVecPane.style.zIndex = 420;
      const c = map.getContainer();
      this.divider = L.DomUtil.create('div', 'swipe-divider', c);
      this.handle = L.DomUtil.create('div', 'swipe-handle', this.divider);
      this.handle.innerHTML = '◀▶';
      this.handle.setAttribute('role', 'slider');
      this.handle.setAttribute('aria-label', '拖動比較兩個年代');
      this.handle.tabIndex = 0;
      this.labelL = L.DomUtil.create('div', 'swipe-label left', c);
      this.labelR = L.DomUtil.create('div', 'swipe-label right', c);
      L.DomEvent.disableClickPropagation(this.handle);
      this._bindDrag();
      map.on('move zoom zoomend resize viewreset', this._update, this);
      this._update();
    }
    _bindDrag() {
      const h = this.handle, map = this.map;
      let dragging = false;
      const move = e => {
        if (!dragging) return;
        const rect = map.getContainer().getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        this.ratio = Math.min(0.98, Math.max(0.02, x));
        this._update();
        e.preventDefault();
      };
      h.addEventListener('pointerdown', e => {
        dragging = true; h.setPointerCapture(e.pointerId);
        map.dragging.disable(); e.preventDefault(); e.stopPropagation();
      });
      h.addEventListener('pointermove', move);
      const up = e => { if (!dragging) return; dragging = false; map.dragging.enable(); try { h.releasePointerCapture(e.pointerId); } catch (_) {} };
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
      h.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { this.ratio = Math.max(0.02, this.ratio - 0.05); this._update(); }
        if (e.key === 'ArrowRight') { this.ratio = Math.min(0.98, this.ratio + 0.05); this._update(); }
      });
    }
    _update() {
      const map = this.map, size = map.getSize();
      const x = size.x * this.ratio;
      this.divider.style.left = x + 'px';
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      const clipX = nw.x + x;
      this.leftPane.style.clip = `rect(${nw.y}px, ${clipX}px, ${se.y}px, ${nw.x}px)`;
      this.leftVecPane.style.clip = this.leftPane.style.clip;
      this.rightPane.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`;
    }
    /** 換左右底圖（傳 basemaps.json 的 id） */
    setBasemaps(leftId, rightId) {
      [this.left, this.right].forEach(l => l && this.map.removeLayer(l));
      this.left = baseLayer(leftId, 'swipeLeft');
      this.right = baseLayer(rightId, 'swipeRight');
      // PAPER：左側不放影像，直接露出地圖容器的老紙底色
      if (this.left) { this.left.addTo(this.map); watchTiles(this.map, this.left); }
      if (this.right) { this.right.addTo(this.map); watchTiles(this.map, this.right); }
      this.leftId = leftId; this.rightId = rightId;
      const lab = id => `<b>${Game.esc((BASEMAPS.basemaps[id] || {}).year_label || '')}</b>${Game.esc(basemapName(id))}`;
      this.labelL.innerHTML = lab(leftId);
      this.labelR.innerHTML = lab(rightId);
      this._update();
    }
  }

  // ---------- 幾何判斷 ----------
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inPolygon(x, y, rings) {
    if (!inRing(x, y, rings[0])) return false;
    for (let k = 1; k < rings.length; k++) if (inRing(x, y, rings[k])) return false; // 洞
    return true;
  }
  /** 判斷 latlng 是否落在 GeoJSON Feature（Polygon / MultiPolygon）內 */
  function pointInFeature(latlng, feature) {
    const g = feature.geometry || feature;
    const x = latlng.lng, y = latlng.lat;
    if (g.type === 'Polygon') return inPolygon(x, y, g.coordinates);
    if (g.type === 'MultiPolygon') return g.coordinates.some(p => inPolygon(x, y, p));
    return false;
  }
  /** 面的大致中心（邊界框中心），用來估算距離 */
  function featureCenter(feature) {
    return L.geoJSON(feature).getBounds().getCenter();
  }

  window.GameMap = { loadBasemaps, createMap, baseLayer, basemapName, watchTiles, Swipe, pointInFeature, featureCenter, get config() { return BASEMAPS; } };
})();
