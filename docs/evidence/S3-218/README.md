# S3-218 证据包 · `guard:evidence-secrets`（收口总清单第 70 项）

> 执行方：阿坚（后端 / 门禁 · 本地子代理通道 `/root/s3222_guard`）｜日期：2026-10-16
> 工作树：`D:\Users\ZXQL\wt-agents\S3-218`｜分支：`chore/s3-218-evidence-secret-guard`（基线 `origin/main` = `c2638361`）
> 交付物：`backend/scripts/guard-evidence-secrets.mjs`（零外部依赖，只 `node:fs` / `node:path`；**未接 CI**，`.github/**` 属本单红线）

## 一、判据 R1 一句话

日志 / 打屏调用的实参里，把**敏感键标识符的值**写出去 ⇒ 命中。
敏感键 = 名字匹配 `/(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|CREDENTIAL)/i`；"写出去" = 模板插值 `${X}`、字符串拼接 `"…" + X`、直接传参 `log(X)`。
安全例外：结论型（比较 / `.length` / `Boolean(x)` / `typeof` / 两支均字面量的三元 / `*Matches`）、脱敏占位（`已脱敏` / `<masked>` / `****`）、**值先经脱敏函数**（`redact` / `mask*` / `sanitize` / `obscure` / `desensitize`）、显式 allowlist。

## 二、本包文件（对照派单卡 §四）

| # | 卡面判据 | 文件 | 读数 |
|:--|:--|:--|:--|
| 1 | §四.1 绿 + `--json` 原始输出 | `01-绿侧-guard.json` | `ok=true`、`hits=[]`、`scannedFiles=159`、`scannedList` 逐条在册 |
| 1 | §四.1 绿（人读） | `02-绿侧-guard.txt` | `PASS（命中 0 处 / 豁免 1 处）`，`EXIT=0` |
| 2 | §四.2 红（真反测） | `03-反测-红侧.txt` | 注入两行 ⇒ `EXIT=1`，**精准点名 `backend/scripts/demo-inject.mjs:18`（DEMO_PASSWORD）与 `:19`（API_TOKEN）** |
| 3 | §四.3 回声侧 | `03-反测-回声侧.txt` | 去掉注入 ⇒ `PASS`、`EXIT=0`（证明不是恒红） |
| 4 | §四.4 allowlist 两侧 | `04-allowlist两侧.txt` | ① 真实命中登记后由「命中 2 处」→「命中 1 处」并打印豁免行；② 登记不存在的行 ⇒ 只 `warn`、`EXIT=0` |
| 5 | §四.5 不误伤面 | `05-扫描面清单.txt` | 实扫 159 个文件（evidence 侧 113 个，含 `MIG-1/**`、`MIG-5/**`、`D1-S3-57/**`、`S3-190/**`、`S3-210/**` 等历史快照）⇒ **命中 0** |
| 6 | §四.6 可复跑自证 | `06-可复跑自证.txt` | `node --check` = 0；非 `node:fs`/`node:path` 的 import 行数 = 0 |
| — | 改动面与哈希 | `07-哈希.txt` | 三个改动文件 SHA256 + C2-4 脚本 HEAD 版本哈希 + 该文件 diff 全文 |
| 2 | 反测夹具（故意命中） | `neg/demo-inject.mjs` | 两行命中形态；**不在扫描范围内**（无 harness/ 或 tools/ 段），反测时复制到临时 root |

## 三、卡面 §四.5 要求的三处命中逐条定性（**全量，不是抽样**）

守卫首次真跑在本仓命中 3 处，逐条定性如下（没有为凑绿而放宽判据、没有加匿名过滤）：

| # | 文件:行 | 事实 | 定性 | 处置 |
|:--:|:--|:--|:--|:--|
| ① | `backend/scripts/s3-160-remember-me.mjs:93` | 实参 `token=${redact(data.token)}`，`redact()` 返回 `<已脱敏 len=N sha256=xxxxxxxx>`（该文件第 42 行） | **误报（判据过宽）** | **收窄判据**：新增"值先经脱敏函数（`redact`/`mask*`/`sanitize`/`obscure`/`desensitize`）后再输出"这一安全例外；判据按函数命名认，不跨文件核验实现（已在文件头写明） |
| ② | `docs/evidence/C2-4/tools/c2-4-ts-loader-smoke.mjs:15` | `JWT_SECRET=${env.JWT_SECRET}`，把 env 值写进 stdout | **真问题**（口径同第 69 项：证据/日志不得承载敏感键的值；即便该值是本脚本自设的 smoke 值） | **就地收口**：改成 `${env.JWT_SECRET ? "已配置" : "未配置"}`，只留结论；判据不受影响（该行只声明"env 已加载"）。见 `07-哈希.txt` 的 hash 对照（`176EAE24…` → `7E8B5AA8…`）与 diff 全文 |
| ③ | `scripts/mysql-smoke-test.mjs:174` | 实参 `${CREDENTIAL_MISSING_HINT}`，该常量（第 56 行）值是提示文案「未配置 SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD，冒烟无法执行」 | **误报（命名误伤，非值泄露）** | **登记 allowlist**（具名 + 理由 + 归属单号 `S3-218`），守卫输出里逐条打印该豁免 |

> 另：`docs/evidence/S3-174-F1-凌舟复核/tools/s3174-demo-tenant-verify.mjs` 等文件在首轮 50 条候选里出现，全部因**扫描器缺陷**（实参在大括号嵌套处失控、把字面量里的词当成值）误报；修掉扫描器后为 0 命中，属工具自身缺陷已修，不记在仓库头上。

## 四、可复跑命令（工作树根目录）

```powershell
# 绿（人读 / 机读）
node backend/scripts/guard-evidence-secrets.mjs            # EXIT=0
node backend/scripts/guard-evidence-secrets.mjs --json

# 反测（红 / 回声）：把夹具复制到临时 root 的 backend/scripts/ 下，用 --root 指过去
node <tmp>\backend\scripts\guard-evidence-secrets.mjs --root <tmp>        # 有夹具 ⇒ EXIT=1，点名夹具行
node <tmp2>\backend\scripts\guard-evidence-secrets.mjs --root <tmp2>      # 无夹具 ⇒ EXIT=0
```

## 五、边界（写在明处）

静态扫描 + 判据字符串匹配，**不是 AST**：`eval` / `new Function` / 动态拼 key 等间接形态覆盖不到；正则字面量里的括号/斜杠会干扰结构扫描（后果是漏报，不是误报）；判据按**函数命名**认脱敏包装，不核验其实现是否真脱敏。
