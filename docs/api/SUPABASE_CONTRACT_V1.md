# Supabase Contract V1

## Status

本 contract 已在隔離本機 Supabase stack 驗證，尚未套用到任何 hosted project。前端預設仍為 `provider: 'gas'`；切換 production 前必須完成 `../runbooks/SUPABASE_MIGRATION.md` 的決策及驗證。

## Public browser configuration

`js/cloud-runtime-config.js` 只可包含：

- `provider`: `gas` 或 `supabase`。
- `supabaseUrl`: project HTTPS URL。
- `supabasePublishableKey`: `sb_publishable_...` public key。
- `fallbackReadsToGas`: Supabase read 失敗時是否讀 GAS。

Secret key、legacy `service_role` JWT、rate-limit salt 均不可放入 browser source。

## Read game config

`GET /rest/v1/game_config_versions?select=config&is_active=eq.true&limit=1`

- Browser header：`apikey: <publishable key>`。
- Database role：`anon` 或 `authenticated`。
- Grant：只限 `SELECT`；RLS 只回傳 `is_active = true`。
- Response：一列 `{config}`；config 使用既有 `{weapons, monsters}` normalization。

## Read leaderboard

`POST /rest/v1/rpc/get_leaderboard_v1`

Request body：`{"p_limit": 100}`。回傳既有 client shape：`{diff, cls, sid, name, score, is_me}`。

私隱 invariant：

- `sid` 永遠是空字串。
- `name` 只回傳遮罩稱呼，例如 `測同學`，不回傳完整姓名。
- 最多 100 列。
- Function 可由 `anon` 執行，但只有固定 redacted projection。

## Submit score

`POST /functions/v1/submit-score`

Headers：

- `apikey: <publishable key>`。
- `Content-Type: application/json`。
- `Origin` 必須完全符合 `MATH_SURVIVAL_ALLOWED_ORIGINS`。

Body：

```json
{
  "classCode": "TST-1A",
  "studentId": "S01",
  "difficulty": 2,
  "score": 42,
  "idempotencyKey": "00000000-0000-4000-8000-000000000001"
}
```

以上只是假資料格式示例。Edge Function 會驗證格式、project publishable key、origin，並把 requester address 與 server-only salt 做 SHA-256；database 只保存 hash，不保存 raw IP。每個 hash 每分鐘最多五個新 submission。

Edge Function 以 server-only key 呼叫 `submit_score_v1`。該 RPC 不授權 `anon`／`authenticated`，所以 browser 不可繞過 function 直接寫入。相同 idempotency key 和相同 payload 回傳同一 receipt；同 key 不同 payload 回傳 conflict。

Publishable key、Origin 和班別／學號配對都不是學生身份驗證；它們只建立應用程式、browser CORS、資料格式及濫用控制邊界。若日後要求「只准本人提交」，必須另加 Supabase Auth／校方 SSO 及 user-to-student authorization，不能把現有輸入畫面稱為 login。

Success response：

```json
{
  "accepted": true,
  "duplicate": false,
  "name": "測同學",
  "receiptId": "00000000-0000-4000-8000-000000000000"
}
```

## Fallback rule

- 預設 `gas`：維持現有 production 行為。
- `supabase`：game config／leaderboard 可按 flag read-fallback 到 GAS。
- Score mutation 永不自動 fallback 到 GAS，避免不確定成功後雙重寫入，亦避免重新以 GET URL 傳學生欄位。
