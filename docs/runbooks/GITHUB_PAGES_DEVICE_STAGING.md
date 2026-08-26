# GitHub Pages Device Staging

本 runbook 記錄 Issue #3／V3.10 真機驗收用的獨立公開 GitHub Pages repository。它不會改動 `chakwing528/Math-Survival` 的 `main`、production Pages 或 PR stack。

## 邊界

- Repository：`chakwing528/Math-Survival-Device-Staging`（public）。
- Pages URL：`https://chakwing528.github.io/Math-Survival-Device-Staging/`。
- 真機診斷入口：`https://chakwing528.github.io/Math-Survival-Device-Staging/?mode=touch&debug=perf`。
- 來源是 `codex/device-gate-p3` 的已審查 commit，推到 staging repository 的 `main`；不是把原 repository 的 `main` 合併或改 Pages source。
- 雲端 runtime 保持程式碼內 GAS 預設，沒有 Supabase secrets 或真實學生 fixture。
- 舊 Cloudflare preview 只作回滾參考，不再更新。

公開 staging 可被任何知道網址的人開啟。測試只用 `TEST`／`00`，不要輸入真實班別、學號、姓名或成績；真機流程不要按「上傳成績」。

## 發佈

1. 在 source branch 完成 `npm test`、cache/version 檢查及 commit。
2. 確認 source branch 已 push 到原 repository 的 Draft PR #8。
3. 將同一 commit push 到 staging repository `main`。
4. staging repository 的 Pages source 設為 `main` root；不使用會接觸 production repository Pages 的設定。
5. 等待 Pages build 完成，再驗證 `/`、`/classic-2d.html`、版本 `V3.10`、cache `?v=40`、404、console 及三種 viewport。

## 回滾

如 V3.10 staging 有問題，停止使用該 URL並修正 source branch；不要合併 production PR stack。需要回退 staging 時，只可把 staging repository `main` 更新至上一個已驗證 commit。刪除 repository、Pages site 或 production deployment 是破壞性操作，必須另行明確確認。
