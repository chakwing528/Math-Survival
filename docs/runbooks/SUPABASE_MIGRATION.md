# GAS → Supabase Migration Runbook

## 已完成的本機基礎

- Supabase CLI 固定為 `2.115.0`，Postgres major version 17。
- Migration、synthetic seed、18 項 pgTAP security tests 及 database lint 已在本機通過。
- Edge Function 已用 synthetic fixture 驗證 accepted、idempotent duplicate、origin rejection。
- Browser publishable key 可讀 active config／redacted leaderboard，但直呼 submit RPC 被拒。
- 前端 adapter 和 GAS feature flag 已加入；production 預設仍為 GAS。

## Hosted project 前置決策

目前帳戶見到 `School Platform Production` 和另一個停用 project，但未有證據證明 Math Survival 應直接共用 production database。套用 migration 前由 owner 確認：

1. 使用獨立 Supabase project，還是由 `School Platform Production` 管理。
2. 學生目錄的資料 owner、獲授權管理者及匯入來源。
3. 成績、requester hash、姓名 snapshot 的保留期、刪除、更正及匯出流程。
4. 公開排行榜是否只顯示班別＋遮罩名；目前程式採最小公開資料預設。
5. 正式 GitHub Pages origin、測試 origin，以及 incident/backup/rollback owner。

## 本機驗證

```bash
npm ci
npm run supabase:start
npm run test:db
npm run lint:db
npm test
```

本專案使用 55320–55329，避免與現有 school-platform 本機 stack 的 54320–54329 衝突。`supabase/seed.sql` 只能放明確 synthetic fixture。

## Hosted rollout

1. 建立獨立 staging project 或確認指定現有 project；不要先對 production 試 migration。
2. 設定 allowed origins、publishable key、獨立 function secret key及 random rate-limit salt。
3. 套用 migration，執行 Supabase security/performance advisors；所有 findings 要處理或記錄理由。
4. 只匯入經 owner 批准的學生目錄欄位；不要把真實資料加入 repository、logs 或 fixtures。
5. 部署 `submit-score`，以測試帳戶／合成資料做 read、submit、duplicate、rate-limit、CORS 驗收。
6. 把 staging client 設為 `provider: 'supabase'`；核對 3D/2D config、排行榜、提交及失敗 UI。
7. Production 先切 reads，再切 writes；保留 GAS rollback flag，但 mutation 不做自動 dual-write。
8. 觀察期完成才封存 GAS；封存前匯出、核對、刪除權限和 rollback snapshot。

## Rollback

前端把 `provider` 改回 `gas` 即恢復舊 read/write client。若 Supabase write 已可能成功，不可在同一次 request 自動重交 GAS；應先用 receipt/idempotency audit 判斷，再由 owner 決定補寫。Database migration 不應直接 destructive rollback；先停用 function／key、保存 audit evidence，再用經審核的新 migration 修正。
