# Device, Quality, Assets and Audio

## 輸入模式

`js/device.js` 管理 `desktop|touch`：

- `?mode=touch|desktop` 最高優先並禁止 runtime auto-switch 覆蓋。
- 否則先讀 localStorage，再以 coarse/fine pointer 和螢幕尺寸猜測。
- 真實 touch、mouse movement 或實體 keyboard 事件可在 runtime 切換模式。
- `<body>` 使用 `mode-touch`/`mode-desktop` class 作 UI hook。

`js/input.js` 統一保存 keyboard/mouse/touch control state；`TouchControlSurface` 以獨立 pointerId 接駁左下虛擬搖桿、右半屏 touch look、按住開火、toggle 瞄準、換彈及近戰。搖桿推盡向前會自動疾跑，多指移動／視角／開火互不搶 state。

Pointer Lock 只負責 desktop 取得滑鼠控制；`Game.pause()`／`resume()`、數學題回復及 `visibilitychange` 已使用共用 lifecycle。touch HUD 現有獨立暫停鍵，回復不要求 Pointer Lock。

touch controls 在 pause、visibility loss、resume 及 dispose 時 reset；透明 look zone 位於戰鬥鍵下層，避免攔截按鈕。

## 沉浸和 orientation

- touch 開局時嘗試 Fullscreen API 和 landscape orientation lock。
- iOS 不支援時以 portrait overlay 提示旋轉。
- fullscreen/orientation rejection 被 catch，不阻止開局。

## 畫質

| Tier | 主要差異 |
|---|---|
| high | desktop baseline、antialias、較多草/樹/碎片、較遠 fog |
| medium | 較低 pixel ratio、無 antialias、中等場景密度 |
| low | 0.75 pixel ratio、最低場景密度和碎片量 |

- `?quality=` 可強制 tier。
- 否則讀 localStorage；touch 再按 CPU cores/device memory 猜測。
- `game.js` 每三秒監察 FPS；低於門檻可即時降低 pixel ratio，並把下一局 tier 降一級。
- 自動降級刻意不寫 localStorage。

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
