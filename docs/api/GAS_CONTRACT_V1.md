# GAS Client Contract v1

狀態：2026-08-25 接受，適用於 Math Survival V3.4 client。

本文件描述 repository 內 client 會送出及接受的資料，不代表未取得原始碼的 Google Apps Script handler 已提供相同 server-side 保證。正式 server contract 仍需由 GAS owner 確認。

## 共用 transport

- Base URL：只定義於 `js/cloud-core.js`；兩個 client 由 `MathSurvivalCloud.GAS_URL` 讀取。
- Transport：目前三個 action 都沿用 GET，以維持 production handler 相容性。
- Credentials：`omit`；client 不傳 cookie、token 或 signature。
- Timeout：每個 request 預設 6 秒，由 `AbortController` 中止。
- Cache buster：每個 request 帶 `t`。
- 自動 retry：沒有。排行榜的 5 秒輪詢會自然重試讀取；有副作用的 `addScore` 不可自動 retry，避免重複寫入。
- Client error codes：`NO_FETCH`、`INVALID_ACTION`、`HTTP_ERROR`、`INVALID_JSON`、`TIMEOUT`、`NETWORK_ERROR`、`INVALID_GAME_DATA`、`INVALID_LEADERBOARD`、`INVALID_SUBMISSION`。

## `getGameData`

Request query：

```text
action=getGameData&t={cacheBuster}
```

Accepted top-level response：JSON object。

- 武器 aliases：`weapons`、`Weapons`、`設定武器`。
- 魔物 aliases：`monsters`、`Monsters`、`設定魔物`。
- Client 會正規化為 `{ weapons, monsters }`。
- 每組最多 100 rows、每 row 最多 16 cells、每 string cell 最多 160 characters。
- Cell 只接受 finite number、boolean 或 string；object/function 等其他值改為空字串。
- 缺少 rows 會變成空 array，client 保留本機 defaults。

精確欄位位置仍由現有 `config.js` 和 `classic-2d.html` parser 定義；server header/schema 尚未確認。

## `getLeaderboard`

Request query：

```text
action=getLeaderboard&t={cacheBuster}
```

Response 必須是 JSON array。Client 最多處理首 100 items；非 object 或 score 無效的 rows 會被捨棄。

| Field | Client type/rule |
|---|---|
| `diff` | string，最多 32 characters |
| `cls` | string，最多 16 characters |
| `sid` | string，最多 32 characters |
| `name` | string，最多 64 characters |
| `score` | finite number／numeric string，四捨五入整數，範圍 0–1,000,000 |
| `isMe` | 只有 literal `true` 才視為 true；主要由 client 本機標記 |

所有遠端文字都以 `textContent` 建構 DOM，不會解讀為 HTML。

## `addScore`（legacy compatibility）

目前 request：

```text
action=addScore
&date={zh-HK local date}
&time={zh-HK local time}
&diff=程度 {1..5}
&cls={upper-case class}
&sid={upper-case student id}
&score={integer 0..1000000}
&t={timestamp}
```

Client submission validation：

- `cls` 必填、trim、upper-case、最多 16 characters。
- `sid` 必填、trim、upper-case、最多 32 characters。
- difficulty 只接受 `1`–`5`。
- score 必須在 0–1,000,000，送出前四捨五入。
- 同一 client 同時只允許一個 submission promise；重複 click 共用同一個 request。

Response 可為 JSON object；client 只接受最多 64 characters 的 `name`，其他欄位忽略。Request 失敗後 client 仍可顯示本機合成排名，不能視為 server receipt。

## 安全及測試邊界

- `tests/unit/cloud-core.test.js` 驗證資料限制、無效 response、timeout、single-flight 及 merge 行為。
- `tests/smoke/app.spec.js` 驗證 3D/2D 惡意 HTML payload 不會建立 DOM element 或執行 script。
- Smoke tests mock GAS、block `addScore` 並封鎖其他外部 host，不接觸 production 資料。
- Server-side authentication、authorization、rate limit、formula injection、idempotency 和資料保留仍未確認。
