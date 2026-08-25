# Cloud Config and Leaderboard

## 範圍

兩個 client 經 `js/cloud-core.js` 的共用 `MathSurvivalCloud` boundary 呼叫同一個外部 Google Apps Script URL。repository 只包含 caller，沒有 GAS handler 或 Google Sheet schema。

## Cloud game data

`js/config.js` 定義本機 `WEAPONS`、`MONSTER_BASE` 和 `SETTINGS`。`loadCloudConfig()` 成功後原地覆寫部分數值。

接受的 response keys：

- 武器：`weapons`、`Weapons`、`設定武器`。
- 喪屍：`monsters`、`Monsters`、`設定魔物`。

程式按二維 rows 的位置讀取名稱、傷害、子彈、fire rate、速度、彈藥及補給間隔。這是非正式 schema；實際欄名和 sheet ownership 未確認。

每個 cloud request 最多等待六秒；3D/2D 失敗時使用本機預設值。兩個 client 仍各自套用 gameplay config，但共用 response normalization。

## Leaderboard

`js/leaderboard.js` 負責 3D 版：

- `fetchLeaderboard()`：讀取列表。
- `renderLeaderboard()`：顯示排名、班別、姓名/學號、分數和難度。
- `submitScore()`：提交班別、學號、日期、時間、難度和分數；以 response `name` 配對學生姓名，再重新讀取排行榜。

2D 版在 `classic-2d.html` 保留 UI orchestration，但 request、validation、merge 和安全 renderer 共用 `MathSurvivalCloud`。

## Invariants

- 主選單的班別和學號必須非空；這只是 client validation，不是 authentication。
- 顯示和配對前會把 `cls`/`sid` 轉大寫。
- 最終分數是 `round(kills × difficulty multiplier)`。
- 上傳只在玩家按結算按鈕後發生。
- 若最新排行榜沒有剛提交項目，client 會加入一個本機 `isMe` item，並不證明遠端寫入成功。

## 風險

- `addScore` 使用有寫入副作用的 GET；班別/學號會出現在 URL。
- caller 沒有 credentials、signature 或 anti-replay token；遠端是否驗證未知。
- 沒有正式 request/response schema 或 HTTP status handling。
- Client 已用 `textContent` 安全建構 leaderboard，並限制欄位長度/分數；server output escaping 仍未知。
- Client 對 submission 使用 single-flight，但 server 沒有已確認的 idempotency key、receipt 或可靠成功狀態。
- Read 失敗靠下一次 leaderboard polling 自然重試；mutation 不自動 retry，避免重複寫入。

## 修改前要求

1. 取得 GAS handler 原始碼和部署 ownership。
2. 記錄 sheet/tab schema、欄位型別、validation、duplicate policy 和 error responses。
3. 確認 authentication/authorization、CORS、rate limit 和 abuse prevention。
4. 確認學生資料的收集目的、保留期、刪除/更正及存取人員。
5. 使用測試資料和獨立測試部署；不要對 production 提交真實/假學生紀錄作 smoke test。

Client v1 contract 見 `../api/GAS_CONTRACT_V1.md`；POST migration 見 `../api/GAS_POST_MIGRATION.md`。
