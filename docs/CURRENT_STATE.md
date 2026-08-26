# Current State

更新基準：2026-08-26，以目前 workspace 程式碼為準。

## 當前版本

- 畫面版本：Math Survival FPS V3.9。
- ES Module/cache query：`?v=39`，目前所有已加版本的 imports 一致。
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

- Issue #3 Batch 2 已加入完整 3D touch HUD：虛擬搖桿、touch look、按住開火、toggle 瞄準、換彈、近戰及暫停。
- `js/input.js` 的 `TouchControlSurface` 以 pointerId 分開 move/look/fire，可同時多指操作；搖桿推盡向前會疾跑。
- Pointer Lock 只負責 desktop control acquisition；`pause()`/`resume()`、數學題回復及 visibility pause 已與它解耦。
- touch 暫停、visibility loss、resume 及 dispose 會清除 movement/fire/aim/look，避免殘留 listener 或卡住輸入。
- Playwright 已加入 iPhone 13 WebKit、Pixel 7 Chromium 及 iPad WebKit 裝置閘；真機完成規則及可信任 Wi-Fi 測試方法見 `docs/testing/DEVICE_ACCEPTANCE.md`。
- Issue #3 已有獨立 Cloudflare Pages Direct Upload preview；只有前端 allowlist，沒有 GitHub integration、production deployment、環境檔或 backend secrets。使用及重建方法見 `docs/runbooks/CLOUDFLARE_DEVICE_PREVIEW.md`。
- V3.8 iPhone P0 修正候選已完成本機階段：touch 選單改為單欄並隱藏桌面側欄；874×402 橫屏 HUD 重新排位；medium 畫質改為 DPR 1.35／最低 1.0，同時減少草木與碎片；HUD／雷達／羅盤、威脅提示和第三身相機 raycast 已節流並重用暫存向量。`?debug=perf` 可顯示 FPS、實際 DPR、tier、viewport 與 draw calls。
- V3.9 修正 iPhone 拾取答題包後停在 `MATH` 的 P0：Three.js `PointerLockControls.unlock()` 在 iOS 缺少 `document.exitPointerLock()` 時會於題目顯示前拋錯。現在答題流程先同步建立 overlay，再只於確實 locked 時安全 unlock；題目建立失敗會回到 `RESUME_WAIT` 並重新投放補給。
- 橫屏 touch 答題框已加入 safe-area、viewport 邊界、六欄 numpad 及最少 44px 操作鍵；MathJax 失敗不再阻塞題目，dispose／重複觸發會清除 timer、keydown 及延遲 callback。
- 學校場景沒有樓梯重力/探地及跨樓層喪屍尋路。
- 19 MB 模型未壓縮。
- 已有靜態驗證、Playwright browser smoke tests 及非部署 GitHub Actions CI；仍沒有 lint、type check 或正式 build。

## 已知文件／設定問題

- Git 歷史及 `origin` 已於 2026-08-25 恢復；`origin` 是公開 repository `chakwing528/Math-Survival`，預設分支為 `main`。
- PR #1 的 V3.5 文件／安全基線仍未合併；V3.6 Issue #3 Batch 1 在 PR #5，V3.7 Batch 2 在 PR #7，自動裝置閘、V3.8/V3.9 iPhone P0 修正及合併準備在 PR #8；四層都保持 Draft，避免直接改動 GitHub Pages。
- Draft PR #1 由 `codex/project-memory-v3.3` 指向 `main`；目前可合併但仍保持 Draft，未改動正式網站。
- 大規模重整路線圖見 `docs/ROADMAP.md`；Issue #4（測試/CI 基線）已完成，後續首輪工作為 #2（GAS/學生資料安全邊界）及 #3（desktop/touch 輸入與狀態機）。
- `.claude/launch.json` 已改為本機可用的 `python3` 和相對工作目錄，但仍需由實際 launcher 驗證。
- 模型授權不是全部 CC-BY 3.0；個別授權以 `assets/models/credits.txt` 為準。
- Hosted staging 已選用另一帳戶的獨立 Free project `Math-Survival-Staging`（ref `mtwhanvpaqgdlhbxzyhu`，Tokyo）；未使用 `School Platform Production`。真實資料 owner、retention、匯入批准及 production cutover 仍待確認。
- Cloudflare Pages project `math-survival-device-staging` 只用作 Issue #3 公開 preview；production branch 設為 `main` 但未部署，亦沒有自動連接 GitHub。preview 仍使用程式碼內預設 GAS runtime，不是 Supabase staging。
- Legacy `addScore` 仍以 GET 傳送班別/學號；POST v2 只完成本機 contract/遷移設計，未改 production。

## 驗證狀態

- 2026-08-26：V3.9 答題包候選的 static、23 unit tests 及單線完整 Playwright matrix 通過；browser 結果為 18 passed、2 hosted-staging skipped，iPhone WebKit／Android Chromium／iPad WebKit 均驗證「無 Pointer Lock API → 題目可見 → 答錯解釋 → 返回 PLAYING」及答題框不越界。這仍不等於真實 iPhone 通過。
- 2026-08-26：V3.8 Cloudflare deployment `e9b0d989` 已驗證 3D／2D 200、敏感路徑自訂 404、874×402 單欄選單、完整 touch HUD及效能診斷列；browser console 無 error，測試只用 `TEST/00` 且沒有上傳成績。真實 iPhone 17 Pro 仍待重測。
- 2026-08-26：iPhone 17 Pro／Safari 真機先發現選單未縮放、3D 像素化、移動約 10 秒後 lag，其後再發現拾取答題包即卡死且題目不彈出；iOS／Safari 版本待補。V3.8/V3.9 自動修正候選仍須在同一部 iPhone 重測，不能當作真機通過。
- 2026-08-26：PR #1／#5／#7／#8 最近一次查詢都顯示 clean／mergeable；V3.9 static、23 unit tests 及 18 browser tests 全通過，2 個 hosted-staging cases 因無 secrets 按設計 skipped。本機 Supabase 18 pgTAP tests 與兩個 schema lint 亦曾通過。
- 2026-08-26：844×390 forced-touch 本機瀏覽器成功載入 3D HUD且無 console error；LAN 首頁／touch URL 200、dotfile 404。三類實際裝置仍未驗收，所以 PR stack gate 只屬 conditional pass，詳細次序及回滾見 `docs/runbooks/PR_STACK_RELEASE.md`。
- 2026-08-26：Cloudflare branch preview 已載入 3D／2D；forced-touch 3D 可進場、顯示移動／瞄準／換彈／開火／近戰及暫停控制，並可放棄本局安全返回。自訂 `404.html` 阻止 `package.json` 及 `.git/HEAD` soft fallback，瀏覽器 console 無 error，測試沒有上傳成績。
- 2026-08-25：V3.7 static、20 個 unit tests、6 個 desktop Chromium smoke，以及 iPhone／Android／iPad 6 個裝置閘案例通過（`npm test` 共 12 passed、2 個 hosted staging cases 無 secrets 時按設計 skipped）；實際 touch 3D/WebGL HUD、戰鬥鍵、pause/reset/resume 亦已驗證。
- Node unit tests：23 tests passed；cloud/Supabase 13 個，input/lifecycle/touch/math-entry 10 個。
- Supabase pgTAP：18 tests passed；database lint 0 errors；local HTTP 驗證 read 200、direct submit 401、Edge accepted/duplicate 200、bad origin 403。
- Hosted staging：兩個 migrations、`submit-score` Edge Function 及四個 project secrets 已部署；read、redaction、direct-write denial、CORS、idempotency 及 5/min rate limit 全部通過。3D／2D staging smoke tests 2 passed，沒有 GAS fallback。
- Hosted advisors 無 error；private tables 的 no-policy INFO、固定遮罩 leaderboard `SECURITY DEFINER` WARN 及 staging unused-index INFO 均為已記錄的刻意設計／低流量狀態。
- Playwright browser matrix：desktop Chromium 6 個及三個 touch profiles 各 4 個，共 18 tests passed；涵蓋 3D/2D 啟動、雲端隔離、惡意排行榜、duplicate submission、手機 UI／畫質、答題包及 lifecycle。
- Smoke tests 全程 mock GAS、阻止 `addScore` 並封鎖其他外部 host；沒有讀寫 production leaderboard。
- 已在桌面瀏覽器載入完整 3D 模型/WebGL，並以 forced touch 驗證 pause 時模擬停止、resume 後恢復；Pointer Lock 因預覽環境限制仍需真實 desktop browser／真機驗收。

## 下一批建議工作

1. 用獨立 Cloudflare preview 完成 `docs/testing/DEVICE_ACCEPTANCE.md` 三類真機記錄，再依 `docs/runbooks/PR_STACK_RELEASE.md` 逐層合併；未完成必要人工測試前不要合併。
2. 按 Supabase migration runbook 完成資料 owner/retention/import approval；先以現有獨立 staging 驗收真實流程，再決定 production cutover，唔好套用 `School Platform Production`。
3. 依 `docs/testing/DEVICE_ACCEPTANCE.md` 完成 Issue #3 實機記錄：iPhone Safari、Android Chrome、iPad 的 safe-area、多指、audio/autoplay 及 10 分鐘核心玩法；全部通過後才關 Issue。
