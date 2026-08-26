# Device Acceptance Gate

Issue #3 只有在目標真機完成本清單後才可關閉。Playwright 裝置模擬是合併前自動閘，不等於真實 iOS／Android 的 GPU、safe-area、音訊或多指驗收。

## 目前準備狀態（2026-08-26）

- V3.9 本機閘通過：static、23 unit tests，以及 18 passed／2 個 hosted-staging cases 按設計 skipped；三個裝置 profile 均覆蓋答題包顯示與安全返回。
- 844×390 forced-touch 本機瀏覽器成功載入 3D touch HUD，無 console error；這項只證明入口和基本 UI，不取代下方真機記錄。
- V3.9 獨立 Cloudflare Pages branch preview 已上線：`https://device-gate-p3.math-survival-device-staging.pages.dev/?mode=touch&debug=perf`。874×402 單欄選單、3D／2D、觸控 HUD、效能診斷列、答題自動閘、安全返回及嚴格 404 已驗證，console 無 error；但仍未在用戶的實際 iPhone 17 Pro 完成下方重測。
- LAN 預覽已驗證首頁／touch URL 200、dotfile 404；測試後 server 已停止。下次執行 `npm run serve:device` 並重新取得 LAN IP，不能假設舊 IP 不變。
- 第一部真機 iPhone 17 Pro／Safari 在 2026-08-26 驗收失敗：開始選單沒有手機縮放、3D 畫面明顯像素化、移動約 10 秒後 lag；其後拾取答題包會卡死且題目不彈出。iOS／Safari 版本待填；修正及同機重測前保持 blocking。Android phone、iPad 的實際型號／版本尚未提供。
- V3.8 本機修正候選已針對 874×402 加入單欄選單、HUD 防重疊、medium DPR 1.35／最低 1.0、場景減量及每幀工作節流；自動 smoke matrix 15 passed、2 hosted-staging skipped。這只代表 regression gate 通過，仍須以同一部 iPhone 17 Pro 重做下方完整流程。
- V3.9 答題包候選已改為先顯示題目再安全 unlock，並加入橫屏答題框邊界；三個模擬裝置均已完成「拾取後顯示、作答、返回 PLAYING」。這不取代真實 iPhone Safari 驗收。

## 自動閘

`npm run test:smoke` 會執行以下矩陣：

| Project | Engine / profile | 自動檢查 |
|---|---|---|
| `chromium` | Desktop Chrome | 3D／2D 啟動、雲端隔離、惡意排行榜內容、重複提交保護、既有 touch smoke |
| `iphone-safari` | WebKit / iPhone 13 | portrait guard、landscape HUD／答題框邊界、無 Pointer Lock 答題流程、多指 reset、autoplay rejection retry |
| `android-chrome` | Chromium / Pixel 7 | 同上 |
| `ipad-safari` | WebKit / iPad (gen 7) | 同上 |

自動閘會 mock GAS read、阻止 `addScore` 並封鎖其他外部 host；不得移除這層 production 隔離。Playwright 的 safe-area inset 通常是 0，瀏海／圓角遮擋仍必須用真機確認。

## Cloudflare 真機 preview（建議）

1. 真機開啟 `https://device-gate-p3.math-survival-device-staging.pages.dev/?mode=touch&debug=perf`；不需要與 Mac 同一 Wi-Fi。重測時請記錄底部診斷列在開始、約 5 分鐘及約 10 分鐘的 FPS／DPR（不需截到排行榜）。
2. 這是公開但不影響 production 的 branch preview。`noindex` 不是存取控制，切勿把真實班別、學號、姓名或成績放進測試。
3. 班別／學號只用 `TEST`／`00`。
4. 在勝負／結算前按暫停，再選「放棄本局，返回主選單」。如意外到達結算畫面，不要按「上傳成績」。
5. 依下方清單逐部記錄；不應把排行榜內容放入 screenshot 或 Issue。

preview 的部署邊界、固定／版本 URL 及重建方法見 `docs/runbooks/CLOUDFLARE_DEVICE_PREVIEW.md`。

## 同一 Wi-Fi 本機後備

1. Mac 與測試裝置連接同一個可信任 Wi-Fi；在 repository 執行 `npm run serve:device`。
2. 執行 `ipconfig getifaddr en0` 取得 Mac LAN IP；如沒有輸出，再試 `ipconfig getifaddr en1`。
3. 真機開啟 `http://<Mac-LAN-IP>:4173/?mode=touch`。如 macOS 防火牆詢問，只允許目前可信任網絡。
4. 測試只用 `TEST`／`00`，不要輸入真實班別、學號或姓名。
5. 真機流程在勝負／結算前按「放棄本局」離開，避免把 synthetic score 送到 production GAS。成績提交由隔離 smoke test 驗證，不屬於本真機閘。
6. 完成後在 Mac 按 `Ctrl+C` 停止 server。LAN 模式會讓同一網絡讀取靜態專案檔；server 已拒絕 dotfile 路徑，但仍只應短暫開放於可信任網絡。

## 每部裝置的必做流程

目標至少包括：一部 iPhone Safari、一部 Android Chrome、一部 iPad Safari。每部記錄實際型號、OS、browser 版本、日期及結果。

- 直屏開啟：顯示旋轉提示；班別／學號不會在提示後被誤觸。
- 轉橫屏：提示消失；暫停、搖桿、瞄準、換彈、開火及近戰全部在 safe-area 內，互不重疊。
- 進入程度 1：3D 畫面正常，沒有黑屏、持續 loading 或明顯 layout jump。
- 同時以三指移動、轉視角及按住開火；放手後角色／鏡頭／開火立即停止。
- 驗證推盡向前疾跑、toggle 瞄準、換彈、平底鑊近戰及取得槍後仍可近戰。
- 按暫停再恢復；切到其他 App／鎖屏再返回。每次都不應殘留移動、開火、瞄準或舊 pointer。
- 旋轉直屏再回橫屏；HUD 不超出畫面，瀏海、Home Indicator、browser toolbar 不遮擋按鈕。
- 首次進場及恢復後確認 BGM／射擊／換彈／近戰聲；autoplay 被拒時遊戲仍可玩，再次玩家手勢可重試音訊。
- 觸發一次空投數學題，完成答題並回到 gameplay；控制不會卡死。
- 暫停選單調整 BGM／SFX；音量為 0 時靜音，恢復音量後聲音回復。
- 玩 10 分鐘，留意過熱、reload、低 FPS、自動降畫質、Safari 分頁重載或 Android renderer crash。

## 驗收記錄

| Device | OS / browser | Portrait / safe-area | Multi-touch / lifecycle | Audio | 10-min run | Result / notes |
|---|---|---|---|---|---|---|
| iPhone 17 Pro | iOS／Safari 待填 | ❌ | ❌ | ⬜ | ❌ | 2026-08-26：選單未縮放、3D 像素化、約 10 秒後 lag；另拾取答題包卡死且題目不彈出。V3.9 候選待同機重測 |
| Android phone | 待填 | ⬜ | ⬜ | ⬜ | ⬜ | 待真機 |
| iPad | 待填 | ⬜ | ⬜ | ⬜ | ⬜ | 待真機 |

如任何一格失敗，記錄重現步驟、方向、輸入組合及可公開的畫面；不得把真實學生資料、排行榜內容或 secrets 放入 screenshot／Issue。

完成三行後，按 `docs/runbooks/PR_STACK_RELEASE.md` 逐層執行 PR stack 合併；未完成前保持 Draft。
