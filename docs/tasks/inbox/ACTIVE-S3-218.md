# ACTIVE-S3-218 · 守卫：证据/脚本「不得把敏感键的值写进日志或证据」（收口总清单第 70 项）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 门禁）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树（**本单唯一允许写的工作树**）：`D:\Users\ZXQL\wt-agents\S3-218`｜分支 `chore/s3-218-evidence-secret-guard`
> 卡名（认领用）：`/root/s3222_guard`（见 `docs/tasks/inbox/ACTIVE.md` 路由表）
> 依据：`docs/tasks/cards/R101-S3-217-第69项-证据脚本凭据家族-凌舟处置.md`（定性 + 政策分层）

---

## 一、一句话目标

新增一个**零依赖、可独立复跑**的守卫 `backend/scripts/guard-evidence-secrets.mjs`：
**把"敏感键的值被写进日志/证据"从"靠人盯"变成"门禁可拦"**（第 69 项的真实缺口就是靠人眼看出来的）。

## 二、要拦什么（v1 判据，宁准勿宽）

**扫描范围**（只看**可执行脚本**，不看历史捕获物）：
- `docs/evidence/**/harness/**/*.{mjs,js,ts}`、`docs/evidence/**/tools/**/*.{mjs,js,ts}`
- `scripts/**/*.{mjs,js}`、`tests/**/*.mjs`、`backend/scripts/**/*.mjs`
- **排除**：`**/outputs/**`、`**/raw/**`、`**/archive/**`、`**/ref/**`（历史捕获物按 §四-B 层政策原样保留）

**规则 R1（红）**：凡把"敏感键标识符的**值**"写进日志/标准输出的语句 ⇒ 命中。
判定要点：日志调用（`console.log/error/warn`、`process.stdout.write`、以及本仓自建的 `say()/log()` tee 包装器调用）
的实参里出现**插值或字符串拼接**的标识符名匹配
`/(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|CREDENTIAL)/i`。

**安全例外（不算命中，必须写进守卫注释）**：
- 表达式是**布尔/比较/长度**等"结论型"：`...Matches`、`Boolean(x)`、`x ? "已配置" : "未配置"`、`x.length`、`x === y`；
- 实参是**字面量**、或明确写着脱敏占位（如含 `已脱敏`、`<masked>`、`****`）；
- 命中项落在**显式 allowlist**（见下）。

**allowlist 机制**（必须有，且与"剔除"同源，避免两套逻辑跑偏）：
以**具名常量数组**登记 `文件相对路径 + 行号 + 理由 + 归属单号`，守卫**同时**用它剔除、并在 `--json` / 人读输出里逐条打印；
若登记的 allowlist 项**全程 0 命中** ⇒ 只 `warn`（选择器可能已失效），**不判红**。

## 三、接口与输出（沿用本仓守卫家族形态）

- `node backend/scripts/guard-evidence-secrets.mjs` ⇒ 人读输出；`EXIT=0` 绿 / `EXIT=1` 红（**零 `continue-on-error`、零 `|| true`**）；
- `--json` ⇒ 机读（命中数组：文件、行、列、命中标识符、判据）；
- `--root <dir>` ⇒ 指向临时副本（供反测用，**不要**改仓内文件）；
- 命中时**逐条打印 `文件:行` 与那一行的**（便于定位），并给出"怎么改"的一行提示（改脱敏/改结论型/登记 allowlist）。

## 四、验收判据（逐条给原始输出）

1. **绿**：在**当前树**上跑 ⇒ `EXIT=0` 且命中 0；把 `--json` 原始输出落证据；
2. **红（真反测）**：在**临时副本**里注入两行——
   ```js
   console.log(`DEMO_PASSWORD=${DEMO_PASSWORD}`);          // R1：值进日志
   say(`TOKEN=${process.env.API_TOKEN}`);                  // R1：值进 tee
   ```
   ⇒ `EXIT=1` 且**精准点名这两处文件:行**；
3. **回声侧**：把注入删掉 ⇒ 回到 `EXIT=0`（证明不是恒红）；
4. **allowlist 两侧**：① 把一个真实命中登记进 allowlist ⇒ 该条不再判红、且输出里出现 allowlist 打印；② 把 allowlist 里**不存在的**行登记进去 ⇒ 只 `warn`、**EXIT 仍为 0**；
5. **不误伤面**：跑一遍全仓（含 `docs/evidence/MIG-5/**`、`D1-S3-57/**` 等历史快照）⇒ 命中 0（若有命中，逐条给文件:行 + 你的定性：真问题 / 应加 allowlist / 判据需收窄）；
6. **可复跑自证**：`node --check backend/scripts/guard-evidence-secrets.mjs` = 0；脚本**零外部依赖**（只 `node:fs`/`node:path`/`node:process`）。

## 五、红线

1. **不得**改产品代码（`backend/src/**`、`admin-web/**`、`app-mobile/**`、`saas-admin/**`、`docs/migrations/**`）；
2. **不得**改 `.github/**`（**CI 接线由凌舟在合并时完成**，你只需交出"CI 等价命令"与本地实测输出）；
3. **不得**为了让自己变绿而放宽 §二 的判据、删减扫描面或加匿名过滤；
4. **不得**碰其它单的工作树（`wt-agents/S3-214`、`wt-agents/S3-219`、`wt-agents/S3-211`、`wt-agents/S3-212`）；
5. **不得** push、**不得**开 PR、**不得** `git add -A`；
6. 你自己的证据/日志里**不得出现口令或密钥明文**（本单就是在治这个）；
7. 回传卡**不得**出现「凌舟裁定 / 凌舟验收」字样。

## 六、交付物

1. 守卫脚本：`backend/scripts/guard-evidence-secrets.mjs`（含 allowlist 常量 + 注释里写明"为什么这些是安全例外"）；
2. 证据：`docs/evidence/S3-218/**`（绿侧 `--json` 原始输出、红侧注入前后原始输出、allowlist 两侧输出、全仓扫描输出）；
3. 回传：`docs/tasks/cards/R101-S3-218-阿坚-回传.md`（十项格式）+ `docs/tasks/inbox/ACTIVE-回执-S3-218.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据（可复跑命令 + 原始输出）｜ 验收自评（对照 §四 逐条）｜ 未完成与阻塞 ｜
风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡

## 七、卡外纪律

- 发现卡外问题 ⇒ **只登记不动手**，写进回执 §六；
- 若 §四-5 的全仓扫描出现**大量**命中 ⇒ 不要自行放宽判据，也不要逐个改别人单的证据：**先把命中原样列出来 + 你的分类建议**，在回执里等凌舟裁定。
