# Math Survival FPS — 近期交接文件

> 新 Codex task 應先讀 `AGENTS.md`、`docs/PROJECT_MAP.md` 同 `docs/CURRENT_STATE.md`，再按任務讀相關 feature 文件。
> 呢份文件只保留近期交接同歷史實作細節；架構、API、資料流同長期規則以 `docs/` 為準，實際行為以程式碼為準。
> 目前 workspace：`/Users/cwchan/Downloads/Math-Survival-main/Math-Survival-main`。2026-08-25 盤點時缺少 `.git`；其後已確認並恢復公開 repository `chakwing528/Math-Survival` 的 Git 歷史及 `origin`。本機新版在 `codex/project-memory-v3.3`，Draft PR #1 尚未合併至 `main`。Issue #4 測試/CI 基線已在本機通過，等待首次 GitHub Actions run；後續見 Issues #2、#3 及 `docs/ROADMAP.md`。

---

## 一、專案係乜

香港中學數學教育遊戲。原本係 2D 俯視角射擊，已完全改造成 **3D 第一/第三人稱 PUBG 風格喪屍射擊遊戲**。

**核心玩法**：喺草地戰場射殺喪屍 → 行近空投包裹自動觸發**數學題** → 答啱升級武器 → 圍牆不斷收窄 → 殺清全部喪屍(含喪屍王)勝利 → 上傳成績到 Google Sheet 排行榜。

**目標用戶**：明愛聖若瑟中學學生（電腦版，需滑鼠鍵盤）

**現時版本**：**V3.3**（快取版本號 `?v=33`）　← 手機版改造進行中，見第九節

---

## 二、技術架構

- **Three.js r160**（CDN importmap 載入）+ 原生 ES Modules，**冇 build tool**
- 純靜態檔案，可直接放 GitHub Pages
- **必須經 HTTP server 開**（ES Modules 限制），雙擊 index.html 會有友善提示

### 檔案結構

```
index.html          832 行  主入口：全部 CSS + HTML UI 結構
classic-2d.html             2D 舊版完整保留（觸控裝置用）
HANDOFF.md                  本文件
README.md                   使用說明
js/
  helpers.js         17 行  全域工具函數（題庫依賴，必須最先載入）
  device.js         180 行  裝置偵測（desktop/touch）+ 全螢幕鎖橫屏 + 畫質分級
  config.js         103 行  武器/喪屍數值 + Google Sheet 雲端設定讀取
  audio.js          190 行  音效管理 + WebAudio 合成音效
  math.js           317 行  數學出題 + 答題彈窗 + 解題步驟
  leaderboard.js    128 行  排行榜讀取/渲染/上傳
  assets.js         169 行  GLTF 模型載入器
  ambient.js        191 行  選單背景環境場景（輕量程序化）
  school.js         306 行  明愛聖若瑟五層校舍（保留備用，見下）
  game.js          2948 行  ★ 主引擎（場景/控制/武器/AI/HUD/特效）
  main.js           266 行  主流程（選單→遊戲→結算）
  topics/                   原有題庫，零改動
    indices.js / expansion.js / factorization.js / rounding.js
assets/models/      24 個 GLB，共 19MB（個別為 CC0 1.0 或 CC-BY 3.0；見 credits.txt）
audio/              bgm.mp3 + 3 個槍聲音效
```

### 版本快取機制（重要！）

目前已加 cache key 嘅 import 都掛 `?v=33`，例如 `import { x } from './config.js?v=33'`。
**每次改完代碼必須 bump 版本號**，否則用戶瀏覽器會用舊快取。

```bash
python3 - << 'PYEOF'
import io, re, os
OLD, NEW = '33', '34'   # ← 發佈前按實際版本改呢兩個數字
for f in ['index.html','js/main.js','js/game.js','js/assets.js','js/math.js','js/school.js',
          'js/leaderboard.js','js/config.js','js/audio.js','js/helpers.js','js/ambient.js']:
    if os.path.exists(f):
        s = io.open(f, encoding='utf-8').read()
        s2 = s.replace('?v='+OLD, '?v='+NEW)
        if s != s2: io.open(f,'w',encoding='utf-8').write(s2)
h = io.open('index.html', encoding='utf-8').read()
h = re.sub(r'Math Survival FPS V[0-9.]+', 'Math Survival FPS V3.4', h)  # ← 同步改顯示版本
io.open('index.html','w',encoding='utf-8').write(h)
print('bumped')
PYEOF
```

---

## 三、程式碼內已存在功能

> 2026-08-25 只完成 JavaScript 語法檢查，冇重新執行 browser gameplay、WebGL、touch、audio 或 GAS integration test。以下「實測」字眼如屬舊工作紀錄，只代表當時交接紀錄，唔代表目前自動驗證已通過。

### 🎮 核心遊戲
| 功能 | 說明 |
|------|------|
| 視角 | 預設**第三人稱**（過肩，防穿牆），**V 鍵**切第一人稱 |
| 移動 | WASD、**Shift 疾跑**（跑步唔開到槍）、走路搖晃 |
| 射擊 | 左鍵、**右鍵開鏡**（FOV 縮放+散佈減 60%）、R 換彈、後座力自動回復 |
| 平底鑊 | 開局武器，可**近戰揈**（2.4 米扇形/3 傷害），**右上→左下大動作揮擊**動畫 + 金屬「鏘」聲 |
| 武器 | 9 級，真 GLTF 槍模型（手槍→狙擊），第一/第三人稱都揸住 |
| 瞄準 | **統一膠囊 hitbox** + 頭部爆頭區（傷害 ×2）、輔助瞄準（擦邊 35cm 磁吸）、動態準星（指敵變紅） |

### 🧟 喪屍
- Quaternius 3D 模型 + 骨骼動畫（行/跑/攻擊/死亡），**體型已加倍**
- 5 個等級（tier 1-5），tier 5 = 喪屍王（金皇冠 + 專屬血條）
- **SAO 式格仔數據解體**死亡爆破：普通 **150 粒**、喪屍王 **500 粒**發光立方碎片（InstancedMesh，青藍白配色，自轉+重力+縮小淡出）
- 隨機低吼（音量隨距離）、中彈硬直+擊退+血花

### 🗺️ 場景（草地，`SCENE_MODE = 'nature'`）
- 130×130 米戰場、22 棵場內樹 + 40 棵場外樹、岩石、700 叢 instancing 草
- **中央營地**：營火（動態火焰+閃爍燈光）、木製瞭望塔、沙包掩體、補給箱堆
- **可破壞系統**：45 件物件有血量（木箱 30 / 樹 50 / 沙包 45 / 岩石 90 / 瞭望塔 150），中彈顯示頭頂血條 + 碎屑，摧毀後碰撞一齊消失
- **圍牆收縮**（取代藍圈）：四面樹籬向內移動，65→46→30→18→11 米，玩家同喪屍都被推入

### 📦 補給
- **升級空投**：金色沖天光柱（60米，強光脈動）+ 降落傘 + 紅煙，行近**自動開啟**→ 數學題
- **彈藥箱**：淡藍弱光柱（45米，柔和），行過**自動拾取**

### 🎯 HUD（PUBG Mobile 風）
- 頂部羅盤、左上程度標籤 + Kill Feed、右上**圓形雷達**（喪屍 🧟 頭像、金/藍寶箱、白箭嘴準確指向面向、白框顯示圍牆）
- 左下血條 + 能量條、右下武器卡片（槍圖示 + 大字彈藥 + 9 格等級）
- **近距喪屍四邊紅色警告**（30 米內，方向準確）、受擊方向指示器、低血心跳聲

### 📚 教學功能
- **答錯顯示解題步驟**（題庫自帶詳解），學生撳「明白了」先繼續
- **賽後學習報告**：正確率 + 各課題 🟢🟡🔴 分色 + 最弱課題建議溫習
- 5 個難度（分數倍率 ×1.0~×1.8），題庫：整數加減/四則/指數/展開/因式分解/捨入

### 🎨 UI 風格（軍事求生 + SAO 霓虹）
- **開始畫面**：半透明，背後有明亮環境場景（草地/樹/藍天，鏡頭慢轉），58px 霓虹發光標題（脈動）、切角面板、金色霓虹按鈕
- **結算畫面**：半透明保留背後**真實遊戲場景**（唔銷毀，只調暗），68px 霓虹標題（勝利金/死亡紅）、霓虹按鈕
- 排行榜：首三名金銀銅、人名 18px

### 🔊 音效（WebAudio 合成，零額外音檔）
喪屍低吼/攻擊/死亡、喪屍王咆哮、答啱答錯、武器升級、低血心跳、勝利小調、平底鑊鏘聲

### 💾 其他
- 設定記憶（靈敏度/音量存 localStorage）
- Google Sheet 雲端設定（武器/喪屍數值/箱子間隔）+ 排行榜上傳，**完全沿用原有 GAS API**

---

## 四、重要技術細節（避免踩雷）

1. **Sprite 射線判定** — 任何加入場景嘅 Sprite **必須** `sprite.raycast = () => {}`，否則 TPP 相機防穿牆射線掃到會 throw exception → 畫面全黑卡死（已中過招）

2. **GLTF 角色縮放** — 角色模型嘅幾何 bbox 同渲染尺寸可差幾十倍，必須用**骨骼變形後**嘅 bbox（`computeBoundingBox` + `matrixWorld`）計算，否則模型隱形

3. **手骨掛武器** — 用 `getWorldScale` 動態反算 scale（手骨 world scale 係 3.4 唔係 1）

4. **共用 material/geometry** — 可破壞物件註冊時要 **clone material**，摧毀時只 dispose clone，**唔好 dispose 共用 geometry**（否則其他同款物件會消失）

5. **TPP 準星視差** — 射擊射線必須用 `_setAimRay()`（套用渲染相機偏移），唔可以直接用 camera 位置

6. **測試方向** — Three.js 相機預設面向 **-Z**，寫測試時容易搞錯方向

7. **`?v=` 保護唔到 index.html 本身** — bump 版本號只令瀏覽器重新攞 js/，但 `index.html` 冇 query
   string，瀏覽器會照用快取。測試時見到「改極都冇效」＋ 版本標籤仍係舊數字，就係中咗呢招。
   解法：`fetch('/', {cache:'reload'})` 之後再 `location.reload()`（注意要 fetch 導覽用嗰條 URL，
   fetch `/index.html` 同 fetch `/` 係兩個唔同快取 key）。
   ⚠️ 部署到 GitHub Pages 都有同樣問題（HTML 預設快取 10 分鐘），學生可能要等一陣先見到新版。

---

## 五、學校場景（保留備用）

明愛聖若瑟中學五層口字形校舍已完整開發，儲存喺 `js/school.js`：
- 口字形三翼五層、中央籃球場（藍底白線）、旗桿、籃球架、藍色軟墊柱
- 配色對正照片：白牆 + 深藍直柱 + 紅色橫欄 + 粉紅點綴、開放走廊掛橫額 + 花盆、白色校名塔

**啟用方法**：`js/game.js` 頂部改 `const SCENE_MODE = 'school';`（而家係 `'nature'`）

未做：玩家上落樓梯（需重力 + 向下射線探地面）、喪屍樓層尋路

---

## 六、開發環境 / 測試方法

**開伺服器**（目前 macOS workspace）：
```
python3 -m http.server 8000   → http://localhost:8000
```

`.claude/launch.json` 使用 `python3`、port 8090 同相對目錄；仍需由實際 launcher 驗證。

**測試技巧**：
- 截圖工具（`computer` screenshot）**經常 timeout**，改用 `javascript_tool` 執行 JS 驗證 DOM/邏輯，或用 `gl.readPixels` 讀畫面像素判斷顏色
- `window.__game` 係遊戲實例，可直接操控測試：
  ```js
  const g = window.__game;
  g.maxHp = 99999; g.hp = 99999;              // 無敵
  g.weaponLevel = 4; g._buildGunModel();       // 換武器
  g.freezeTimer = 9999;                        // 凍結喪屍
  for (let i=0;i<600;i++){ g.time+=1/60; g._updatePlaying(1/60); }  // 快進模擬
  ```
- 改完代碼要 `fetch(file, {cache:'reload'})` + `location.reload()` 先見到效果

**已知非問題**：console 有 `THREE.PointerLockControls: Unable to use Pointer Lock API` 係預覽 iframe 限制，真瀏覽器冇事

---

## 七、未做 / 可繼續嘅方向

用戶之前有興趣但未做：
- 自適應難度（連續答啱出難啲）
- 成就系統、無盡/波次模式
- 唔同行為嘅喪屍（快跑型/遠程/坦克）
- 老師工具：匯出成績 CSV、按班別篩選排行榜、揀課題
- 部署上 GitHub Pages（版本快取機制已做好，直接 push 就得，記住連 `assets/` 一齊）

---

## 八、素材授權

3D 模型由 **Quaternius** 創作，經 poly.pizza 下載，**CC-BY 3.0**。
署名已加喺畫面左下角 + README.md + `assets/models/credits.txt`。

---

## 九、手機版改造（PUBG Mobile 式）— 進行中

**目標**：同一份代碼，電腦開＝滑鼠鍵盤，手機/平板開＝觸控 HUD。唔開分支檔案。

**已定方向**（用戶 2026-08-02 拍板）：
- 射擊輔助：**手動開火 + 中度磁吸**（輔助瞄準由 35cm 加到約 1 米），唔做自動開火
- `classic-2d.html` **保留做後備**，選單有連結，但唔再係手機嘅預設

### ✅ P0 已完成（V3.3）

| 項目 | 做咗乜 |
|---|---|
| 解除封鎖 | 刪走 `#touch-block`，手機唔再被踢去 2D 版 |
| 裝置偵測 | `js/device.js`：初始靠 media query 猜，之後跟住**實際輸入**動態切換（救 iPad+鍵盤、Surface）。`body` 加 `mode-touch` / `mode-desktop` |
| 覆寫 | `?mode=touch` / `?mode=desktop` 強制指定，**執行時偵測唔准推翻**；`?quality=high\|medium\|low` |
| 沉浸模式 | 開波時 `requestFullscreen()` + `orientation.lock('landscape')`（必須喺 user gesture 內同步呼叫） |
| 直屏提示 | `#rotate-block` 遮罩，orientationchange / matchMedia 雙保險 + 補幾次 timeout（iOS 時序唔穩） |
| 防手勢 | `overscroll-behavior:none`、`touch-action:none`（輸入框例外，否則打唔到班別學號）、`user-scalable=no`、`viewport-fit=cover` |
| 畫質分級 | high(桌面，數值同 V3.2 一模一樣) / medium / low：pixelRatio、antialias、草叢 700→250→120、場外樹 40→15→8、解體碎片 150·500→60·180→30·90、霧距離 |
| 動態降級 | `_watchPerf()` 每 3 秒實測 fps，<40 即時降 pixelRatio（最多兩次）+ 下一局降一級。**刻意唔存 localStorage** —— 偶發卡頓唔應該永久調低畫質 |

舊交接紀錄：當時桌面版數值同改造前一致（草 700 / 樹 40 / 霧 60-150 / antialias 開），並記錄為冇新 console 錯誤；目前未重新驗證。

### ⬜ 待做

- **P1 能玩**（最關鍵）
  1. ⚠️ **暫停狀態機解耦** — 而家 `PLAYING⇄PAUSED` 完全靠 PointerLock 嘅 lock/unlock 事件驅動
     （`game.js` `_onLock`/`_onUnlock`、`start()` 嘅 `controls.lock()`、答題時嘅 `controls.unlock()`）。
     手機冇 Pointer Lock，唔拆呢個就會一開波卡死喺 `RESUME_WAIT`。要抽 `pause()` / `resume()` 方法，
     desktop 由 lock 事件叫、touch 由暫停掣同 `visibilitychange` 叫。
  2. 輸入抽象層 `js/input.js`，輸出統一 state：`moveX/moveZ`(類比)、`lookDX/DY`、`shooting/aiming/sprinting`、
     `reload/toggleView/melee`。game.js 只需改兩處：讀 `keys.wasd` 嗰段、同埋相機轉向。
     **移動唔使改** —— `controls.moveForward/moveRight` 唔依賴 pointer lock。
  3. 左下虛擬搖桿（推到最外圈＝疾跑）、右半屏拖動轉視角、右下開火掣
- **P2 好玩** — 拖動即射（開火掣按住可同時轉視角，要追 pointerId）、開鏡改 toggle、換彈/切視角/近戰掣、磁吸加大
- **P3 靚** — 四角 HUD wrapper 各自 `transform: scale(var(--hud-s))`（唔好成個 HUD 一次過 scale，錨點會飛）、
  選單 `flex-direction` 手機改 column、答題彈窗選項掣 ≥48px、填充題 `inputmode="numeric"`
- **P4 打磨** — 真機測試（iPhone Safari / Android Chrome / iPad）、iOS AudioContext 解鎖時機、19MB 模型考慮壓縮
