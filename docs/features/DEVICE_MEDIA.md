# Device, Quality, Assets and Audio

## 輸入模式

`js/device.js` 管理 `desktop|touch`：

- `?mode=touch|desktop` 最高優先並禁止 runtime auto-switch 覆蓋。
- 否則先讀 localStorage，再以 coarse/fine pointer 和螢幕尺寸猜測。
- 真實 touch、mouse movement 或實體 keyboard 事件可在 runtime 切換模式。
- `<body>` 使用 `mode-touch`/`mode-desktop` class 作 UI hook。

`js/input.js` 統一保存 keyboard/mouse/touch control state；`TouchControlSurface` 以獨立 pointerId 接駁左下虛擬搖桿、右半屏 touch look、按住開火、toggle 瞄準、換彈及近戰。搖桿推盡向前會自動疾跑，多指移動／視角／開火互不搶 state。

Pointer Lock 只負責 desktop 取得滑鼠控制；`Game.pause()`／`resume()`、數學題回復及 `visibilitychange` 已使用共用 lifecycle。touch HUD 現有獨立暫停鍵，回復不要求 Pointer Lock。

iPhone Safari 沒有完整 Pointer Lock API；答題流程只會在 controls 確實 locked 時嘗試 unlock，並吞掉 API failure。數學題 overlay 會在這個可選步驟之前同步顯示。

touch controls 在 pause、visibility loss、resume 及 dispose 時 reset；透明 look zone 位於戰鬥鍵下層，避免攔截按鈕。

## 沉浸和 orientation

- touch 開局時嘗試 Fullscreen API 和 landscape orientation lock。
- iOS 不支援時以 portrait overlay 提示旋轉。
- fullscreen/orientation rejection 被 catch，不阻止開局。

## 畫質

| Tier | 主要差異 |
|---|---|
| high | DPR 上限 1.5／最低 1.0、antialias、草 700／場外樹 40／碎片 150·500、fog 60–150 |
| medium | DPR 上限 1.35／最低 1.0、無 antialias、草 160／場外樹 10／碎片 45·120、fog 40–92 |
| low | DPR 上限 1.0／最低 0.85、無 antialias、草 80／場外樹 5／碎片 20·55、fog 35–75 |

- `?quality=` 可強制 tier。
- 否則讀 localStorage；touch 再按 CPU cores/device memory 猜測。
- `game.js` 每五秒取樣 FPS；連續兩段低於 touch 32／desktop 40 FPS 才降低 0.2 DPR，最多兩次且不可低於該 tier 的最低值。這避免開局第 3／6 秒連續重建 framebuffer。
- 自動降級刻意不寫 localStorage。
- `?debug=perf` 顯示每秒更新的 FPS、實際／裝置 DPR、tier、viewport 和 draw calls，供真機驗收；不包含學生資料。

## 手機 UI 與執行期節流

- touch 開始畫面使用單欄，桌面操作說明和排行榜側欄隱藏；字級、輸入框及按鈕按實際 CSS viewport 收窄，並套用 safe-area inset。
- 高度不超過 500px 的橫屏 HUD 會獨立縮放／移位羅盤、四角資訊、搖桿和戰鬥鍵，避免 iPhone 874×402 viewport 重疊。
- 同一高度範圍的答題 overlay 使用 safe-area padding、viewport 內容器、六欄 numpad 及至少 44px 操作鍵，避免 iPhone 橫屏要捲動或按不到。
- touch HUD、雷達和羅盤以 15Hz 更新，準星和威脅提示以 20Hz 更新；第三身相機碰撞 raycast 以 20Hz 更新並重用結果陣列及向量，減少每幀 DOM/canvas 工作與垃圾回收壓力。

## 3D assets

- `js/assets.js` 的 `MANIFEST` 列出 24 個 GLB：角色、8 款槍模型、植物和岩石。
- `loadAssets()` 使用單一 cached promise 並 parallel load；失敗清除 promise 供下次重試。
- 角色 clone 使用 `SkeletonUtils.clone()`；靜態 props/guns 使用 scene clone。
- 個別來源及授權以 `assets/models/credits.txt` 為準：目前 21 個 CC0 1.0、3 個 CC-BY 3.0。
- 模型約 19 MB；首次載入時間和手機記憶體是主要限制。

## Audio

- `audio/`：BGM、shoot、reload、empty-ammo。
- `js/audio.js`：HTML audio 控制及 WebAudio 合成的喪屍、答題、升級、近戰、心跳和勝利音效。
- 首次玩家 gesture 後初始化，以符合 autoplay policy。
- 分頁隱藏時暫停，回復時重播 BGM。
- BGM/SFX 音量保存 localStorage。

## 修改驗證

完整自動矩陣、同一 Wi-Fi 預覽方法及真機記錄表見 `../testing/DEVICE_ACCEPTANCE.md`。自動 WebKit／Chromium profile 只作合併前 regression gate，不能取代實際 iPhone／Android／iPad 驗收。

- Device：desktop mouse/keyboard、touch device、hybrid device、forced query modes；切頁後輸入狀態不可殘留。
- Orientation：iOS Safari、Android Chrome、iPad landscape/portrait。
- Quality：每 tier 的 pixel ratio、grass/tree/shard 數及自動降級。
- Assets：24 個 manifest 路徑、load progress、角色動畫、gun mapping、dispose/restart。
- Audio：autoplay rejection、mute/volume、visibility change、iOS AudioContext unlock。
