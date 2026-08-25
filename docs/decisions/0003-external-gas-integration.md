# ADR 0003：外部 Google Apps Script 整合

- 狀態：現況已採用；安全及資料治理尚未確認
- 日期：依現有程式碼回溯記錄，2026-08-25 建檔

## Context

兩個 browser clients 直接使用同一 GAS Web App 讀取遊戲設定、讀排行榜及提交分數。GAS handler 和 Sheet 不在本 workspace。

## Decision

文件把 GAS 視為明確的外部系統邊界，不把未知遠端行為寫成 repository 事實。任何 contract 或個人資料變更都要先取得遠端 handler、owner 和部署批准。

## Consequences

- 遊戲平衡可由 Sheet 調整，不必重新發佈 client。
- 靜態部署仍可有共享排行榜。
- repository 無法獨立驗證整個 system。
- GET score submission、個人資料 URL、無正式 schema 和不安全 DOM rendering 是待處理風險。
- 測試需要 mock 或獨立 GAS 測試部署，不能安全地直接寫 production。

## Required follow-up

1. 取得 GAS source/schema/owner。
2. 記錄資料權限、保留和刪除流程。
3. 定義 versioned request/response schema 及 errors。
4. 評估 POST、server-side validation、idempotency 和 output escaping。

