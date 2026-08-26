# Math Survival FPS

數學生存射擊遊戲：在戰場完成數學題升級武器，殲滅所有魔物並查看學習報告。

## 版本和支援狀態

- **3D 主版**：開啟 `index.html`，支援滑鼠鍵盤及完整 touch HUD。
- **2D 經典版**：開啟 `classic-2d.html`，保留觸控和舊裝置 fallback。
- 3D touch 支援虛擬搖桿、拖動視角、開火及暫停；開火鍵在未持槍時自動近戰，彈匣清空後自動換彈。
- V3.10 將手機答題改為左右雙欄，移除重複戰鬥鍵及手機武器卡，並修正 iPhone Game Over／成績重試流程。
- 手機 medium 使用 DPR 1.25／最低 1.0、同場最多 4 隻敵人及 45 FPS frame budget；答題、暫停與結算期間停止持續 WebGL render，低 FPS 時再逐級降載。
- 畫面版本為 V3.10，module cache key 為 `?v=40`。

> 3D 版使用 ES Modules，必須經 HTTP server 開啟。直接雙擊 `index.html` 會因 `file://` 限制而無法載入 modules。

## 本機開啟

在專案根目錄執行：

```bash
python3 -m http.server 8000
```

然後瀏覽 `http://localhost:8000/`。Windows 如有 `python` launcher，也可使用 `python -m http.server 8000`。

遊戲本身沒有 build step；Node/Playwright 只用於開發驗證。

## 測試

首次 clone 後執行：

```bash
npm ci
npx playwright install chromium
npm test
```

`npm test` 先檢查 JavaScript syntax、JSON、Markdown links、cache version 及模型引用，再執行 cloud contract unit tests，最後以 Chromium 驗證 3D/2D 啟動、惡意 leaderboard payload 和重複提交。Smoke tests 會 mock Google Apps Script、阻止 `addScore`，並封鎖其他外部 host，因此不會讀寫 production 排行榜。

Supabase database migration 需 Docker，可另執行：

```bash
npm run supabase:start
npm run test:db
npm run lint:db
```

只執行靜態驗證可使用 `npm run check:static`。GitHub Actions 亦執行同一套 `npm test`，workflow 只有 read permission，沒有部署步驟。

## 操作

| 按鍵 | 功能 |
|---|---|
| W A S D | 移動 |
| 滑鼠 | 轉動視角及瞄準 |
| 左鍵 | 射擊／平底鑊近戰 |
| 右鍵 | 開鏡 |
| Shift | 疾跑 |
| R | 換彈 |
| V | 切換第一／第三人稱 |
| Esc | 暫停及設定 |

Touch 模式使用左下虛擬搖桿移動（推盡向前會疾跑）、右半屏拖動視角及右下開火鍵；未持槍時開火等同近戰，持槍後彈匣清空會自動換彈。

## 玩法

1. 輸入班別和學號，選擇程度 1–5。
2. 接近金色升級箱或藍色彈藥箱後完成限時數學題。
3. 答對可升級/補充武器、回復及累積 combo；答錯會顯示解題步驟。
4. 在收縮戰場中清除五級魔物和喪屍王。
5. 結算顯示正確率和各課題表現；玩家可選擇提交分數到排行榜。

## 專案結構

```text
index.html              3D UI、HUD、styles、import map
classic-2d.html         2D 經典版完整 client
js/
  main.js               選單、boot、遊戲建立、結算
  game.js               Three.js runtime、戰鬥、AI、場景、HUD
  input.js              keyboard/mouse/touch 輸入狀態及 lifecycle 狀態機
  config.js             遊戲預設值及 cloud 覆寫
  cloud-runtime-config.js GAS/Supabase public feature flag
  cloud-core.js         共用 GAS/Supabase adapter、validation、timeout、安全排行榜 DOM
  math.js               3D 題目選擇、答題 UI、解釋
  leaderboard.js        3D 排行榜 client/renderer
  device.js             desktop/touch、orientation、畫質
  assets.js             GLB manifest、載入和 clone helpers
  audio.js              HTML Audio/WebAudio
  ambient.js            選單背景場景
  school.js             備用學校場景
  helpers.js            題庫 global helpers
  topics/               指數、展開、因式分解、捨入題庫
assets/models/          24 個 GLB 及 credits.txt
audio/                  BGM 和槍械音效
docs/                   專案地圖、架構、功能、API、資料及 ADR
AGENTS.md               Codex 閱讀和驗證指引
HANDOFF.md              近期工作狀態
scripts/                靜態驗證及本機測試 server
tests/smoke/            隔離外部服務的 3D／2D browser smoke tests
supabase/               migrations、Edge Function、synthetic seed、pgTAP tests
.github/workflows/      非部署 CI workflow
```

## 專案文件

- 新 task 入口：[AGENTS.md](AGENTS.md)
- 專案地圖：[docs/PROJECT_MAP.md](docs/PROJECT_MAP.md)
- 當前狀態：[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)
- 工作管理：[docs/WORKFLOW.md](docs/WORKFLOW.md)
- 大規模重整路線圖：[docs/ROADMAP.md](docs/ROADMAP.md)
- 架構：[docs/architecture/OVERVIEW.md](docs/architecture/OVERVIEW.md)
- 頁面及 routes：[docs/pages/PAGES.md](docs/pages/PAGES.md)
- 外部 API：[docs/api/API_MAP.md](docs/api/API_MAP.md)
- GAS client v1 contract：[docs/api/GAS_CONTRACT_V1.md](docs/api/GAS_CONTRACT_V1.md)
- GAS POST 遷移方案：[docs/api/GAS_POST_MIGRATION.md](docs/api/GAS_POST_MIGRATION.md)
- Supabase v1 contract：[docs/api/SUPABASE_CONTRACT_V1.md](docs/api/SUPABASE_CONTRACT_V1.md)
- Supabase migration runbook：[docs/runbooks/SUPABASE_MIGRATION.md](docs/runbooks/SUPABASE_MIGRATION.md)
- 資料及私隱：[docs/data/DATA_FLOWS_AND_PRIVACY.md](docs/data/DATA_FLOWS_AND_PRIVACY.md)

## 雲端設定和排行榜

Production 目前仍由 Google Apps Script/Sheet 提供雲端設定及排行榜。獨立 Supabase staging project 已部署 adapter、private schema、RLS/grants、Edge Function 及安全測試，但 public runtime flag 預設仍關閉，詳見 `docs/features/CLOUD_AND_LEADERBOARD.md`。

班別和學號會在玩家主動提交成績時傳送到 GAS。開發和測試不要使用真實學生資料，也不要直接向 production 排行榜寫入測試紀錄。

## 素材授權

模型由 Quaternius 等創作者提供，經 [poly.pizza](https://poly.pizza/) 取得。個別模型分別使用 **CC0 1.0** 或 **CC-BY 3.0**；權威清單和原始連結見 `assets/models/credits.txt`，不可概括為單一授權。
