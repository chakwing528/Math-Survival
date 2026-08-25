# ADR 0004: Shared validated cloud boundary

- Status: Accepted
- Date: 2026-08-25

## Context

3D 和 2D client 原本各自硬編碼 GAS endpoint、直接解析未驗證 JSON，並以 `innerHTML` 顯示 leaderboard fields。`addScore` 亦可能因重複 click 產生並行寫入。Repository 沒有 GAS handler，因此不能安全地單方面更改 production transport。

## Decision

新增 classic script `js/cloud-core.js`，在兩個 client 載入前建立 `MathSurvivalCloud`：集中 endpoint、request timeout、error taxonomy、game-data/leaderboard/submission validation、single-flight、結果 merge 及安全 DOM rendering。

Production `addScore` 暫時保留 legacy GET contract。Client 不自動 retry mutation；POST 遷移另按 `docs/api/GAS_POST_MIGRATION.md` 執行，並以取得 handler、test deployment 和 owner 批准為前提。

## Consequences

優點：

- Endpoint 只有一個 source of truth。
- 遠端 leaderboard 文字不再經 HTML parser。
- 無效 response、timeout 和重複提交有可測試行為。
- 3D/2D 的 cloud boundary 一致，而 renderer/gameplay 仍可保持獨立。

代價及限制：

- `cloud-core.js` 是 global classic script，必須在 `config.js` 或 2D inline client 前載入。
- GET query 仍會暴露班別、學號和分數，直到 server migration 完成。
- Client validation 不能取代 server validation、authentication、rate limit 或資料政策。
