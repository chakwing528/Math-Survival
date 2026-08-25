# Current State

更新基準：2026-08-25，以目前 workspace 程式碼為準。

## 當前版本

- 畫面版本：Math Survival FPS V3.3。
- ES Module/cache query：`?v=33`，目前所有已加版本的 imports 一致。
- 預設 3D 場景：`SCENE_MODE = 'nature'`。
- 備用 `school` 場景仍保留於 `js/school.js`。
- 2D `classic-2d.html` 保留為舊裝置 fallback。

## 已由程式碼確認的能力

- 3D 第一/第三人稱切換、WASD、疾跑、射擊、開鏡、換彈、近戰、9 級武器。
- 5 級喪屍、boss、hitbox、受擊/死亡效果、可破壞場景物件。
- 自然場景、圍牆收縮、雷達、羅盤、威脅提示、補給及彈藥箱。
- 五個難度、六個課題類別、輸入題/選擇題、限時、答錯解釋、賽後學習報告。
- GAS 雲端遊戲設定、排行榜讀取及成績提交；失敗時部分流程有本機 fallback。
- desktop/touch 偵測、橫屏提示、全螢幕請求及 high/medium/low 畫質分級。

## 進行中／未完成

- 3D 手機版只有 P0 基礎：輸入模式、沉浸/橫屏和畫質分級。
- Pointer Lock 仍驅動 `PLAYING ↔ PAUSED/RESUME_WAIT`；touch 裝置沒有完整 pause/resume 流程。
- 尚未有 `js/input.js` 統一輸入抽象、虛擬搖桿、touch look 或手機射擊按鈕。
- 學校場景沒有樓梯重力/探地及跨樓層喪屍尋路。
- 19 MB 模型未壓縮。
- 沒有自動化測試、CI、lint、type check 或正式 build。

## 已知文件／設定問題

- Git 歷史及 `origin` 已於 2026-08-25 恢復；`origin` 是公開 repository `chakwing528/Math-Survival`，預設分支為 `main`。
- 本機 V3.3、文件系統及資產在獨立分支整理；合併前應先審查，避免直接改動 GitHub Pages 的公開版本。
- `.claude/launch.json` 已改為本機可用的 `python3` 和相對工作目錄，但仍需由實際 launcher 驗證。
- 模型授權不是全部 CC-BY 3.0；個別授權以 `assets/models/credits.txt` 為準。
- GAS handler、遠端 schema、權限及資料保留政策不在此 workspace。

## 驗證狀態

- 2026-08-25：15 個 JavaScript 檔通過 `node --check`。
- 沒有執行 browser gameplay、WebGL、Pointer Lock、touch、audio 或 GAS integration 測試。
- 「語法通過」不代表功能通過。

## 下一批建議工作

1. 審查本機相對 `origin/main` 的完整變更，設定提交者資料後提交到獨立分支。
2. 經人工確認公開內容及 GitHub Pages 影響後，才建立 Pull Request 或合併至 `main`。
3. 取得/審查 GAS handler、資料 schema、authentication/authorization 和學生資料政策。
4. 為題庫及 config parsing 建立最小 unit tests。
5. 為兩個頁面建立不提交真實資料的 browser smoke tests。
6. 若繼續手機版，先解耦 Pointer Lock 狀態機，再建立統一 input abstraction。
