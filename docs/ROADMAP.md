# Overhaul Roadmap

本路線圖用於安全基線納入 `main` 前後的大規模重整。原則是先建立安全網，再拆分架構；每個階段應使用獨立 branch／Pull Request，避免一次改動所有 gameplay、UI、資料和部署。

## 全程原則

- 不使用真實學生資料作測試；不直接向 production GAS 寫入 smoke-test 紀錄。
- 每個 PR 只處理一個可驗證結果，並同步相關 `docs/`。
- 先寫 characterization tests 或記錄現有行為，再搬動高風險程式。
- 任何 `main` 合併前都要確認 GitHub Pages 影響和 rollback 方法。
- 修改已帶 `?v=40` 的前端模組時，同步更新 cache key 和畫面版本。

## Phase 0 — 建立可重現基線

**狀態（2026-08-25）**：已完成。Draft PR #1 的本機 `npm test` 及 GitHub Actions Linux run 均通過。

**結果**：任何人可用一致指令驗證語法、文件和兩個遊戲入口。

- 加入最小 `package.json` 或等效 task runner。
- 建立 JS syntax、JSON、Markdown link、cache-version 檢查。
- 建立不連 production GAS 的 3D／2D browser smoke tests。
- 加入 GitHub Actions，但先確認 Pages workflow/source 不會被改寫。

**完成條件**：乾淨 clone 可一個指令跑完靜態檢查；browser tests 使用 mock／攔截 GAS。

## Phase 1 — 安全及資料邊界

**狀態（2026-08-25）**：Supabase 本機 foundation 及獨立 hosted staging rollout 已完成，migration/RLS/Edge/HTTP/3D/2D tests 通過；production GAS 未切換，資料 owner／retention／真實匯入及 cutover仍待決定。

**結果**：學生資料、排行榜和雲端設定有明確 contract 及安全處理。

- 取得 GAS handler、owner、schema、權限及資料保留政策。
- 把班別、學號和成績由 GET query string 遷移到經驗證的 POST schema。
- 已移除不可信排行榜資料直接進入 `innerHTML` 的路徑；維持 regression tests。
- 加入 timeout、錯誤類型、重試／去重策略及測試環境。

**完成條件**：API contract 有版本和測試；production／test endpoint 分離；資料政策有記錄。

## Phase 2 — 輸入及遊戲狀態機

**狀態（2026-08-25）**：Batch 1／2 程式及 browser 階段完成。最後裝置閘已加入 iPhone WebKit、Android Chromium、iPad WebKit 自動矩陣、autoplay rejection 及真機 runbook；Issue 仍待三類實機的 safe-area、音訊、多指及 10 分鐘長局記錄才可關閉。

**結果**：desktop、touch、Pointer Lock、pause/resume 共用一致狀態模型。

- 抽出 `js/input.js`，統一鍵盤、滑鼠、touch 和虛擬控制。
- 將 Pointer Lock 由遊戲狀態轉換中解耦。
- 完成 touch look、移動、射擊、換彈、近戰、瞄準及暫停。
- 為狀態轉換及輸入 mapping 加測試。

**完成條件**：desktop 和 touch 完成同一核心玩法；離開／重入畫面不會卡死或殘留 listener。

## Phase 3 — 拆分大型 runtime

**結果**：約 3,000 行的 `js/game.js` 變成職責清晰、可獨立測試的 subsystem。

- 分離 lifecycle/state、player、combat、enemy AI、world、loot、HUD 及 effects。
- 明確建立／銷毀 ownership，清理 animation frame、listener、audio、texture 和 Three.js object。
- 保留公開介面，逐個 subsystem 搬移，避免 big-bang rewrite。

**完成條件**：`game.js` 只負責組裝；核心規則可在無 WebGL 環境測試；重開遊戲沒有資源累積。

## Phase 4 — 統一 3D／2D 共用領域邏輯

**結果**：兩個 client 共用設定、題目、計分、學習報告及排行榜 contract。

- 把 `classic-2d.html` 內重複邏輯移到共用 modules。
- 建立純函數形式的題目選擇、計分、combo、難度和報告模型。
- 保留 renderer/input 差異；不要強行把 Canvas 和 Three.js runtime 合併。

**完成條件**：同一資料輸入在 2D／3D 得到一致結果；共用規則只有一個來源。

## Phase 5 — 效能、資產及離線韌性

**結果**：首次載入、手機記憶體和弱網絡體驗可量度並改善。

- 建立載入時間、FPS、記憶體及模型大小基線。
- 壓縮／簡化約 19 MB GLB；按需要延遲載入。
- 檢查 texture/material 共用與 dispose；改善 loading progress 和 fallback。
- 檢視 CDN、cache headers、CSP、版本策略及基本離線降級。

**完成條件**：定義的測試裝置達到效能預算；資產授權及來源仍可追蹤。

## Phase 6 — UX、可用性及正式發布

**結果**：完整流程對學生和教師清晰、可恢復、可觀察。

- 重整登入／難度／教學／戰鬥／答題／結算流程。
- 改善鍵盤、touch、色彩、字體、focus、reduced motion 和錯誤提示。
- 加入不含個人資料的錯誤／效能觀測方案。
- 建立 release checklist、版本標記、Pages smoke test 和 rollback runbook。

**完成條件**：桌面及指定手機完成驗收；私隱、安全、效能、無障礙和發布 checklist 全部通過。

## 建議執行順序

`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6`

Phase 1 可在 Phase 0 後與 Phase 2 的 UI-free 工作有限度並行；Phase 3 前必須有足夠 smoke tests，Phase 6 必須以之前各階段的穩定介面為基礎。
