# Work Management Workflow

## Source of truth

- 程式行為：原始碼及可重現測試。
- 長期知識：`docs/` 和 ADR。
- 當前狀態及下一步：`docs/CURRENT_STATE.md`。
- 近期 task 交接：`HANDOFF.md`。
- 未來 backlog：GitHub Issues/Projects；remote 已確認，但未獲授權前不建立遠端 Issue/Project。

不要把同一 backlog 完整複製到多份 Markdown。`CURRENT_STATE` 只保留正在進行、blocked 和近期最高優先事項。

## Task lifecycle

1. **Inbox**：未整理的想法或問題。
2. **Planned**：已確認價值，但未準備實作。
3. **Ready**：scope、證據、acceptance criteria 和驗證方式齊全。
4. **Coding**：正在修改。
5. **Testing**：實作完成，正在驗證。
6. **Blocked**：有具體外部依賴或決策阻塞。
7. **Done**：acceptance criteria 及必要驗證完成，文件已同步。

每次只有真正動工的項目進入 Coding；「Done」不能只表示寫完程式碼。

## 工作項目最低資料

- Title：使用者可理解的結果。
- Type：Feature、Bug、Refactor、Technical debt、Documentation、Security。
- Priority：P0、P1、P2、P3。
- Area：3D FPS、2D Classic、Math Question Bank、Leaderboard & Cloud Config、Device/Input、Assets & Audio、Documentation/Tooling。
- Context/evidence：相關 route、module、錯誤或現有文件。
- Scope / non-scope。
- Acceptance criteria。
- Validation plan：實際可執行指令、browser/device/API 環境。
- Data/security impact。
- Documentation impact。

## Task 開始模板

```text
Outcome:
Area / Type / Priority:
Evidence:
In scope:
Out of scope:
Acceptance criteria:
Validation:
Data/security impact:
Docs to update:
```

## 完成 checklist

- 實作符合 acceptance criteria。
- 列出實際執行的驗證和結果；未執行項目連原因一併記錄。
- 沒有使用真實學生資料作測試。
- route/功能/API/資料流有變更時同步相關 `docs/`。
- 長期技術取捨新增或 supersede ADR。
- `CURRENT_STATE.md` 移除已完成暫態資訊，留下新的限制/下一步。
- `HANDOFF.md` 只加入下一個 task 真正需要知道的近期狀態。
- 如 Git 恢復，提交前檢查 working tree，不覆蓋無關用戶改動。

## GitHub Projects 後續設計

已確認 repository 為公開的 `chakwing528/Math-Survival`。如日後獲授權建立 GitHub Project，可採用：

- Status：Inbox、Planned、Ready、Coding、Testing、Blocked、Done。
- Type：Feature、Bug、Refactor、Technical debt、Documentation、Security。
- Priority：P0、P1、P2、P3。
- Area：使用上述實際專案範圍。

建議 views：

- Board by Status：日常工作。
- Table by Area/Priority：規劃和 triage。
- Filter `Type=Security`：資料/API/security follow-up。
- Filter `Area=Device/Input`：手機版 P1–P4。

GitHub Project 是工作 metadata，不取代 repository 內的架構和操作文件。
