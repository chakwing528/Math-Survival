# Math Learning

## 使用者目的

把數學練習嵌入生存射擊循環：玩家接觸補給、完成限時題目，答對取得資源，答錯看到解題步驟，結束後查看課題表現。

## 模組責任

| 模組 | 責任 |
|---|---|
| `js/helpers.js` | 題庫共用 global helpers、shuffle、解釋 HTML helpers |
| `js/topics/indices.js` | 指數選擇題生成器 |
| `js/topics/expansion.js` | 代數展開選擇題生成器 |
| `js/topics/factorization.js` | 因式分解選擇題生成器 |
| `js/topics/rounding.js` | 捨入/有效數字選擇題生成器 |
| `js/math.js` | 3D 版難度選題、輸入/MCQ UI、10 秒 timer、resolve contract |
| `classic-2d.html` | 2D 版另行實作選題、UI、timer 和獎勵連接 |

## 難度 mapping

| 程度 | 題型 | 分數倍率 |
|---|---|---|
| 1 | 整數加減 | 1.0 |
| 2 | 先乘除後加減的四則混合 | 1.2 |
| 3 | 初段加減；其後基礎指數 | 1.4 |
| 4 | 捨入、展開、因式分解、指數基礎隨機 | 1.6 |
| 5 | 同上，使用進階 level | 1.8 |

顯示名稱和倍率的權威來源是 `js/config.js`；HTML 中亦有顯示副本，修改時要同步。

## Question contract

輸入題預期：

- `isInput: true`
- `question`: HTML/TeX
- `answer`: 可轉成 number 的正確答案
- `explain`: 解題步驟
- runtime 加上 `topic`

選擇題預期：

- `question`: HTML/TeX
- `options[]`: `id`、`text`、`isCorrect`、`hint`
- runtime 加上 `topic`

進階 generator 發生 exception、函數不存在或沒有回傳題目時，`math.js` 改用乘法輸入題 fallback。

## UI 和 resolve

- 同一時間只允許一個 active keydown handler 和 timer。
- 題目限時 10 秒；超時 resolve 為錯誤。
- 輸入題支援畫面 numpad、鍵盤數字、負號、Backspace 和 Enter。
- 選擇題按 option 的 `isCorrect` 判斷。
- 答錯顯示 `explain`/`hint`，由學生按「明白了」後才繼續。
- `onResolve(isCorrect, topic)` 只應呼叫一次。
- MathJax 只負責排版；gameplay 不應因 MathJax promise rejection 停止。

## 學習報告

`game.js` 按題目 topic 記錄 `c` 和 `t`；`main.js` 在結算計算：

- 總正確率。
- 各課題綠/黃/紅指示。
- 至少兩題且低於 80% 的最弱課題提示。
- 全對提示。

統計只存在當局記憶體，沒有本機歷史或遠端逐題紀錄。

## 安全和驗證

- 題目和 hint 使用 `innerHTML`；目前內容來自本機題庫。若日後接受遠端題目，必須先加 sanitization。
- 不要只測 generator 不 throw；應驗證每題只有一個正確 option、答案可解析、hint 存在和難度範圍合理。
- 目前沒有 unit tests。優先測試題庫 contract、fallback、timer single-resolve 和 topic statistics。

