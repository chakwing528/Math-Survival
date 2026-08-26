# GitHub Pages Device Staging

本 runbook 記錄 Issue #3／V3.10 真機驗收用的獨立公開 GitHub Pages repository。它不會改動 `chakwing528/Math-Survival` 的 `main`、production Pages 或 PR stack。

## 邊界

- Repository：`chakwing528/Math-Survival-Device-Staging`（public）。
- Pages URL：`https://chakwing528.github.io/Math-Survival-Device-Staging/`。
- 真機診斷入口：`https://chakwing528.github.io/Math-Survival-Device-Staging/?mode=touch&debug=perf`。
- Source commit：`f9ce9d6`；staging artifact commit：`b3e0fbe`；Pages build run：`32944626578`（2026-08-26 成功）。
- 只把 source commit 的公開前端 allowlist 建成獨立 artifact 後推到 staging `main`；不是複製整個開發 repository，亦不是把原 repository 的 `main` 合併或改 Pages source。
- 雲端 runtime 保持程式碼內 GAS 預設，沒有 Supabase secrets 或真實學生 fixture。
- 舊 Cloudflare preview 只作回滾參考，不再更新。

公開 staging 可被任何知道網址的人開啟。測試只用 `TEST`／`00`，不要輸入真實班別、學號、姓名或成績；真機流程不要按「上傳成績」。

## 發佈

1. 在 source branch 完成 `npm test`、cache/version 檢查及 commit。
2. 確認 source branch 已 push 到原 repository 的 Draft PR #8。
3. 從乾淨臨時目錄建立 allowlist artifact，只包含 `index.html`、`classic-2d.html`、`404.html`、`js/`、`assets/`、`audio/`；掃描 secrets，禁止 `.git`、docs、tests、scripts、Supabase、package 或環境檔。
4. 以 noreply identity 建立 artifact commit，再推到 staging repository `main`。
5. staging repository 的 Pages source 設為 `main` root；不使用會接觸 production repository Pages 的設定。
6. 等待 Pages build 完成，再驗證 `/`、`/classic-2d.html`、版本 `V3.10`、cache `?v=40`、404、console 及三種 viewport。

## V3.10 hosted 結果

- Pages build #1 成功，HTTPS 強制開啟。
- `/` 及 `/classic-2d.html` 回應 200；`/package.json` 及 `/.git/HEAD` 回應自訂 404。
- 874×402 forced-touch medium 可進程度 1；V3.10／cache v40、簡化 HUD、隱藏武器卡、敵人 `4/4` 上限及安全放棄返回均通過，console 無 error。
- 使用 `TEST/00`，沒有觸發成績上傳。真實 iPhone 10 分鐘效能、Math、Game Over及 audio仍須人工驗收。

## 回滾

如 V3.10 staging 有問題，停止使用該 URL並修正 source branch；不要合併 production PR stack。需要回退 staging 時，只可把 staging repository `main` 更新至上一個已驗證 commit。刪除 repository、Pages site 或 production deployment 是破壞性操作，必須另行明確確認。
