# Architecture Overview

## 架構形態

本專案沒有前端 build。靜態 host 直接提供 HTML、JavaScript、GLB 和音訊；browser production 目前呼叫 GAS。`supabase/` 提供預設未啟用的 Postgres/Edge Function backend foundation。

```text
Static host
├─ index.html + js/*       → 3D client
├─ classic-2d.html         → 2D client
├─ assets/models/*.glb
└─ audio/*

Browser (`js/cloud-runtime-config.js` feature flag)
├─ jsDelivr: Three.js 0.160.0 / MathJax 3
├─ localStorage: UI/device preferences
├─ Google Apps Script (current production)
   ├─ getGameData
   ├─ getLeaderboard
   └─ addScore
└─ Supabase (獨立 hosted staging；production flag 預設關閉)
   ├─ Data API: active config + redacted leaderboard
   └─ Edge Function: score POST → service-only RPC → private schema
```

## 3D client 啟動流程

1. `index.html` 建立 UI、載入 MathJax、helpers、題庫和 import map。
2. `js/main.js` 初始化裝置/橫屏偵測，並最多等待六秒載入 GAS game data。
3. 顯示選單及 ambient Three.js 背景；背景預載 game engine 和 GLB assets。
4. 玩家填班別/學號、選難度，`main.js` 建立 `Game`。
5. `Game` 管理場景、控制、敵人、補給、數學觸發、HUD 和 game-over callback。
6. 結算由 `main.js` 顯示學習報告；玩家主動按鈕後才呼叫 `submitScore()`。

## 狀態及 ownership

| 狀態 | Owner | 保存位置 |
|---|---|---|
| 遊戲實體、HP、敵人、武器、數學統計 | `Game` | 記憶體 |
| keyboard/mouse/touch input 及 lifecycle | `input.js` | 記憶體；每局 dispose 清理 |
| 當前難度、最近結算、提交狀態 | `main.js` | module variables |
| 靈敏度、音量、輸入模式、畫質 | `main.js`/`device.js` | localStorage |
| 武器、喪屍、掉落預設值 | `config.js` | module objects；可被 GAS response 覆寫 |
| 排行榜及學生姓名 | GAS production／Supabase private schema design | Hosted ownership/retention 尚待確認 |

## 邊界

- Browser/API 邊界：GAS 是 direct legacy path；Supabase 寫入以 Edge Function 作 server boundary，browser 只持 publishable key。
- Supabase database 邊界：學生/原始成績在 unexposed private schema；public read 同時受 grants、RLS 或固定 redacted RPC 限制。
- 3D/2D 邊界：兩者是獨立 client，只有題庫檔案實際共用；其他相似邏輯多為複製。
- DOM/module 邊界：DOM IDs 充當非正式 component API，沒有型別或 runtime schema。
- 資產邊界：`assets.js` 的 `MANIFEST` 是 GLB 使用清單；目錄內變更須同步 manifest 和 credits。

## 錯誤及降級

- GAS game data 失敗：3D 最多等待六秒，然後使用本機預設；2D 亦有 fallback。
- leaderboard 失敗：顯示載入失敗或回傳空資料。
- Three.js/GLB 失敗：3D 開局中止並提示檢查網絡；2D fallback 仍可由連結開啟。
- MathJax 不存在：題目仍顯示原始 HTML/TeX 字串，排版功能降級。
- WebAudio/HTML audio 失敗：多數 catch 後靜默，不阻止 gameplay。

## 部署及 cache

- 可部署到任何能正確提供 ES Modules、GLB 和 audio MIME types 的靜態 host。
- 公開 repository 為 `chakwing528/Math-Survival`，現有 GitHub Pages 網址是 `https://chakwing528.github.io/Math-Survival/`；repository 沒有 deployment workflow，實際 Pages source/settings 尚未記錄在程式碼內。
- `?v=38` 只更新有 query 的 JS；不保證 `index.html` 本身立即失效。
- CDN 是 runtime dependency；離線或被網絡政策阻擋時 3D/MathJax 會受影響。

## 未確認邊界

- GAS handler 實作、CORS、rate limit、身份驗證、授權、資料驗證及重複提交規則。
- Supabase 學生資料 owner/retention、正式 origins、backup/recovery 及 production cutover。
- GitHub Pages 的 source/settings、cache headers、CSP 和安全 headers。
- production monitoring、backup 和 recovery。
