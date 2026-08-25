# External API Map

## 基址

Google Apps Script Web App URL 只定義於 `js/cloud-core.js`，3D 和 2D client 共用 `MathSurvivalCloud`。完整 v1 client contract 見 `GAS_CONTRACT_V1.md`。

repository 沒有 GAS handler、OpenAPI/GraphQL schema 或 GAS server tests；`GAS_CONTRACT_V1.md` 是 client-observed contract，不是 server 保證。Supabase 本機 handler/tests 另見下節。

## Supabase v1（本機及獨立 hosted staging 已驗證，production 未啟用）

- Active config：Data API `game_config_versions`，anon 只有 active-row `SELECT` grant＋RLS。
- Leaderboard：`get_leaderboard_v1` RPC，只回傳班別、遮罩名、分數；不回傳學號／全名。
- Submit：`POST /functions/v1/submit-score`，再呼叫只授權 server role 的 `submit_score_v1`。
- 完整 headers、body、idempotency、rate limit 和 fallback 規則見 `SUPABASE_CONTRACT_V1.md`。
- Migration/rollout 見 `../runbooks/SUPABASE_MIGRATION.md`。

## Endpoints/actions

### GET `?action=getGameData&t={cacheBuster}`

- 用途：取得武器、喪屍及補給/移速設定。
- Auth：caller 不傳 credentials/token；遠端規則未知。
- Caller：`js/config.js#loadCloudConfig`；`classic-2d.html#loadGameData`。
- Request：`action`、時間/隨機 cache buster `t`。
- Response：JSON object，aliases 及 client normalization 見 `GAS_CONTRACT_V1.md`。
- Data access/handler：repository 外的 GAS。
- Error：3D boot timeout/fetch/JSON error 後用本機 defaults；2D 亦 fallback。
- Tests：unit tests 覆蓋 object/rows normalization、invalid response 和 timeout；browser smoke tests 使用 mock。

### GET `?action=getLeaderboard&t={cacheBuster}`

- 用途：取得總排行榜。
- Auth：caller 不傳 credentials/token；遠端規則未知。
- Caller：`js/leaderboard.js#fetchLeaderboard`；2D 同名功能。
- Response caller contract：array of `{diff, cls, sid, name, score}`，有長度/數值限制；invalid rows 會被捨棄。
- Handler：repository 外的 GAS。
- Error：主選單顯示載入失敗；提交後讀取失敗則使用空陣列/本機本人項目。
- Rendering：所有遠端欄位以 `textContent` 建構，不進入 HTML parser。
- Tests：3D/2D malicious-payload smoke tests。

### GET `?action=addScore&date&time&diff&cls&sid&score&t`

- 類型：有遠端寫入副作用的 GET。
- 用途：新增分數並以班別/學號配對姓名。
- Auth：caller 不傳 credentials/token；遠端規則未知。
- Caller：`js/leaderboard.js#submitScore`；2D submit function。
- Request fields：本地日期、時間、`程度 N`、大寫班別、大小寫轉換後學號、整數分數、timestamp。
- Response caller contract：可選 `{name}`；其他欄位未知。
- Error：catch 後繼續讀排行榜；UI 可能顯示本機合成紀錄，不能當作提交成功證據。
- Duplicate policy：client single-flight 防止同一時間重複 request；server idempotency 未確認。
- Tests：submission validation、single-flight、merge unit tests；browser test 確認 duplicate call 只產生一次被 block 的 `addScore`。

## 共同未知事項

- HTTP status/error body、CORS、cache headers、quota/rate limits。
- 身份驗證、角色授權、防濫用、防重播及重複提交。
- server-side validation、formula injection 防護及 output escaping。
- Google Sheet schema、transaction/locking、backup/recovery 和資料保留。

## 變更政策

- 新增或改欄位前要同時更新兩個 clients、本文件及資料私隱文件。
- POST v2 方案見 `GAS_POST_MIGRATION.md`；只能在取得 GAS handler、test deployment 和部署批准後執行。
- browser tests 不應直接寫 production leaderboard；需要測試部署或 mock layer。
- Hosted migration 已在獨立 `Math-Survival-Staging` 驗證；不可把後續 migration 直接套用 `School Platform Production` 或 production 環境。
