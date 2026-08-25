# Current State

更新基準：2026-08-25，以目前 workspace 程式碼為準。

## 當前版本

- 畫面版本：Math Survival FPS V3.4。
- ES Module/cache query：`?v=34`，目前所有已加版本的 imports 一致。
- 預設 3D 場景：`SCENE_MODE = 'nature'`。
- 備用 `school` 場景仍保留於 `js/school.js`。
- 2D `classic-2d.html` 保留為舊裝置 fallback。

## 已由程式碼確認的能力

- 3D 第一/第三人稱切換、WASD、疾跑、射擊、開鏡、換彈、近戰、9 級武器。
- 5 級喪屍、boss、hitbox、受擊/死亡效果、可破壞場景物件。
- 自然場景、圍牆收縮、雷達、羅盤、威脅提示、補給及彈藥箱。
- 五個難度、六個課題類別、輸入題/選擇題、限時、答錯解釋、賽後學習報告。
- GAS 雲端遊戲設定、排行榜讀取及成績提交；失敗時部分流程有本機 fallback。
- 3D/2D 共用 `MathSurvivalCloud`：單一 endpoint、6 秒 timeout、response/submission validation、single-flight 及 textContent leaderboard renderer。
- desktop/touch 偵測、橫屏提示、全螢幕請求及 high/medium/low 畫質分級。

## 進行中／未完成

- 3D 手機版只有 P0 基礎：輸入模式、沉浸/橫屏和畫質分級。
- Pointer Lock 仍驅動 `PLAYING ↔ PAUSED/RESUME_WAIT`；touch 裝置沒有完整 pause/resume 流程。
- 尚未有 `js/input.js` 統一輸入抽象、虛擬搖桿、touch look 或手機射擊按鈕。
- 學校場景沒有樓梯重力/探地及跨樓層喪屍尋路。
- 19 MB 模型未壓縮。
- 已有靜態驗證、Playwright browser smoke tests 及非部署 GitHub Actions CI；仍沒有 lint、type check 或正式 build。

## 已知文件／設定問題

- Git 歷史及 `origin` 已於 2026-08-25 恢復；`origin` 是公開 repository `chakwing528/Math-Survival`，預設分支為 `main`。
- 本機 V3.4、文件系統及資產在獨立分支整理；合併前應先審查，避免直接改動 GitHub Pages 的公開版本。
- Draft PR #1 由 `codex/project-memory-v3.3` 指向 `main`；目前可合併但仍保持 Draft，未改動正式網站。
- 大規模重整路線圖見 `docs/ROADMAP.md`；Issue #4（測試/CI 基線）已完成，後續首輪工作為 #2（GAS/學生資料安全邊界）及 #3（desktop/touch 輸入與狀態機）。
- `.claude/launch.json` 已改為本機可用的 `python3` 和相對工作目錄，但仍需由實際 launcher 驗證。
- 模型授權不是全部 CC-BY 3.0；個別授權以 `assets/models/credits.txt` 為準。
- GAS handler、遠端 schema、權限及資料保留政策不在此 workspace。
- Legacy `addScore` 仍以 GET 傳送班別/學號；POST v2 只完成本機 contract/遷移設計，未改 production。

## 驗證狀態

- 2026-08-25：V3.4 本機 `npm test` 通過；靜態驗證涵蓋 21 個 JavaScript、3 個 JSON、21 個 Markdown、24 個模型引用及 cache v34。
- Node unit tests：6 tests passed，涵蓋 normalization、submission validation、HTTP/JSON/timeout errors、single-flight 及 score merge。
- Playwright Chromium：5 tests passed，涵蓋 3D/2D 啟動、兩個 client 的 malicious leaderboard payload 及 2D duplicate submission。
- Smoke tests 全程 mock GAS、阻止 `addScore` 並封鎖其他外部 host；沒有讀寫 production leaderboard。
- 尚未驗證完整 3D 模型/WebGL gameplay、Pointer Lock、touch、audio、真實 GAS integration 或真機。

## 下一批建議工作

1. 審查 Draft PR #1 的公開內容、完整 3D gameplay 及 GitHub Pages 影響；未完成必要人工測試前不要合併。
2. 取得/審查 GAS handler、server schema、authentication/authorization 和學生資料政策，再完成 Issue #2 的 server POST migration。
3. 基於現有回歸安全網推進 Issue #3：解耦 Pointer Lock 狀態機並建立統一 input abstraction。
