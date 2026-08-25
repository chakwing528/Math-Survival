# Current State

更新基準：2026-08-25，以目前 workspace 程式碼為準。

## 當前版本

- 畫面版本：Math Survival FPS V3.5。
- ES Module/cache query：`?v=35`，目前所有已加版本的 imports 一致。
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
- Supabase local foundation：private student/score schema、explicit grants＋RLS、redacted leaderboard RPC、service-only submit RPC、Edge Function、idempotency、hashed requester rate limit。
- GAS/Supabase adapter 已用 public runtime flag 統一；預設仍為 GAS，Supabase mutation 不會自動 fallback。
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
- 本機 V3.5、文件系統及資產在獨立分支整理；合併前應先審查，避免直接改動 GitHub Pages 的公開版本。
- Draft PR #1 由 `codex/project-memory-v3.3` 指向 `main`；目前可合併但仍保持 Draft，未改動正式網站。
- 大規模重整路線圖見 `docs/ROADMAP.md`；Issue #4（測試/CI 基線）已完成，後續首輪工作為 #2（GAS/學生資料安全邊界）及 #3（desktop/touch 輸入與狀態機）。
- `.claude/launch.json` 已改為本機可用的 `python3` 和相對工作目錄，但仍需由實際 launcher 驗證。
- 模型授權不是全部 CC-BY 3.0；個別授權以 `assets/models/credits.txt` 為準。
- Hosted staging 已選用另一帳戶的獨立 Free project `Math-Survival-Staging`（ref `mtwhanvpaqgdlhbxzyhu`，Tokyo）；未使用 `School Platform Production`。真實資料 owner、retention、匯入批准及 production cutover 仍待確認。
- Legacy `addScore` 仍以 GET 傳送班別/學號；POST v2 只完成本機 contract/遷移設計，未改 production。

## 驗證狀態

- 2026-08-25：V3.5 static/unit/database/Edge local tests 及 hosted staging rollout 通過；最終完整 `npm test` 及 GitHub Actions 狀態見 branch 最新 commit。
- Node unit tests：13 tests passed，覆蓋 Supabase POST adapter、no mutation fallback、CORS、Edge payload、requester hash 及安全 PostgREST 錯誤映射。
- Supabase pgTAP：18 tests passed；database lint 0 errors；local HTTP 驗證 read 200、direct submit 401、Edge accepted/duplicate 200、bad origin 403。
- Hosted staging：兩個 migrations、`submit-score` Edge Function 及四個 project secrets 已部署；read、redaction、direct-write denial、CORS、idempotency 及 5/min rate limit 全部通過。3D／2D staging smoke tests 2 passed，沒有 GAS fallback。
- Hosted advisors 無 error；private tables 的 no-policy INFO、固定遮罩 leaderboard `SECURITY DEFINER` WARN 及 staging unused-index INFO 均為已記錄的刻意設計／低流量狀態。
- Playwright Chromium：5 tests passed，涵蓋 3D/2D 啟動、兩個 client 的 malicious leaderboard payload 及 2D duplicate submission。
- Smoke tests 全程 mock GAS、阻止 `addScore` 並封鎖其他外部 host；沒有讀寫 production leaderboard。
- 尚未驗證完整 3D 模型/WebGL gameplay、Pointer Lock、touch、audio、真實 GAS integration 或真機。

## 下一批建議工作

1. 審查 Draft PR #1 的公開內容、完整 3D gameplay 及 GitHub Pages 影響；未完成必要人工測試前不要合併。
2. 按 Supabase migration runbook 完成資料 owner/retention/import approval；先以現有獨立 staging 驗收真實流程，再決定 production cutover，唔好套用 `School Platform Production`。
3. 基於現有回歸安全網推進 Issue #3：解耦 Pointer Lock 狀態機並建立統一 input abstraction。
