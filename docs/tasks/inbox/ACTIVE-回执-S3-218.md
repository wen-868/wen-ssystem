# ACTIVE-回执 · S3-218（守卫：证据/脚本「不得把敏感键的值写进日志或证据」）

- **汇报对象**：凌舟（总负责人）
- **汇报人**：阿坚（后端 / 门禁 · 本地子代理通道 `/root/s3222_guard`）
- **日期**：2026-10-16
- **对应派单编号**：S3-218（收口总清单第 70 项）
- **工作树 / 分支**：`D:\Users\ZXQL\wt-agents\S3-218` ｜ `chore/s3-218-evidence-secret-guard`（基线 `origin/main` = `c2638361`）
- **完整十项回传**：`docs/tasks/cards/R101-S3-218-阿坚-回传.md`
- **证据索引**：`docs/evidence/S3-218/README.md`

## 一、改了什么

1. **新增守卫** `backend/scripts/guard-evidence-secrets.mjs`（零外部依赖，只 `node:fs` / `node:path`）：
   把"敏感键的**值**被写进日志/证据"从"靠人盯"变成"门禁可拦"。判据 R1 = 日志/打屏调用
   （`console.*` / `process.stdout.write` / 本仓自建 tee 包装器 `say()/log()/tee()/print()/println()/originalLog()`）
   的实参里，敏感键标识符（`/(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|CREDENTIAL)/i`）的值经
   **模板插值 / 字符串拼接 / 直接传参**写出 ⇒ 命中。
   四类安全例外：结论型（比较、`.length`、`Boolean(x)`、`typeof`、两支均字面量的三元、`*Matches`）、
   脱敏占位（`已脱敏` / `<masked>` / `****`）、**值先经脱敏函数**（`redact`/`mask*`/`sanitize`/`obscure`/`desensitize`）、
   显式 allowlist（具名 `文件 + 行 + 理由 + 归属单号`，同时用于剔除与打印；0 命中只 `warn` 不判红）。
2. **卡外收口 1 处（已报备）**：`docs/evidence/C2-4/tools/c2-4-ts-loader-smoke.mjs:15`
   的 `JWT_SECRET=${env.JWT_SECRET}` → `${env.JWT_SECRET ? "已配置" : "未配置"}`（口径同第 69 项）。
3. **证据包** `docs/evidence/S3-218/**`（含反测夹具 `neg/demo-inject.mjs`，位于扫描范围之外）。

## 二、证据（可复跑 + 原始输出）

| 判据 | 读数 | 文件 |
|:--|:--|:--|
| 绿（人读 / 机读） | `PASS（命中 0 处 / 豁免 1 处）`、**EXIT=0**；`ok=true`、`scannedFiles=159` | `02-绿侧-guard.txt` / `01-绿侧-guard.json` |
| 红（真反测） | 注入两行 ⇒ **EXIT=1**，点名 `backend/scripts/demo-inject.mjs:18`（DEMO_PASSWORD）与 `:19`（API_TOKEN） | `03-反测-红侧.txt` |
| 回声侧 | 去掉注入 ⇒ `PASS`、**EXIT=0** | `03-反测-回声侧.txt` |
| allowlist 两侧 | ①真实命中登记 ⇒ 命中 2→1 且打印豁免；②登记不存在的行 ⇒ 只 `warn`、**EXIT=0** | `04-allowlist两侧.txt` |
| 不误伤面 | 159 个脚本（evidence 侧 113 个，含 `MIG-1/**`、`MIG-5/**`、`D1-S3-57/**` 等历史快照）⇒ **命中 0** | `05-扫描面清单.txt` |
| 自证 | `node --check`=0；非 `node:fs`/`node:path` 的 import 行数 0 | `06-可复跑自证.txt` |
| 哈希 / diff | 守卫 `AF5BAA68…`；C2-4 `176EAE24…` → `7E8B5AA8…` | `07-哈希.txt` |

**首跑 3 处命中的定性（全量，卡面 §四.5）**：① `s3-160-remember-me.mjs:93` 误报（值已过 `redact()`）⇒ 收窄判据；
② `c2-4-ts-loader-smoke.mjs:15` **真问题** ⇒ 就地收口；③ `mysql-smoke-test.mjs:174` 误报（常量名含 CREDENTIAL、值是提示文案）⇒ 登记 allowlist。

## 三、阻塞点

**无阻塞**。未做的事都属卡面明令不做：未接 CI（`.github/**` 是红线，交凌舟合并时接线）、未 push、未开 PR、
未改产品代码 / 迁移 / 契约 / 收口总清单、未动共享路由表 `docs/tasks/inbox/ACTIVE.md` 与 `current-tasks.md`。

## 四、需你处置（不属本单动手范围）

1. 验收后**归档** `docs/tasks/inbox/ACTIVE-S3-218.md`，并把 `ACTIVE.md` 里 `/root/s3222_guard` 一行移出「在办」（该文件多 agent 共用，本单按纪律未动）。
2. 裁定 §九 五项（卡外收口是否接受、脱敏函数是否要求核验实现、③ 是否改用收窄判据、CI 接线形态、是否接入本地自检）。

派单人：凌舟（总负责人）｜2026-10-16　　执行方：阿坚（后端/门禁）｜2026-10-16
