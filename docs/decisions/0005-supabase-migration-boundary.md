# ADR 0005 — Supabase migration boundary

- Status: Accepted for local foundation; hosted rollout pending owner decisions
- Date: 2026-08-25

## Context

Legacy GAS 以 GET URL 傳送班別、學號及分數，repository 又沒有 server handler、權限或資料保留政策。用戶決定把 GAS 改為 Supabase，但現有 hosted `School Platform Production` 是否適合共用尚未確認。

## Decision

建立可獨立驗證而預設不啟用的 Supabase 基礎：

- 學生目錄、原始成績和 rate-limit state 放在不暴露的 `math_survival_private` schema。
- Browser 只獲 publishable key；Data API grants 與 RLS 同時採明確 opt-in。
- 公開排行榜只經固定 security-definer projection 回傳班別、遮罩名和分數，不回傳學號／全名。
- 成績只經 origin/key/格式檢查的 Edge Function，再以 server key 呼叫 service-only、security-invoker RPC。
- 寫入使用 UUID idempotency key及 hashed requester rate limit；不保存 raw IP。
- GAS 保留為 feature-flag rollback；Supabase mutation 不自動 fallback 或 dual-write。

## Consequences

本機可完整驗證 schema、權限及 function，不必接觸真實學生資料或 production。代價是 hosted rollout 仍需要 project ownership、學生資料政策、retention、正式 origins 及 staging 決策；未完成前前端維持 GAS。
