# Project Map

## 一句話

Math Survival 是一個靜態瀏覽器數學射擊遊戲：學生在 3D 或 2D 生存戰中完成數學題以升級武器。Production 排行榜目前使用 GAS；repository 已加入預設關閉的 Supabase backend foundation。

## 快速入口

| 範圍 | 入口 | 主要責任 |
|---|---|---|
| 3D 主頁 | `index.html` → `js/main.js` | 選單、難度、3D 載入、結算、排行榜 |
| 3D 遊戲 | `js/game.js` | Three.js 場景、控制、戰鬥、敵人、補給、HUD、狀態機 |
| 2D 經典版 | `classic-2d.html` | 獨立 Canvas 遊戲、觸控、題目、排行榜 |
| 數學題 | `js/math.js`、`js/topics/` | 題目選擇、答題 UI、解釋和課題生成器 |
| 雲端設定 | `js/config.js` | 本機預設值及 GAS game-data 覆寫 |
| 排行榜 | `js/leaderboard.js` | 3D 版排行榜讀取、渲染和提交 |
| Cloud boundary | `js/cloud-runtime-config.js`、`js/cloud-core.js` | GAS/Supabase feature flag、adapter、validation、安全排行榜 DOM |
| Supabase backend | `supabase/` | Postgres migrations、RLS/grants、Edge Function、synthetic seed、pgTAP 及 hosted staging |
| Staging validation | `scripts/validate-hosted-supabase.mjs`、`tests/smoke/supabase-staging.spec.js` | Hosted HTTP 安全邊界及 3D／2D 無 GAS fallback 驗收 |
| 裝置/畫質 | `js/device.js` | desktop/touch、全螢幕、橫屏、品質分級 |
| 輸入/狀態 | `js/input.js` | keyboard/mouse/touch input state、遊戲 lifecycle transition |
| 3D 資產 | `js/assets.js`、`assets/models/` | GLB manifest、載入、clone、動畫映射 |
| 音訊 | `js/audio.js`、`audio/` | BGM、錄製音效及 WebAudio 合成音效 |
| 場景 | `js/ambient.js`、`js/school.js` | 選單背景；備用學校場景 |

## 任務路由

| 任務 | 先讀 | 再讀程式碼 |
|---|---|---|
| 改選單、HUD、overlay | `pages/PAGES.md` | `index.html`、`js/main.js`、`js/game.js` |
| 改戰鬥或敵人 | `features/GAMEPLAY.md` | `js/game.js`、`js/config.js` |
| 改題目或難度 | `features/MATH_LEARNING.md` | `js/math.js`、`js/topics/`、`classic-2d.html` |
| 改排行榜或雲端平衡 | `features/CLOUD_AND_LEADERBOARD.md`、`api/API_MAP.md` | `js/config.js`、`js/leaderboard.js`、`classic-2d.html` |
| 改手機/畫質 | `features/DEVICE_MEDIA.md` | `js/device.js`、`js/game.js`、`index.html` |
| 改模型或音效 | `features/DEVICE_MEDIA.md` | `js/assets.js`、`js/audio.js`、資產目錄 |
| 改學生資料流程 | `data/DATA_FLOWS_AND_PRIVACY.md` | `js/main.js`、`js/leaderboard.js`、`classic-2d.html` |
| 改架構 | `architecture/OVERVIEW.md`、`decisions/` | 相關入口及 imports |
| 規劃或交接工作 | `WORKFLOW.md`、`CURRENT_STATE.md`、`ROADMAP.md` | 相關 feature 文件及程式碼證據 |

## Routes 和外部介面

- `/` 或 `/index.html`：3D 主頁；`/` 是否映射到 `index.html` 由靜態 host 決定。
- `/classic-2d.html`：2D 經典版。
- `supabase/` 可啟動隔離本機 backend，亦已連接獨立 `Math-Survival-Staging`；正式 static site仍保持 GAS。
- 外部 GAS actions：`getGameData`、`getLeaderboard`、`addScore`；詳見 `api/API_MAP.md`。
- Supabase v1 endpoints：詳見 `api/SUPABASE_CONTRACT_V1.md`。

## 共用依賴關係

```text
index.html
├─ helpers.js → topics/*.js
└─ main.js
   ├─ config.js ─────────────┐
   ├─ leaderboard.js ────────┤→ Google Apps Script
   ├─ device.js              │
   ├─ ambient.js             │
   └─ game.js                │
      ├─ math.js → topics/*  │
      ├─ assets.js → GLB     │
      ├─ audio.js → audio/*  │
      └─ school.js           │
                             │
classic-2d.html ─────────────┘
```

## 目前高風險改動面

- `game.js` 約 3,000 行，集中多個 subsystem；任何狀態機、render loop 或 dispose 修改都需要 browser smoke test。
- 2D/3D 有重複雲端、題目及排行榜邏輯，容易只修正其中一版。
- GAS/Supabase 回傳資料一律視為不可信；排行榜現經 validation＋`textContent`，不可恢復 `innerHTML`。
- 班別和學號經 GET query string 提交；更改前要先確認遠端 handler 及資料政策。
- 3D touch Batch 2 已接通虛擬移動、視角及戰鬥控制；iPhone／Android／iPad 真機、audio/autoplay 及完整長局驗收仍未完成。
