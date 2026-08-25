# Pages and Routes

## Route 概覽

| 頁面 | Route | 入口 | 權限 | 主要資料 |
|---|---|---|---|---|
| 3D 主頁 | `/` 或 `/index.html` | `index.html`、`js/main.js` | Public；無真正登入 | config、GAS、GLB、audio、localStorage |
| 2D 經典版 | `/classic-2d.html` | `classic-2d.html` | Public；無真正登入 | 內嵌 config、題庫、GAS |

沒有 dynamic route、本機 API route、admin page 或應用層 not-found page。

## 3D 主頁

### 使用者流程

`Loading → 班別/學號 → 難度 → 3D 遊戲 → 數學題/暫停 → 結算 → 可選提交排行榜`

### 主要入口和 components

- Layout/UI：`index.html` 內的 `#loading-screen`、`#start-menu`、`#hud`、`#math-overlay`、`#pause-menu`、`#gameover-overlay`。
- Controller：`js/main.js`；輸入／lifecycle：`js/input.js`。
- Game canvas：由 `js/game.js` 或 `js/ambient.js` 動態加入 `#game-container`。
- 題目：`js/math.js` 操作 `#math-*` DOM。
- 排行榜：`js/leaderboard.js` 操作 `#menu-lb-list` 和 `#go-lb-list`。

### Query parameters

- `mode=touch|desktop`：強制輸入模式。
- `quality=high|medium|low`：強制初始品質。

### 狀態處理

- Loading：GAS、engine、asset loading progress。
- Empty：排行榜無資料。
- Error：`file://`、boot watchdog、GAS fallback、engine/asset alert。
- Permission：沒有角色權限；GAS 拒絕被視為網絡/權限錯誤。
- Not-found：無應用層處理。

### 使用模型及 API

- Models：`WEAPONS`、`MONSTER_BASE`、`SETTINGS`、`mathStats`、leaderboard item。
- API：三個 GAS actions，詳見 `../api/API_MAP.md`。
- Tests：啟動／雲端隔離 browser smoke、input/lifecycle unit tests；完整 gameplay 仍需實際瀏覽器驗收。

## 2D 經典版

### 使用者流程

`班別/學號 → 難度 → Canvas 遊戲 → 數學題 → 結算 → 可選提交排行榜`

### 結構

- CSS、DOM、狀態、遊戲 loop、GAS client、題目 UI 及 leaderboard renderer 全部在 `classic-2d.html`。
- `js/topics/*.js` 在 head 載入，並在 inline script 定義的 helper globals 上運作。
- 支援鍵盤和 canvas touch events。

### 狀態處理

- Game states：`START_MENU`、`PLAYING`、`MATH_TIME`、`MATH_ANSWERED`、`GAME_OVER`、`VICTORY`。
- GAS game data 失敗後使用本機預設值。
- leaderboard 失敗顯示錯誤；提交失敗仍用本機項目顯示本人排名。
- 沒有 admin、authentication 或 not-found 狀態。

## 修改影響提示

- 更改班別/學號欄位或 GAS schema：兩頁都要更新。
- 更改題庫函數 contract：檢查 `js/math.js` 和 2D `triggerMath()`。
- 更改難度名稱/倍率：檢查 `index.html`、`config.js` 和 `classic-2d.html`。
- 更改 cache version：檢查 `index.html` 及所有 ES Module imports。
