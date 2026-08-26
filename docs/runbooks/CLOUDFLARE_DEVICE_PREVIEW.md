# Cloudflare Device Preview

本 runbook 記錄 Issue #3 真機驗收用的獨立 Cloudflare Pages Direct Upload preview。它不是 GitHub Pages production、不是 Supabase staging，也不代表已批准合併 PR stack。

## 現有 preview

- Project：`math-survival-device-staging`
- Branch：`device-gate-p3`
- 固定 branch URL：`https://device-gate-p3.math-survival-device-staging.pages.dev/`
- 本次版本 URL：`https://eeec2186.math-survival-device-staging.pages.dev/`
- 本次程式碼 SHA：`ac9cb5c56c3449eade4bcc27174e86a29dfc1fe7`
- 真機入口：`https://device-gate-p3.math-survival-device-staging.pages.dev/?mode=touch`

Project 的 production branch 是 `main`，但沒有 production deployment、custom domain 或 GitHub integration。Branch URL 會指向同名 branch 最近一次上傳；版本 URL 則保留本次 deployment。

## 公開及資料邊界

- Preview URL 可被知道網址的人開啟；Cloudflare preview 的 `noindex` header 只阻止一般搜尋索引，不是登入或存取控制。
- 現有前端 runtime 保持 GAS 預設，所以 preview 可讀 production leaderboard；它沒有啟用 Supabase staging。
- 真機測試只可使用 `TEST`／`00`，並在結算前「放棄本局，返回主選單」。如意外進入結算，不能按「上傳成績」。
- 不可在 log、Issue、文件或 screenshot 記錄真實學生資料或排行榜內容。
- 本次 artifact 沒有 `.git`、`node_modules`、`docs`、`tests`、`scripts`、`supabase`、package metadata、環境檔或 secret；只包含下方 allowlist 及自訂 `404.html`。

## Direct Upload allowlist

每次部署都應由乾淨的臨時目錄建立 artifact，只複製：

```text
index.html
classic-2d.html
js/
assets/
audio/
404.html
```

`404.html` 必須是獨立的嚴格 404 頁。沒有它時，Cloudflare Pages 會把未知路徑視作 SPA route 並回傳 `index.html`；部署後必須重新檢查 `/package.json` 及 `/.git/HEAD` 顯示 404 頁而非遊戲。

部署前檢查：

1. `git status --short --branch`，記錄要驗收的 commit SHA。
2. 確認 artifact 沒有 dotfile、環境檔、SQL、package metadata 或未列入 allowlist 的檔案。
3. 掃描 secret／service-role／private key pattern；註解中的禁用規則可以保留，但任何實際 credential 都必須停止部署。
4. 確認每個檔案小於 Cloudflare Pages 的單檔上限，並保留自訂 `404.html`。
5. 用 Wrangler 登入正確 Cloudflare 帳戶後執行：

```bash
npx wrangler pages deploy <artifact-directory> \
  --project-name math-survival-device-staging \
  --branch device-gate-p3 \
  --commit-hash <full-git-sha> \
  --commit-message "Issue #3 device preview"
```

不要對 `main` 執行 preview deploy，也不要在本 runbook 記錄帳戶 token、API key 或 account ID。

## 每次上傳後驗證

- Branch URL 和新版本 URL 都能載入 3D 主頁；顯示 `Math Survival FPS V3.8`。
- `?mode=touch` 橫屏可進入程度 1，移動、瞄準、換彈、開火、近戰和暫停控制都存在。
- 暫停後可放棄本局並返回主選單，測試過程沒有按上傳成績。
- `/classic-2d.html` 可載入 2D fallback。
- `/package.json` 及 `/.git/HEAD` 顯示自訂 404，沒有回傳遊戲或檔案內容。
- Browser console 沒有 error。
- 完成 `docs/testing/DEVICE_ACCEPTANCE.md` 的三類真機記錄前，Issue #3、PR #8 及整個 stack 仍保持 open Draft／conditional pass。

## 清理及回滾

Direct Upload preview 不改 repository、GitHub Pages 或 `main`。如新 deployment 有問題，停止使用 branch URL，改用上一個已驗證的版本 URL，修正 artifact 後再上傳。刪除 deployment 或整個 Cloudflare project 是破壞性外部操作，必須另行明確確認。
