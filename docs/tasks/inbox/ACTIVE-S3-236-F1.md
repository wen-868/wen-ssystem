# ACTIVE-S3-236-F1 · S3-236 **返工单**（凌舟亲跑判红：1 处真数据缺陷 + 若干用例判据形态缺陷）

> 派单人：凌舟｜日期：2026-10-17｜执行方：**DSH（续用同一克隆）**
> ⚠️ 你不是凌舟；不得写「凌舟裁定 / 验收结论」；只动本工作树；不得 push、不得开 PR。
> 工作树：`C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-S3-236`｜分支：`dsh/S3-236`

## 〇、背景：你的回执说 DONE，我亲跑判红

你交了两笔提交（`6ee75492` / `7dc4460a`）、回执 `DONE`、自证装置 10/10 PASS（`raw/70-three-way-verify.txt`）。
我把你的分支 rebase 到当前 main 后**亲跑出货用例**，结果：

```
src/__tests__/shared/batch2-permission-codes.test.ts (60 tests | 9 failed)
```

⇒ **判红，返工**。逐条定性如下（我已把"真缺陷"与"用例缺陷"分开）。

## 一、必须修（真数据缺陷 1 处 → 引发 3 条红）

`backend/src/shared/report-permission-codes.ts` 把路径参数写成了 **`#id#`**（不是 Express 语法；同文件另一半却用 `:id`，**两套占位符并存**）：

| 行 | 现值 | 应为 |
|--:|:--|:--|
| 42 | `"PUT /api/admin/reports/#id#"` | `"PUT /api/admin/reports/:id"` |
| 55 | `"DELETE /api/admin/reports/#id#"` | `"DELETE /api/admin/reports/:id"` |
| 68 | `"POST /api/admin/reports/#id#/generate"` | `"POST /api/admin/reports/:id/generate"` |

**要求**：① 改成 `:id`；② **全文件扫一遍**同类形态并清零（给 `rg -n '#[A-Za-z_]+#' backend/src/shared/` 的原始输出 = 0 命中）；
③ 说清根因（是抄错还是生成器产物错），若来自生成器 ⇒ 连生成器一起修（否则下次还会出）。

## 二、用例判据形态缺陷（3 类，逐条修 + 每条给反测）

1. **红线判据过宽**：`batch2-permission-codes.test.ts` 里
   `expect(executable).not.toMatch(/t_sys_role/i)` —— 只剥注释、不区分读写 ⇒ 迁移 207 里两条
   `SELECT r.id FROM t_sys_role r`（第 110/196 行，查父行/角色 id 的**只读**语句）被误判为违规。
   **改为**：只查写语句（`UPDATE|INSERT|DELETE|REPLACE` 且目标 `t_sys_role`）；
   **反测**：注入一行 `UPDATE t_sys_role SET permissions='[]' …` ⇒ **必红并点名**；把 SELECT 保留 ⇒ **仍绿**。
2. **端点存在性判据不认"多挂载段"**：判据只看单段 `prefix: "…"` 或完整路径字面量，而
   `store-hardware.routes.ts:27` 这类是 `{ prefix: "/api/store/hardware/cloud-speaker", router: … }` +
   段内相对路径注册 ⇒ 误判 `store:hardware:announce` / `store:hardware:box-pay` 等。
   **改为**：解析**多段 routeConfig 数组**，按"段前缀 + 段内相对注册行"两段核对（**你自证装置 `three-way` 里就是这么做的**——
   出厂用例反而比自证装置弱，这正是本次返工要点）；
   **反测**：删掉其中一段挂载 ⇒ **必红并点名该段**；复原 ⇒ 绿。
3. **命名/唯一性那条（第 1 条 FAIL）**：请给**原始断言输出**与你的定性（是数据错还是判据错）；若是判据错，同规则修 + 反测。

## 三、判据（逐条给原始输出，缺一条即未完成）

1. `cd backend && npx vitest run src/__tests__/shared/migration-c6-4-1.test.ts src/__tests__/shared/batch2-permission-codes.test.ts` ⇒ **0 failed**；
2. `node backend/scripts/guard-rbac-wiring.mjs --strict` ⇒ **EXIT=0**；
3. `node backend/scripts/guard-migration-manifest.mjs` ⇒ **EXIT=0**（A 187 / C 8 / B 12 = 207）；
4. `npx tsc -p tsconfig.json --noEmit` ⇒ **0**；
5. §一 的 `rg` 原始输出 = **0 命中**；§二 两类反测各有"注入 ⇒ 红 / 复原 ⇒ 绿"的原始输出；
6. 追加提交（**逐路径 `git add`**，不得 `git add -A`），`git status --short` 干净（`.npm-cache/` 不要提交）。

> 备注（环境）：克隆里没有安装依赖 —— 若要跑用例，可把主仓的 `node_modules` 与 `backend/node_modules`
> 以目录联接（junction）指向 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem\...` 复用（我本轮就是这么跑的）；**不要**为此 push。

## 四、红线

不得 push / 开 PR / `git add -A`；不得改 `.github/**`、`deploy/**`（`deploy/migrations-manifest.txt` 若由生成器重跑产生差异可提交）、
`docs/tasks/inbox/**`、`docs/tasks/R101-收口总清单.md`、业务路由代码；不得写"凌舟裁定/验收结论"字样。

## 五、回传

更新 `docs/tasks/cards/R101-S3-236-DSH回传.md`（十项；把本轮**定性**与反测原始输出写进去），
并把 `===DSH-RECEIPT-BEGIN=== … ===DSH-RECEIPT-END===` 区块**先写入**
`D:\Users\ZXQL\dispatch\dsh\outbox\S3-236-receipt-block.txt`，再打印到标准输出。
