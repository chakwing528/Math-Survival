# Data Flows and Privacy

## 資料分類

| 資料 | 來源 | 使用 | 保存/傳送 |
|---|---|---|---|
| 班別 `cls` | 玩家輸入 | 開局 validation、排行榜配對 | 提交分數時送到 GAS query string |
| 學號 `sid` | 玩家輸入 | 開局 validation、姓名配對/顯示 | 提交分數時送到 GAS query string |
| 姓名 `name` | GAS response | 排行榜顯示 | 遠端保存方式未知；client 不持久保存 |
| 分數 | kills × 難度倍率 | 排行榜 | 送到 GAS query string |
| 難度 | 玩家選擇 | 題目、倍率、排行榜 | 送到 GAS |
| 日期/時間 | browser clock | 排行榜紀錄 | 送到 GAS |
| 逐題統計 | `Game` runtime | 賽後學習報告 | 只存在當局記憶體，沒有提交證據 |
| UI/device preferences | browser/device | 輸入模式、畫質、靈敏度、音量 | localStorage |

## 資料流

```text
Student input (class, student ID)
          │
          ├─ client-side non-empty check
          │
          └─ after explicit score-submit click
             GET query → Google Apps Script → Google Sheet/unknown store
                                      │
                                      └─ leaderboard JSON (name/class/ID/score)
                                                 │
                                                 └─ validation → textContent DOM rendering
```

## Browser storage keys

- `ms_input_mode`
- `ms_quality`
- `ms_sens`
- `ms_bgm`
- `ms_sfx`

班別、學號、姓名、分數和逐題表現目前沒有寫入 localStorage 的程式碼。

## 已確認風險

1. 班別和學號在 GET URL 中，可能被 browser history、proxy、server logs 或監察工具記錄。
2. 「login」只是資料輸入，沒有 authentication、session 或 proof of student identity。
3. client 無法證明遠端成功保存；失敗時仍可能顯示本機合成排名項目。
4. endpoint 和資料欄位公開存在於 client source，不能當作 secret。
5. Client 已限制/安全顯示遠端欄位，但 server-side validation、formula injection 防護及 access control 仍未知。

## Repository 未提供的政策

- Data controller/owner 和獲授權存取者。
- 收集學生姓名、班別、學號及分數的合法/校內依據。
- 保留期、刪除、更正、匯出及家長/學生查詢流程。
- Google account、Sheet、Apps Script deployment 的 sharing/permission。
- Backup、incident response、audit log 和 breach notification。
- 是否允許 leaderboard 向所有玩家顯示班別/姓名/學號。

## 工程要求

- 文件、測試、screenshots 和 logs 不得使用真實學生資料。
- 遠端 leaderboard 資料必須經 `MathSurvivalCloud` validation，並使用 `textContent` 建構 DOM；不可恢復 template-string `innerHTML`。
- score POST 遷移按 `docs/api/GAS_POST_MIGRATION.md`，避免在 URL 傳個人資料。
- client 和 server 都要驗證長度、格式、分數範圍及允許字元。
- 在取得資料 owner 批准前，不新增 analytics、tracking 或更多學生欄位。
- 對 GAS 做 integration test 前使用獨立測試 deployment/sheet。
