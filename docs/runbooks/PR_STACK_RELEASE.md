# PR Stack Release Gate

本 runbook 處理 Issue #3 疊加 PR 的合併前驗證、逐層合併及回滾。它不代表已批准合併；任何 merge 或 GitHub Pages 發佈都要由專案負責人另行確認。

## 目前 stack

| 次序 | PR | Base → head | 審查基準 SHA |
|---|---|---|---|
| 1 | #1 | `main` → `codex/project-memory-v3.3` | `c471996474cf1d3961bcd34c763380a60a833968` |
| 2 | #5 | `codex/project-memory-v3.3` → `codex/input-state-machine-p1` | `0fc30f34a56d1576f26537f10f61a379a96e789a` |
| 3 | #7 | `codex/input-state-machine-p1` → `codex/touch-controls-p2` | `6fea10b7a850b4d9b478464a1bf17be64bae143e` |
| 4 | #8 | `codex/touch-controls-p2` → `codex/device-gate-p3` | `ac9cb5c56c3449eade4bcc27174e86a29dfc1fe7` |

2026-08-26 盤點時四個 PR 都是 open Draft、GitHub 顯示 clean／mergeable。`main` 基準為 `ff2277da21f31dbc03d370b1de6e3803c2214878`；實際合併前必須重新取得最新 SHA、diff、checks 和 mergeability，不能只依賴本表。

## 合併前必須通過

- `npm test` 全部通過；hosted staging smoke 只有在沒有 secrets 時才可按設計 skipped。
- 啟動本機 Supabase 後，`npm run test:db` 及 `npm run lint:db` 通過，再關閉本機 stack。
- `docs/testing/DEVICE_ACCEPTANCE.md` 的 iPhone Safari、Android Chrome、iPad Safari 三行全部有實際型號／版本／日期及通過結果。
- PR head SHA 與已審查 SHA 一致；任何新 commit 都要重新跑 checks 和關鍵 smoke。
- 沒有 `.env`、secret／service-role key、學生資料、排行榜畫面或個人資料進入 diff、log、fixture、Issue 或 screenshot。
- Production runtime 仍是 GAS；Supabase URL／publishable key 保持空白或 feature flag 關閉。Supabase production cutover 另受資料 owner、retention、import approval 及 endpoint abuse model 審批限制。
- GitHub Pages source／branch、required checks 及實際發佈行為已由有權限帳戶確認。2026-08-26 的未認證 API 只能確認歷來 deployment 來自 `main`，不能完整讀取 Pages／branch protection 設定。

任何一項未通過即停止。真機未完成時可繼續 review Draft PR，但不可宣稱 Issue #3 完成或開始合併 stack。

## 安全合併次序

1. 記錄合併前 `main` SHA，建立可追溯 release tag 或保留明確 rollback SHA。
2. 重新審查 PR #1。這個 PR 是大型基線匯入（盤點時 88 files），亦包含既有 trailing-whitespace；不要在 release gate 進行全倉格式化。確認 checks 後以 **merge commit** 合併。
3. 等待 CI 及 GitHub Pages 完成；實測 `/`、`/classic-2d.html`、版本標籤和 `?v=38` cache key。任何失敗即停止，不要繼續下一層。
4. Fetch 最新 `main`，確認 PR #5 的 diff 仍只包含該層內容；必要時把 base 改為 `main`。再次 review／checks 後以 merge commit 合併。
5. 對 PR #7、#8 逐一重複第 3–4 步。每次只處理一層，不能一次按下四個 merge。
6. PR #8 通過發佈 smoke 且三類真機記錄完整後，才可關閉 Issue #3。

疊加 PR 不應逐層使用 squash 或 rebase merge：它們會失去父層 commit ancestry，令下一層比較範圍膨脹或混入已合併內容。若團隊決定使用 squash，必須先逐層 rebase／重建 child branch 和重新審查完整 diff，不能沿用上述快速流程。

## 每層發佈後檢查

- GitHub checks 全綠，Pages deployment 指向預期的 `main` commit。
- 3D 首頁和 2D fallback 都能載入；無 JavaScript error、黑屏或永久 loading。
- Production 雲端仍走 GAS；沒有意外啟用 Supabase mutation 或 staging URL。
- 排行榜顯示只作人工功能確認；不得把實際內容複製到 Issue／log／screenshot。
- 若 HTML cache 暫時顯示舊版，先確認 deployment SHA，再用 reload 驗證，不能立即把它誤判為程式回歸。

## 回滾

- 尚未合併：保持 Draft／關閉 PR 即可，無 production 回滾動作。
- 已合併但未開始下一層：以新 PR **revert 該 merge commit**，通過 checks 後合併；不要 force-push、reset 或改寫 `main`。
- 多層已合併：由最新一層開始，按 #8 → #7 → #5 → #1 反向逐個 revert merge commit，每層都等待 CI／Pages。
- Supabase migrations 不以 destructive rollback 處理。Production 預設仍為 GAS；若將來另行批准 cutover，必須使用 `docs/runbooks/SUPABASE_MIGRATION.md` 的獨立 rollback／data handling 流程。

## 2026-08-26 gate 結果

- iPhone 17 Pro／Safari 的 V3.7 真機驗收發現選單未縮放、像素化及約 10 秒後 lag，因此先前 conditional pass 已被真機結果擋下。iOS／Safari 版本待補。
- V3.8 iPhone P0 修正候選已通過 15 個 smoke cases（另 2 個 hosted-staging cases 按設計 skipped）；Cloudflare deployment `e9b0d989` 的 3D／2D、874×402 UI、診斷列及嚴格 404 亦通過。仍須同一部 iPhone 17 Pro 完成 10 分鐘重測，才可合併。
- `npm test`：12 passed、2 hosted-staging cases 因無 secrets 按設計 skipped；static 及 20 unit tests 通過。
- 本機 Supabase：18 pgTAP tests 通過；`public`、`math_survival_private` lint 無錯誤。
- 844×390 forced-touch 瀏覽器：3D 戰場和 touch HUD 載入，無 console error；只用 `TEST/00`，沒有上傳成績。
- LAN server：`/` 和 `?mode=touch` 回應 200，`/.git/HEAD` 回應 404；server 測試後已停止。
- Cloudflare branch preview：3D／2D 載入、五組 touch control、pause／安全退出、自訂 404 及 console error 檢查通過；只用 `TEST/00`，沒有上傳成績。詳見 `docs/runbooks/CLOUDFLARE_DEVICE_PREVIEW.md`。
- 結論：自動、本機及 Cloudflare preview 安全閘通過；三類真機記錄、GitHub Pages／branch protection 權限確認仍未完成，因此目前是 **conditional pass，不可合併**。
