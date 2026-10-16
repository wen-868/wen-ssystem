# ACTIVE-AI-TOOLS-REG · AI 底座工具注册表接线（P0）

> 派单人：凌舟｜端：**AI 底座**｜执行：**阿洲**（回传责任人：**阿澈**）｜卡名：`/root/s3248_azhou`
> ⚠️ 你不是凌舟；不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> **完整派单卡（DSH 通道用）**：`D:\Users\ZXQL\dispatch\dsh\outbox\AI-TOOLS-REG.md`（本文件是仓内副本/指针）
> 诊断来源（凌舟只读实测）：`docs/reports/跨线-AI底座工具未注册根因-20261017.md`

## 一、问题（一句话）

生产同进程两条日志互相矛盾：`[AdminController] 返回 96 个工具` vs `[ToolExecutor] 已注册工具：107 个`；
`tool-bootstrap.ts` 里 `import … from "./definitions/ai-*"` = **0 处**，`registerAll([...])` 里 27 个办公工具与
`GetSystemStatusTool` **各 0 命中**（后者只在 `tools.module.ts` = Nest DI，**不是执行器注册表**）
⇒ **工具从未进执行器注册表**，生产执行必然报"未注册"。

## 二、交付（三件，逐条见 DSH 卡 §二）

1. **接线**：27 个 `ai-*.tool.ts` + `GetSystemStatusTool` 注入并 `registerAll`（并确认 `tools.module.ts` providers 一致）；
2. **口径收敛**：工具列表端点改读执行器注册表（`ToolRegistry.list()`）⇒ 工具数只留一个真相源；
3. **防复发门禁**：`definitions/*.tool.ts` 文件数 == 注册表条目数 + 具名豁免（含理由），零依赖、`--json`、`--root`。

## 三、判据（逐条给原始输出）

1. 三方一致装置：文件数 / 注册表条目数 / 豁免数 三个数字给全且守恒；
2. **反测 A**：新增 `definitions/xxx.tool.ts` 不登记 ⇒ 门禁 **EXIT=1 并点名**；
3. **反测 B**：从 `registerAll` 摘掉一个已登记工具 ⇒ **EXIT=1 并点名**；
4. 复原 ⇒ **EXIT=0** 且 SHA256 与注入前一致；
5. AI 仓既有门禁/单测全绿 + `nest build` EXIT=0（贴汇总原文）；
6. 给出"注册表里 27 个办公工具 + getSystemStatus 均在册"的原始清单输出。

## 四、红线

只改 AI 仓 `src/tools/**`（+门禁脚本/证据/回传卡）；**不碰** `brain/**`、`gateway/**`、`bridge/**`（=阿澈）与 `migrations/**`；
不得对生产做任何写操作；不得改 MS 仓任何代码；证据不含口令明文；零字节证据配 `<同名>.note.txt`。

## 五、回传

AI 仓 `docs/tasks/cards/R101-AI-TOOLS-REG-阿洲回传.md`（十项）→ **并入阿澈**统一回传；
结构化回执区块**先写** `D:\Users\ZXQL\dispatch\dsh\outbox\AI-TOOLS-REG-receipt-block.txt` 再打印。
