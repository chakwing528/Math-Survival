# ADR 0001：純靜態瀏覽器架構

- 狀態：現況已採用；正式長期承諾待專案 owner 確認
- 日期：依現有程式碼回溯記錄，2026-08-25 建檔

## Context

專案由兩個 HTML client、原生 JavaScript、模型和音效組成，沒有 package manager、build system 或本機 backend。Three.js/MathJax 從 CDN 載入；動態設定和排行榜由外部 GAS 提供。

## Decision

目前維持可直接部署到靜態 host 的架構，repository Markdown 和測試亦不應假設必須先 build 才能閱讀/運行。

## Consequences

優點：部署簡單、沒有 server 維運、2D fallback 可獨立開啟、原始碼容易檢查。

代價：

- Runtime 依賴 CDN 和 browser capabilities。
- API endpoint 及資料 contract 暴露在 client。
- 無 server proxy 可保護個人資料、credentials 或 enforce authorization。
- 沒有 package manifest 可鎖定 MathJax patch、執行 lint/tests 或管理 supply-chain metadata。
- Cache invalidation 依賴手動 `?v=` bump。

## Revisit when

- 需要可靠 authentication、私密設定、server-side validation 或學生資料保護。
- 自動化測試/build/asset optimization 的收益超過零 build 的簡單性。
- GAS 不再足以支援資料量、權限或可靠性要求。

