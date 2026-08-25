# Gameplay

## 責任範圍

`js/game.js` 是 3D runtime 的主要 owner：建立 Three.js scene、管理玩家/敵人/補給、處理戰鬥、更新 HUD、觸發數學題、判斷勝負及釋放資源。

它不負責：

- 收集班別/學號或提交排行榜；由 `js/main.js` 和 `js/leaderboard.js` 負責。
- 生成進階題庫內容；由 `js/math.js` 和 `js/topics/` 負責。
- 定義遠端設定來源；由 `js/config.js` 負責。

## 主要狀態機

| State | 意義 | 主要進入方式 | 主要離開方式 |
|---|---|---|---|
| `PLAYING` | 正常模擬、輸入及 render | `resume()`；desktop lock 或 touch start | `pause()`、數學題、結束 |
| `PAUSED` | 暫停選單 | desktop unlock、touch 暫停鍵、分頁隱藏 | resume button；desktop 再 lock |
| `MATH` | 題目 overlay；遊戲輸入停止 | 接觸補給並 `_triggerMath()` | 題目 resolve |
| `RESUME_WAIT` | 等待安全恢復遊戲控制 | 建立 Game、desktop 答題完成 | desktop lock；touch 直接 `resume()` |
| `OVER` | 勝利、死亡或放棄 | `_endGame()`/`abort()` | `main.js` dispose/重開 |

`js/input.js` 擁有允許的 lifecycle transition 及共用 input state；Pointer Lock callback 只呼叫 `pause()`／`resume()`。不合法 transition 會立即報錯，pause/resume 會清空輸入避免殘留開火或移動。

## Gameplay systems

- 玩家：HP/boost、WASD／虛擬搖桿、Shift／搖桿疾跑、mouse／touch look、FPP/TPP、瞄準、射擊、換彈、近戰。
- 武器：9 級；數值來自 `WEAPONS`，模型 mapping 來自 `GUN_BY_LEVEL`。
- 敵人：5 tiers；數值來自 `MONSTER_BASE`，由 queue 分批生成。
- 場景：預設 nature；school 可由 `SCENE_MODE` 啟用但不是完整可玩樓層系統。
- 戰場收縮：nature 使用四面圍牆；school/舊 zone 資料仍保留。
- 補給：UPGRADE 和 AMMO；接近後自動觸發數學題。
- 勝負：清除所有敵人勝利；HP 歸零失敗。
- 結算資料：victory、kills、total、weapon name、math stats 交回 `main.js`。

## 重要 invariants

1. 射線和 Sprite：加入 scene 的非互動 Sprite 應禁用 raycast，避免相機/射擊 raycaster 命中不支援物件。
2. TPP 準星：使用 `_setAimRay()` 套用相同相機偏移，不應直接由 camera 原始位置建立射線。
3. Three.js camera 預設朝 `-Z`；測試方向時要保持一致。
4. Skinned GLTF bbox：角色尺寸以骨骼變形後 bbox 計算，不能只依賴未變形 geometry bounds。
5. 手骨武器：attachment scale 需按 world scale 反算。
6. 共用 geometry/material：可破壞物件使用 cloned material；dispose 時不能釋放仍被其他物件共用的資源。
7. DOM IDs：HUD references 在 `_initHUDRefs()` 集中取得；改 HTML ID 必須同步。
8. Dispose：重開遊戲前必須移除 listeners、renderer、scene resources 及動態 DOM 狀態。

## 數學獎懲

- 答對 UPGRADE：升級/補充武器、HP +50、boost +40；滿級時補彈藥。
- 答對 AMMO：依武器設定補充 reserve ammo、boost +40。
- 連續答對兩題起按 combo 額外補彈。
- 答錯：combo 清零並觸發 rage；詳細時長/數值以程式碼為準。
- 每次 resolve 更新 `mathStats.total/correct/byTopic`。

## 錯誤及限制

- GLB/Three.js 載入失敗在 `main.js` 中止開局。
- WebAudio failure 多數不阻止 gameplay。
- 沒有 deterministic RNG、save game、replay 或 server authority。
- `window.__game` 暴露 debug instance；production 是否保留尚未決定。
- input/lifecycle 有 unit tests；完整 render loop、collision、Pointer Lock 及 dispose 修改仍至少需要 desktop browser smoke test。
- TouchControlSurface 有 unit 及隔離 Chromium 多指 mapping 測試；實際 WebGL 已驗證 HUD、戰鬥鍵、pause/reset/resume，目標真機仍是 release gate。

## 2D 對照

`classic-2d.html` 有獨立 game loop、state、武器、敵人、補給、數學及排行榜。它不是 `Game` 的另一個 renderer。任何共通規則變更都要明確決定是否同步兩版。
