# External API Map

## 基址

Google Apps Script Web App URL 硬編碼於 `js/config.js` 和 `classic-2d.html`。完整部署 ID 不在本文件重複；修改時必須同步兩處，或先集中為共用設定。

repository 沒有本機 handler、OpenAPI/GraphQL schema 或 server tests。

## Endpoints/actions

### GET `?action=getGameData&t={cacheBuster}`

- 用途：取得武器、喪屍及補給/移速設定。
- Auth：caller 不傳 credentials/token；遠端規則未知。
- Caller：`js/config.js#loadCloudConfig`；`classic-2d.html#loadGameData`。
- Request：`action`、時間/隨機 cache buster `t`。
- Response：JSON object，可能包含 weapons/monsters 二維 rows；精確 schema 未定義。
- Data access/handler：repository 外的 GAS。
- Error：3D boot timeout/fetch/JSON error 後用本機 defaults；2D 亦 fallback。
- Tests：無。

### GET `?action=getLeaderboard&t={cacheBuster}`

- 用途：取得總排行榜。
- Auth：caller 不傳 credentials/token；遠端規則未知。
- Caller：`js/leaderboard.js#fetchLeaderboard`；2D 同名功能。
- Response caller contract：array of `{diff, cls, sid, name, score}`。
- Handler：repository 外的 GAS。
- Error：主選單顯示載入失敗；提交後讀取失敗則使用空陣列/本機本人項目。
- Tests：無。

### GET `?action=addScore&date&time&diff&cls&sid&score&t`

- 類型：有遠端寫入副作用的 GET。
- 用途：新增分數並以班別/學號配對姓名。
- Auth：caller 不傳 credentials/token；遠端規則未知。
- Caller：`js/leaderboard.js#submitScore`；2D submit function。
- Request fields：本地日期、時間、`程度 N`、大寫班別、大小寫轉換後學號、整數分數、timestamp。
- Response caller contract：可選 `{name}`；其他欄位未知。
- Error：catch 後繼續讀排行榜；UI 可能顯示本機合成紀錄，不能當作提交成功證據。
- Tests：無。

## 共同未知事項

- HTTP status/error body、CORS、cache headers、quota/rate limits。
- 身份驗證、角色授權、防濫用、防重播及重複提交。
- server-side validation、formula injection 防護及 output escaping。
- Google Sheet schema、transaction/locking、backup/recovery 和資料保留。

## 變更政策

- 新增或改欄位前要同時更新兩個 clients、本文件及資料私隱文件。
- 建議把 mutating action 改為 POST 並使用明確 JSON schema，但只能在取得 GAS handler 和部署批准後設計。
- browser tests 不應直接寫 production leaderboard；需要測試部署或 mock layer。

