# 大林糖廠：失落的時光檔案（網頁闖關遊戲 MVP）

《大林糖廠歷史空間變遷分析與遊戲化互動展示》的網頁遊戲。玩家扮演時光調查員，操作歷史地圖、尋找建築、分析土地利用，找回三份時光檔案。

> **資料真實性**：畫面上標示 **DEMO** 的點位、範圍、照片與土地利用分類都是示範資料，只用來測試玩法，不是大林糖廠的真實歷史。換上 QGIS 正式資料的方法見 `docs/QGIS資料規格.md`。

---

## 1. 技術架構

| 層 | 技術 | 為什麼 |
|---|---|---|
| 地圖 | Leaflet 1.9.4（已放在 `vendor/`，不靠 CDN） | 免費、輕量、手機觸控好 |
| 介面與邏輯 | 純 HTML、CSS、JavaScript（不用 React、不用打包工具） | 學生改檔案存檔就生效，GitHub Pages 直接部署 |
| 空間資料 | GeoJSON（從 QGIS／GeoPackage 匯出） | Leaflet 直接讀；QGIS 一鍵匯出 |
| 題庫與故事 | JSON | 改文字不用碰程式 |
| 進度 | 瀏覽器 localStorage | 不需要後端或帳號 |
| 部署 | GitHub Pages | 免費、靜態網站 |

**資料、邏輯、介面分開**：

```
data/        ← 只放資料（QGIS 匯出的 GeoJSON、JSON 題庫）。換資料不用改程式
js/core.js   ← 共用遊戲系統：分數、進度儲存、碎片、收藏卡、對話框
js/map.js    ← 共用地圖元件：底圖、左右比較、GeoJSON、點是否落在面內
js/level1~3.js、home.js、finale.js ← 各頁面的遊戲流程
css/style.css ← 介面樣式（復古糖廠配色、手機版面）
```

### 關於 Leaflet 左右比較外掛的評估
需求是「同一位置的歷史圖與現代圖，左右拖曳比較、同步移動縮放」。常用外掛 **leaflet-side-by-side 2.2.0**（MIT）的作法是：在同一張地圖上，用 CSS `clip` 裁切左右兩個圖層，所以移動、縮放天然同步，觸控也可用，功能上符合。但它：
- 只發佈 CommonJS 原始碼（`require('leaflet')`），沒有可直接用 `<script>` 載入的版本，要另外打包；
- 2020 年後沒有維護，只裁切圖磚，不方便把「歷史鐵路」等向量圖層放在左側。

所以本專案在 `js/map.js` 的 `Swipe` 類別用**同樣原理**重寫約 80 行：一張地圖、兩個 pane 裁切，支援滑鼠、觸控與鍵盤（← →），並多一個左側向量 pane。另一個選項是兩張地圖同步（leaflet.sync），但兩張地圖會各載一次圖磚，手機效能較差，所以不採用。

---

## 2. 資料夾結構

```
game/
├─ index.html            首頁（封面、目次、年表、建築收藏、閱讀方法、設定）
├─ level1.html           第一關：消失的地景（左右比較）
├─ level2.html           第二關：被遺忘的建築（建築解謎、收藏卡）
├─ level3.html           第三關：土地留下的秘密（土地利用變遷）
├─ finale.html           封底（總分、三份碎片、印章、摘要、可下載完成卡 PNG）
├─ css/style.css
├─ fonts/                自行託管的字體（思源宋體、思源黑體、霞鶩文楷，SIL OFL）
├─ js/  core.js  map.js  svgmap.js  home.js  level1.js  level2.js  level3.js  finale.js
├─ data/
│  ├─ config/basemaps.json         底圖清單（網址、出處、授權狀態）
│  ├─ game/story.json              遊戲名稱、故事、說明、通關文字
│  ├─ game/level1.json             第一關計分與 1959 航照說明
│  ├─ game/level2.json             第二關題目順序、難度模式
│  ├─ game/level3.json             第三關題目、分類顏色、碎片門檻
│  └─ gis/
│     ├─ context/                  組員的真實圖層：1939/1953 鐵路、大林鎮界、糖廠與車站點位
│     ├─ level1/level1_targets.geojson     第一關任務目標面
│     ├─ level2/level2_buildings.geojson   第二關建築與景點
│     └─ level3/landuse_A.geojson、landuse_B.geojson、landuse_change.geojson、landuse_transitions.csv
├─ assets/demo/          示範圖片（明確標示 DEMO）
├─ assets/photos/        （請自建）放正式歷史照片
├─ vendor/leaflet/       Leaflet 程式庫（BSD-2 授權）
├─ tools/make_demo_data.mjs   重新產生示範資料（有正式資料後不要再執行）
├─ tools/validate_data.mjs    檢查 GeoJSON 欄位、座標系統、id 是否正確
├─ tests/e2e_playwright.js    自動測試（電腦版與手機版走完三關）
├─ docs/QGIS資料規格.md        欄位規格與 QGIS 操作步驟
└─ docs/設計規範.md            視覺設計規範（色彩、字體、版面、元件、一定要做／不要做）
```

---

## 3. 在本機啟動

因為遊戲要讀 JSON／GeoJSON，**不能直接雙擊 HTML**（瀏覽器會擋），要開一個本機伺服器：

```bash
cd game
python -m http.server 8000        # Mac 可能要用 python3
```

用瀏覽器打開 `http://localhost:8000`。用 VS Code 的話，也可以裝「Live Server」外掛，對 `index.html` 按右鍵「Open with Live Server」。

手機測試：電腦與手機連同一個 Wi-Fi，手機打開 `http://電腦的IP:8000`。

---

## 4. 怎麼改

### 修改遊戲題目
| 想改什麼 | 改哪裡 |
|---|---|
| 遊戲名稱、故事、說明、通關文字 | `data/game/story.json` |
| 第一關任務文字、提示、配分、左右底圖 | 在 QGIS 開 `level1_targets` 改屬性後匯出；或直接用文字編輯器改 `data/gis/level1/level1_targets.geojson` 的 `properties` |
| 第一關扣分規則 | `data/game/level1.json` 的 `scoring` |
| 第二關要找哪些建築、順序 | `data/game/level2.json` 的 `quests`（填 building_id） |
| 第二關線索、故事、收藏卡文字 | `level2_buildings.geojson` 的 `clue_easy`、`clue_normal`、`historical_description`、`card_title` |
| 第三關題目、提示、分類顏色 | `data/game/level3.json` |

第三關的答案**不寫在任何檔案裡**：選擇題由兩期 `area_m2` 加總後自動算出；點選題依 `landuse_change` 的 `from_type`／`to_type` 判斷。題型 `kind` 可用：
- `choice_max_increase`：面積增加最多的類別
- `choice_max_decrease`：面積減少最多的類別
- `click_change`：點選符合條件的地塊，`match` 可寫 `{"from_type":"農業用地","to_type_not":"農業用地"}`、`{"same":true}`、`{"to_type":"能源設施"}` 等

改完後執行 `node tools/validate_data.mjs` 檢查（需安裝 Node.js；沒有 Node 也可以略過，直接開網頁測）。

### 替換地圖圖層
1. 依 `docs/QGIS資料規格.md` 在 QGIS 做好圖層，匯出 GeoJSON（**EPSG:4326**）。
2. 用**相同檔名**覆蓋 `data/gis/` 下的檔案，重新整理網頁即可。
3. 換底圖：在 `data/config/basemaps.json` 新增一筆（id、名稱、`{z}/{x}/{y}` 網址、出處），再把任務的 `left_basemap`／`right_basemap` 改成新 id。玩家也可以在第一關面板的「底圖與圖層」自己切換。

### 加入真實歷史照片
1. 確認授權（自己拍的、文獻允許、或取得書面同意）。**map.net.tw 的圖片不能轉載。**
2. 把照片縮到寬 800px 左右、存成 JPG，放到 `assets/photos/`（例如 `assets/photos/B01_1960.jpg`）。
3. 在 `level2_buildings.geojson` 該建築的 `historical_photo` 或 `current_photo` 填 `assets/photos/B01_1960.jpg`，並在 `historical_photo_credit` 寫出處與授權。
4. 也可以填外部圖片網址（例如 Wikimedia Commons 的檔案網址），但要在 credit 寫明作者與授權。

---

## 5. 部署到 GitHub Pages

1. 在 GitHub 建立新的公開 repository（例如 `dalin-timefiles`）。
2. 把 `game/` 資料夾**裡面的所有檔案**上傳到 repository 根目錄（網頁上「Add file → Upload files」拖進去即可；或用 git push）。
3. repository → **Settings → Pages** → Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾 `/ (root)` → Save。
4. 約 1–2 分鐘後，網址是 `https://你的帳號.github.io/dalin-timefiles/`。
5. 之後更新資料：直接在 GitHub 上傳新的 GeoJSON 覆蓋舊檔，Pages 會自動更新。

注意：GitHub Pages 的網址是公開的。**正式公開前，請先確認下面「授權」一節的底圖使用許可。**

---

## 6. 資料來源與授權（2026-11-23 查核）

| 來源 | 用在哪裡 | 查核結果 | 遊戲做法 |
|---|---|---|---|
| 中研院人社中心 GIS 專題中心 WMTS（`gis.sinica.edu.tw/tileserver/wmts`） | 1921 堡圖、1944 地形圖、1953 臺糖鐵道網圖、1966 Corona | 服務可連線；GetCapabilities 沒有授權條款或使用限制 | 即時讀取圖磚、不下載轉存，標示出處；**正式公開前請寫信詢問**（gis@gate.sinica.edu.tw） |
| 內政部國土測繪中心 WMTS（`wmts.nlsc.gov.tw/wmts`） | 現代電子地圖、正射影像 | 服務可連線；GetCapabilities 沒有授權文字（尚未查到國土測繪中心網站上的條款頁） | 即時讀取並標示出處；請到國土測繪中心網站確認使用規範 |
| OpenStreetMap | 現代底圖備案、第三關底圖 | ODbL，需標示 © OpenStreetMap contributors | 已標示 |
| 台灣製糖工場百年文史地圖（map.net.tw/taisugar） | 沿革文字參考；1959 國軍航照所在網站 | 版權宣告：非營利學術可瀏覽使用，但「未經同意禁止修改或轉載至其他網站」 | **不嵌入任何圖片**，只放連結；沿革文字已改寫並註明出處 |
| Wikimedia Commons：Dalin Sugar Factory D8958.jpg | 第二關大林糖廠現況照片 | 未逐張確認授權與作者 | 外連顯示；請到檔案頁確認授權，補上作者後再公開 |
| 組員 QGIS 圖層（1939 糖廠、1939/1953 鐵路、鄉鎮界、臺鐵車站） | 第一關鐵路圖層、點位 | 組員自有資料 | 直接使用 |
| 台灣糖業公司各糖廠歷史、台糖大事紀 | 沿革、2018 太陽能電廠 | 組員下載的公開資料 | 引用並註明 |

**1959 年航照**：只在 map.net.tw 以圖片提供，沒有圖磚服務，且不可轉載，所以遊戲沒有放 1959 航照，第一關改用 1921 堡圖與 1966 Corona 影像比較，並在關卡中說明原因、附連結。取得書面同意後，可把同意的圖資放進 `basemaps.json`。

---

## 7. 完成狀況

### 已完成且已測試
- 首頁：故事、開始探險、三關進度、總分、碎片、收藏卡、說明、清除進度、展示模式（一鍵解鎖全部關卡）
- 第一關：左右比較（拖曳、觸控、鍵盤）、同一張地圖同步移動縮放、任務依 GeoJSON 目標面判斷（點在面內）、答錯給距離與方向回饋、文字提示與「縮放到附近」提示、答對顯示變化說明與證據來源、3 個任務（A、B、C 三種類型各一）
- 第二關：簡單／普通模式（困難模式已預留欄位、按鈕上鎖）、點位與面都可點選、照片彈窗、過去與現在用途、**文獻興建年與圖資最早辨識年分開顯示**（沒有證據顯示「未查證」）、收藏卡解鎖
- 第三關：年代切換、變遷圖層、圖例、點地塊看屬性、面積長條圖、轉換統計表、選擇題與地圖點選題、答對後高亮所有符合條件的地塊、答案由資料計算、小碎片（配準誤差）過濾
- 共用：每關 100 分、答錯與提示扣分（最低保留 30%）、答錯可無限重試、依序解鎖、重玩保留最高分、localStorage 儲存、封底、印章等第（甲乙丙）、可下載 PNG 完成卡
- 視覺：2026-11-23 改為「E 地方文化編輯設計」（地方文史特集），規範見 `docs/設計規範.md`；改版前的版本備份在 `../game_v1_備份/`
- 響應式：電腦版左側面板＋右側地圖；手機版地圖全螢幕、任務面板可上拉展開

### 測試方式與結果
- 用 Playwright（Chromium）在 **1280×800 桌面**與 **iPhone 13 模擬**兩種尺寸，自動走完首頁 → 第二關鎖定檢查 → 三關（含答錯、提示、拖曳分隔線）→ 通關 → 下載完成卡，**沒有 JavaScript 錯誤**（改版後重新測試一次，結果相同）。
- **未測試**：雲端測試環境連不到中研院、國土測繪中心與 OSM 的圖磚伺服器，所以測試時用假圖磚代替。**真實底圖是否正常顯示、對位是否正確，需要你們在自己電腦上打開確認。**也沒有在實體手機、Safari、Firefox 上測試。

### 仍使用示範資料（DEMO）
| 內容 | 狀態 |
|---|---|
| 第一關 L1-T1 糖廠舊址 | 事件與點位真實；目標範圍是點位外擴 350 m 的圓，待依 1921 堡圖描廠區 |
| 第一關 L1-T2 太陽能電廠 | 2018 動土事件真實；**目標位置是示範** |
| 第一關 L1-T3 鐵道彎 | 線形來自組員 1939 鐵路圖層；**現代是否改變未查證** |
| 第二關 B01 大林糖廠、B03 大林車站 | 點位與沿革真實；車站設站年、兩者的歷史照片待補 |
| 第二關 B02 太陽能電廠 | 事件真實；**位置是示範** |
| 第二關 B04、B05 | **完全是示範點位**，要換成真實建築 |
| 第三關全部 | **示範格網**，分類虛構，年份 1966／2025 只是預留 |

### 需要你們先在 QGIS 完成
1. 依 1921 堡圖數化大林糖廠廠區範圍 → 取代 L1-T1 的圓形範圍。
2. 依國土測繪中心正射影像數化太陽能板範圍 → 取代 L1-T2、B02 的示範位置。
3. 用 1953 臺糖鐵道網圖確認並數化糖鐵（五分車）路線；確認 L1-T3 那段鐵道現況。
4. 查證糖廠內具名建築（文獻＋圖資），數化成點或面，填齊第二關欄位，取代 B04、B05。
5. 兩期土地利用判釋（建議 1966 Corona 與現代正射影像）、交集分析、面積與轉換統計 → 取代第三關示範格網。
6. 寫信向中研院 GIS 專題中心確認圖磚公開展示的授權；若取得 1959 航照使用同意，再加入第一關。
