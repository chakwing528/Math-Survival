# GAS `addScore` POST Migration Plan

狀態：設計方案；未獲 GAS source、owner 和部署批准前不可執行。

## 目的

把學生班別、學號和分數移出 GET URL，加入 server-side validation、idempotency 和可驗證 receipt，同時避免中斷目前 production leaderboard。

## 建議 v2 request

```http
POST /exec
Content-Type: application/json

{
  "version": 2,
  "action": "addScore",
  "idempotencyKey": "random-per-result-id",
  "submittedAt": "2026-08-25T12:34:56.000Z",
  "difficulty": 1,
  "class": "1A",
  "studentId": "01",
  "score": 12
}
```

建議成功 response：

```json
{
  "ok": true,
  "receiptId": "server-generated-id",
  "name": "validated display name",
  "recordedAt": "2026-08-25T12:34:56.000Z"
}
```

錯誤 response 應使用 4xx/5xx status 及固定 `{ ok:false, code, message }` schema；message 不可包含 Sheet 內其他學生資料。

## Server 必要控制

- 驗證 JSON content type、version、action、欄位型別、長度、允許值及 score 範圍。
- 由 server 產生 authoritative timestamp；client 時間只作輔助 metadata。
- 以 `idempotencyKey` 防止重播／雙擊重複寫入，並設定合理 expiry。
- Sheet 寫入前防 formula injection；以純文字保存班別、學號和姓名。
- 建立 authentication/authorization 或其他校方批准的防濫用方案。
- 設定 rate limit、CORS allowlist、最小 deployment access、audit log 及資料保留/刪除流程。
- production 和 test 使用不同 deployment 及 Sheet。

## 分階段 rollout

1. 取得 GAS source、deployment owner、Sheet schema 和現有 duplicate policy。
2. 在獨立 test deployment 實作 v2 POST，保留舊 GET handler。
3. 為 handler 建立 unit/integration tests，包括 invalid JSON、formula payload、重播、並行寫入和權限失敗。
4. Client 加入明確 feature flag/capability；只對 test endpoint 啟用 POST。
5. 用非真實資料完成 end-to-end、receipt 和 leaderboard consistency 驗證。
6. 經資料 owner／部署 owner 批准後，先小比例啟用 production POST並監察錯誤。
7. 確認沒有 legacy caller 後才停用 GET mutation；不要靜默 fallback 到 GET，否則個人資料會再次出現在 URL。

## Rollback

- 發布前保留前一個 GAS deployment version。
- Client feature flag 可停止提交並顯示清楚錯誤；安全 rollback 不應自動恢復含個人資料的 GET。
- rollback 不可刪除或覆寫已收集資料；資料修正需按 owner 批准流程處理。

## Blockers

- GAS handler 原始碼及 owner 未提供。
- Sheet schema、共享權限、資料保留和合法/校內收集依據未確認。
- 未有 test deployment、server authentication 或 idempotency store。
