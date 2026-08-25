# ADR 0002：3D 主版與 2D 經典 fallback

- 狀態：現況已採用；長期共用策略待決定
- 日期：依現有程式碼回溯記錄，2026-08-25 建檔

## Context

`index.html`/`js/*` 是模組化 Three.js 3D client；`classic-2d.html` 是獨立 Canvas client。兩者共用 `js/topics/*`，但設定、題目 orchestration、排行榜和 gameplay 多數分開實作。

## Decision

目前保留兩個公開入口：3D 為主體驗，2D 作舊裝置/低相容環境 fallback。修改共同行為時，必須明確核對兩版。

## Consequences

優點：即使 WebGL、Pointer Lock、GLB 或 Three.js CDN 失敗，仍有較輕量版本；舊版玩法得到保存。

代價：

- 重複程式碼容易 drift。
- API/schema/security fix 需要兩處修改。
- 兩版的遊戲規則和數學回饋可能逐步不一致。
- 單檔 2D HTML 難以測試和局部導航。

## Revisit when

- 開始修正 GAS security/schema 或增加自動測試時，先抽出共用 config/API client。
- 2D 版不再有實際用戶，或 3D touch/low-quality 模式能完全取代它。
- 2D 單檔維護成本持續增加時，考慮拆 module，但保留獨立 route。

