# Math Survival 專案指引

本檔是新 Codex task 的第一閱讀入口。文件以目前程式碼和可重現驗證為準；`HANDOFF.md` 只記錄近期狀態，不是永久架構來源。

## 開始工作前

1. 先讀 `docs/PROJECT_MAP.md`，按任務類型只開啟相關文件。
2. 再讀 `docs/CURRENT_STATE.md`，確認當前版本、進行中工作和已知限制。
3. 修改前查看相關原始碼；文件與程式碼不一致時，以程式碼為準並同步更新文件。
4. 本機 Git 已連接公開 repository `https://github.com/chakwing528/Math-Survival.git`；開始修改前先執行 `git status --short --branch`，並避免直接推送 `main` 影響 GitHub Pages。

## 任務導向閱讀

- 頁面、入口或 UI：`docs/pages/PAGES.md`
- 整體模組和資料流：`docs/architecture/OVERVIEW.md`
- 3D/2D 遊戲：`docs/features/GAMEPLAY.md`
- 數學題及學習報告：`docs/features/MATH_LEARNING.md`
- Google Apps Script、排行榜和雲端設定：`docs/features/CLOUD_AND_LEADERBOARD.md`、`docs/api/API_MAP.md`
- 裝置、手機、畫質、模型或音效：`docs/features/DEVICE_MEDIA.md`
- 個人資料及 browser storage：`docs/data/DATA_FLOWS_AND_PRIVACY.md`
- 長期技術選擇：`docs/decisions/`
- 工作項目狀態及完成規則：`docs/WORKFLOW.md`
- 大規模重整次序及完成條件：`docs/ROADMAP.md`
- 近期工作狀態：`HANDOFF.md`

## 重要工程規則

- `index.html`、`js/main.js` 和其 ES Module imports 使用 `?v=34` cache key。修改已加版本參數的前端檔案時，發佈前應一致 bump 所有相關 `?v=` 及畫面版本標籤。
- `js/helpers.js` 必須在 `js/topics/*.js` 之前載入；題庫依賴其 global helpers。
- `index.html` 的 DOM IDs 是 `main.js`、`game.js`、`math.js`、`audio.js` 和 `device.js` 的共用介面，改名時必須搜尋所有 caller。
- 3D 遊戲的相機/射擊、Sprite raycast、GLTF bbox、手骨武器 scale 及共用材質規則見 `docs/features/GAMEPLAY.md`。
- `classic-2d.html` 是獨立單檔客戶端，包含與 3D 版重複的設定、數學和排行榜邏輯；修改共同行為時要檢查兩個入口。
- `js/cloud-core.js` 必須在 3D modules 及 2D inline client 前載入；GAS endpoint、response validation、single-flight 和 leaderboard DOM rendering 以此為唯一共用邊界。
- 遠端 leaderboard 欄位不可經 `innerHTML`；必須通過 `MathSurvivalCloud` validation 並使用安全 DOM/textContent。
- 不要把班別、學號、姓名或成績加入 log、fixture、截圖或文件範例。
- 不要在未審查 Google Apps Script handler 和資料政策前改動遠端資料格式。

## 驗證原則

- 安裝依賴後以 `npm test` 執行完整基線：靜態驗證加 3D／2D Playwright smoke tests。
- 只需靜態驗證時執行 `npm run check:static`；它會檢查 JavaScript syntax、JSON、Markdown links、cache version 和 24 個模型引用。
- unit tests 覆蓋 cloud contract、timeout、invalid response 和 single-flight；browser smoke tests 會攔截 GAS、阻止 `addScore` 並封鎖其他外部 host。不要移除這層隔離後對 production 執行測試。
- 本機 3D 版必須經 HTTP server 開啟；目前可用 `python3 -m http.server 8000`，但啟動服務前留意工作環境規則。
- 涉及 gameplay、Pointer Lock、WebGL、audio、touch 或 GAS 時需要瀏覽器/真機驗證；純語法檢查不足夠。
- 測試時不要把真實學生資料提交到 GAS。

## 文件維護

- 功能或 route 改變：更新 `docs/PROJECT_MAP.md` 和相關 page/feature 文件。
- 外部 API 或資料欄位改變：更新 `docs/api/API_MAP.md` 及 `docs/data/DATA_FLOWS_AND_PRIVACY.md`。
- 長期且有取捨的技術選擇：新增 ADR；不要改寫已接受 ADR 的歷史結論，應新增 superseding ADR。
- 每次工作完成：把仍影響下一個 task 的狀態寫入 `HANDOFF.md`，完成事項不要無限累積。
