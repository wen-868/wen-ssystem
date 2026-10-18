# QODER-6 · S3-242：跨层漂移 16 条定性（前端调了后端不存在的路径 = 静默失效）

> 派单人：凌舟｜端：**移动端 → Qoder**｜回传人：Qoder 执行人
> 依据：`R101-S3-233-凌舟验收与裁定.md` §二.3（裁定 3）+ S3-240 追加发现（`api/system.ts` 的 `/admin/system/employees*` 后端零注册）
> ⚠️ 不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-6`｜分支 `chore/qoder-6-crosslayer-drift`｜基线：`origin/main`

## 一、目标（**只定性 + 登记，不修业务**）

对下列 16 条逐条判定属于哪一类，并给出**证据行号**：

| 类 | 含义 | 处置 |
|:--|:--|:--|
| **D1 真漂移** | 后端有该端点，但前端路径/方法写错（拼写、前缀、verb） | 本单只登记 + 给正确路径；**修复另立卡** |
| **D2 端点不存在** | 后端无此端点（历史遗留/规划中） | 登记 + 标注"调用必 404"；**建议下线该调用**（另立卡） |
| **D3 命名差异但等价** | 路径不同但后端有等价端点 | 登记 + 给映射 |
| **D4 误报** | 匹配规则未覆盖（如动态拼接、前缀挂载） | 登记 + 说明匹配原因 |

范围：`instant-retail` 的 `platform/*` 15 条 + `deliveries/:deliveryId/status` 1 条 + S3-240 追加的 `api/system.ts` 的 `/admin/system/employees*`。

## 二、交付

1. **判定表（逐条一行）**：`前端文件:行 → 方法+路径 → 后端实际（文件:行 或 不存在）→ 类 → 建议`；
2. **机械判据脚本**：`app-mobile/scripts/check-contract-drift.mjs` —— 与 `check:contract` 同一套抽取逻辑，但**只针对本单清单**输出上表（供回归：修复后该类应为 0）；
3. **回归基线**：把当前"真漂移/D2 不存在"计数写进 `gates-baseline.json`（**只准降**）。

## 三、判据

1. 16 条**逐条**有判定与证据（不许只给汇总数）；
2. 每条 D1/D2/D3 都能用 `rg` 在后端路由文件里**指到行**（或明确 `0 命中` + 展示检索命令）；
3. 至少 1 条 D4 的"误报"要给出匹配器为何漏判的说明（否则视为未定性）；
4. `npm --workspace app-mobile run test` 全过且用例数不劣化；`type-check` 0=0；`backend/` 零改动（`merge-base..HEAD`）。

## 四、红线

只改 `app-mobile/scripts/**`、`gates-baseline.json` + 证据/回传卡；**不得改业务代码、不得改后端**；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-QODER-6-回传.md`（十项）+ 回执，卡内必须含**16 行判定表全文**与"后续修复建议拆单"清单。
