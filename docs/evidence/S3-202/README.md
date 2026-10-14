# S3-202 证据包（文档债收口：收口总清单第 24、25 项）

- 执行方：阿坚（文档/维护 · 本地子代理通道 `/root/s3205_ajian`）｜2026-10-15
- 工作树：`D:\Users\ZXQL\wt-agents\S3-202`｜分支 `chore/s3-202-docs-debt`｜基线 `origin/main = 5d8f46df`
- 红线自检：只改 `docs/**`；未 push、未开 PR；未动 `.github/**`、`deploy/**`、`R101-收口总清单.md`、业务代码
- 结论：**第 24 项 7 条指路注释（5 文件）＋ 第 25 项 19 处旧口径就地订正（6 文件）**；全仓新增 30 行、删除 0 行；`docs/evidence/S3-202/**` 为新增证据目录

---

## 一、复跑命令（全部在 `D:\Users\ZXQL\wt-agents\S3-202` 下执行）

```powershell
node docs/evidence/S3-202/s3205-insert-pointer.mjs        "D:/Users/ZXQL/wt-agents/S3-202"          # 第24项（幂等：已插过的会跳过）
node docs/evidence/S3-202/s3205-verify-literal-count.mjs  "D:/Users/ZXQL/wt-agents/S3-202"          # 第24项 字面量计数不变
node docs/evidence/S3-202/s3205-memories-annotate.mjs     "D:/Users/ZXQL/wt-agents/S3-202"          # 第25项（幂等）
node docs/evidence/S3-202/s3205-final-verify.mjs          "D:/Users/ZXQL/wt-agents/S3-202"          # 终验（只读，输出即本目录 10-final-verify.log）
git -c core.quotepath=false diff --numstat -- docs            # 全量改动面（应为 +30 / -0）
```

**第 25 项的"可复跑基线"**（把 apply 前的原始字节还原到临时目录再跑一遍，证明读数可复现）：

```powershell
node docs/evidence/S3-202/s3205-replay-baseline.mjs "D:/Users/ZXQL/wt-agents/S3-202" "D:/Users/ZXQL/_s3205-evidence/replay-boundary-20261015"
node docs/evidence/S3-202/s3205-memories-annotate.mjs "D:/Users/ZXQL/_s3205-evidence/replay-boundary-20261015"
```

基线 sha256 与 apply 前记录的 `before` 逐文件一致（见 `05-memories-apply.log` 与 `03-replay-baseline.log`），复跑出来的 `after` 与工作区实际文件一致 ⇒ 读数可复现。

## 二、本目录文件

| 文件 | 内容 |
|:--|:--|
| `s3205-insert-pointer.mjs` | 第 24 项：块内定位 + 加指路注释（含"删掉该行必须逐字节还原原文"的机械自证） |
| `s3205-verify-literal-count.mjs` | 第 24 项：HEAD vs 工作区逐文件字面量计数 + 新增/删除行性质审计 |
| `s3205-memories-annotate.mjs` | 第 25 项：块感知插入订正行（表格/代码块/列表/引用块），含"按记录位置重放必须逐字节一致"自证 |
| `s3205-replay-baseline.mjs` | 第 25 项复跑基线还原（HEAD blob → CRLF 工作区字节） |
| `s3205-final-verify.mjs` | 终验脚本（只读）：改动面、反向自证、逐文件哈希/行尾、新增行性质、字面量计数、锚点保留、对象现状、依据行存在性 |
| `01-insert-pointer.log` | 第 24 项 apply 原始输出（逐条 before/after sha256） |
| `02-literal-count.log` | 第 24 项字面量计数原始输出（PASS） |
| `03-replay-baseline.log` | 第 25 项复跑基线字节数 |
| `04-memories-apply-replay.log` / `04-memories-dryrun.log` / `05-memories-apply.log` | **同一份**第 25 项复跑输出（sha256 三者相同，均为 `F143A2A87B0FB6EF…`）。说明：最初 apply 的日志因 `Tee-Object` 后接 `Select-Object -First/-Last` 被管道提前截断，故用等价复跑输出覆盖，避免本目录留下半截日志；`04-memories-dryrun.log` 里最初那版含 1 处旧措辞（ci.yml 那句），亦已一并覆盖 |
| `10-final-verify.log` | 终验原始输出（8 组判据） |
| `11-hunks-U0.patch` | 全部改动的 `-U0` 补丁（纯新增行，逐处可核对） |
| `12-diff-full.patch` | 全部改动的完整补丁 |

> 注：`git status` 里 `docs/evidence/S3-202/` 显示为未跟踪目录，其中包含本 README；`10-final-verify.log` 是它自己那次运行的输出，故其 §① 的未跟踪清单会列出自身，属预期。

---

## 三、第 24 项：`docs/migrations/*.sql` 历史口令注释 ⇒ 枚举 + 判定 + 处置

### 3.1 全量枚举（`rg -n '^\s*--.*(admin123|Admin@2026|Demo@2026|123456|密码|口令)' docs/migrations --glob '*.sql'`）

**A 类：含"历史示例口令字面量"的注释（本次处置 8 行 / 5 文件 ⇒ 插 7 条指路注释）**

| # | 文件:行（改前） | 原文 | 处置（改后行号） |
|:--:|:--|:--|:--|
| 1 | `002_phase1_seed.sql:5` | `-- 默认密码：admin123` | 其上插指路 ⇒ L5 |
| 2 | `075_reset_admin_password_bcrypt.sql:4` | `-- 默认密码：admin123` | 其上插指路 ⇒ L4 |
| 3 | `075_reset_admin_password_bcrypt.sql:8` | `-- 生成方式：bcrypt.hashSync('admin123', 12)，前缀 v2$ 为系统版本标识` | 其上插指路 ⇒ L9 |
| 4 | `081_platform_admin_seed_and_fix.sql:43` | `-- 3. 插入默认平台超级管理员（admin / admin123）` | 其上插指路 ⇒ L43 |
| 5 | `081_platform_admin_seed_and_fix.sql:44` | `--    密码哈希：bcrypt.hashSync('admin123', 12)，前缀 v2$ 为系统版本标识` | 与 #4 属**同一连续注释块**，由 #4 那条指路一并覆盖（同块重复插注无收益） |
| 6 | `099_seed_data.sql:20` | `-- 默认密码：123456 -> bcrypt hash` | 其上插指路 ⇒ L20 |
| 7 | `127_fix_demo_accounts.sql:1` | `-- 编号: 127, 描述: 修复演示账号（store_manager/store_operator 密码 admin123，bcrypt 兼容哈希）` | 其上插指路 ⇒ L1 |
| 8 | `127_fix_demo_accounts.sql:7` | `-- 1) 修复演示账号密码哈希（v2$ + bcrypt(admin123, cost=12)）` | 其上插指路 ⇒ L8 |

**B 类：判定为"当前有效口径"，按卡"后者不许在这里改" ⇒ 不动**

| 文件:行 | 原文要点 | 理由 |
|:--|:--|:--|
| `197_演示租户隔离.sql:92` | `演示口令 Demo@2026 是公开值（写在前端打包产物与仓内 .env.example）` | 这是 **S3-175 收敛后的现行值**本身，属"当前有效口令"，不是历史示例 |
| `197_演示租户隔离.sql:126`、`:198` | 提到"口令登录"，无口令字面量 | 无字面量 |

**C 类：含"密码/口令"字样但无口令字面量 ⇒ 不动**
`075:1`、`075:2`、`099:19`（`-- 密码统一使用 bcrypt 哈希（$2a$10$ 开头）`）、`127:30`（`-- 3) 校验（应输出 2 行，密码哈希均以 v2$ 开头）`）。

**D 类：字段定义 / 列 COMMENT ⇒ 不动**
`001:47`、`080:13`、`081:16`、`102:23`、`103:2`、`150:1`、`152:15`、`192:100`、`196:6` 等（如 `COMMENT '密码哈希'`）。

**E 类：假命中 ⇒ 不动**
`099_seed_data.sql:101/102`（商品条码含 `6901234567…`）、`:213`（银行账号 `1234567890123456789`）。

### 3.2 指路注释文本（7 处逐字相同）

```
-- ⚠️ 历史示例口令，勿照抄；当前口径见 backend/src/config/constants.ts 的 DEMO_PASSWORD（S3-175 收敛为 Demo@2026）。
```

> ⚠️ **与派单卡示例措辞的偏差（已主动报备）**：卡里给的示例是"见 `docs/项目统一标准.md` 与常量 `definePassword`（唯一来源）"。实测 **`definePassword` 在本仓不存在**（`rg -i definepassword` 全仓 0 命中），且 `docs/项目统一标准.md` 并未定义演示口令值（仅第 10 章第 9 条"禁止硬编码敏感信息"这类通则）。按"取样必须可核对"，改引**真实可核对**的来源：`backend/src/config/constants.ts:22` `DEMO_PASSWORD: "Demo@2026"`（S3-175 新增的唯一出处常量）。

### 3.3 第 24 项验收读数

| 判据 | 读数 | 出处 |
|:--|:--|:--|
| 改动面 | 5 文件 `+7 / -0` | `git diff --numstat -- docs/migrations`、`11-hunks-U0.patch` |
| 新增行全部是注释 | 非 `+-- ` 新增行 = **0** | `10-final-verify.log` §④ |
| 口令字面量数量不变 | 8 组计数全部 `n -> n`，判定 **PASS** | `02-literal-count.log`、`10-final-verify.log` §⑤ |
| 行尾未漂移 | 5 文件均 `i/lf w/crlf`（改前改后一致） | `10-final-verify.log` §③ |
| 机械自证 | 删掉新增行后与原文**逐字节一致** | `s3205-insert-pointer.mjs` 内置断言，`01-insert-pointer.log` |

### 3.4 为什么加注释不会改变迁移行为（附源码依据）

1. 外部迁移管线现为 `splitSqlStatements()` 切分，**先剥离块首整行注释再判空**（`backend/src/shared/migration.ts:1284-1295`；注释剥离实现见 `:365-382` `stripLeadingComments`）⇒ 新增 `--` 行不会被当成"语句块"丢弃，也不会改变语句的首关键字（踩坑[63] 的"以注释开头整块被丢"已修）。
2. 5 个被改文件里紧随注释的都是**数据写语句**（`INSERT` / `UPDATE`），在 **MIG-4 写闸门**下默认一律跳过（`migration.ts:336-359` 定义、`:1269-1275` 打印生效取值），放行须显式 `MIGRATION_WRITE_GATE=allow`。
3. 综上：本次仅新增注释行，**既不改变语句集合，也不改变任何语句的放行判定**。

---

## 四、第 25 项：`docs/memories/*-记忆.md` 旧口径 ⇒ 逐条"旧口径 → 现口径 + 依据"

### 4.1 主表

| # | 文件 | 旧口径（原文位置，**一字未改**） | 现口径 | 依据（可核对） |
|:--:|:--|:--|:--|:--|
| 1 | `凌舟-记忆.md` | §2.2 技术栈表 `\| 门店终端 \| Vue3 (store-terminal) \|`（L346） | `store-terminal` **已删除**；仓内前端仅 `admin-web` / `app-mobile` / `app-shell` / `saas-admin` | commit `8536d7e0`（`git log --diff-filter=D -- store-terminal`）；`docs/项目统一标准.md` §6.1；`git ls-files 'store-terminal/*'` = 0 条 |
| 2 | `凌舟-记忆.md` | §2.3 项目结构树 `├── store-terminal/       # 门店终端（Vue3）`（L377） | 同上 | 同上 |
| 3 | `凌舟-记忆.md` | 部署段 `ci.yml — CI 流水线：… → 构建 store-terminal → …`（L552） | `ci.yml` 前端只构建 `admin-web` / `saas-admin`，无 store-terminal 步骤 | `.github/workflows/ci.yml:167`、`:181`（`rg -c store-terminal .github/workflows/ci.yml` = 0） |
| 4 | `凌舟-记忆.md` | §八 质量状态表 `\| 生产环境API可用性 \| ❌ 500错误 \| 登录API返回 {"code":"500"}…`（L726） | 生产登录接口**可用**：口令错 ⇒ 401 / 账号锁定（不是 500） | `docs/踩坑日志.md` [130]（2026-09-26，生产实测 15 项红中含"凭据不对"）、[135]（"缺凭据要吵，不要静默"）；`docs/tasks/R101-收口总清单.md:54`（2026-10-13 生产只读实测 `login_fail_count` 18→19）；`docs/memories/阿坚-记忆.md`「R54 遗留 — 生产环境登录API 500错误修复」 |
| 5 | `凌舟-记忆.md` | §十 迁移检查清单 `- [ ] npm install 在 backend/admin-web/app-mobile/store-terminal 全部执行`（L763） | 该清单里的 store-terminal 已不存在 | 同 #1 |
| 6 | `阿坚-记忆.md` | §1.2 团队表 `\| 阿澈 \| 商户端 merchant-mobile 前端 + DDL/迁移 + 营销 + 系统设置 \|`（L31） | `merchant-mobile` **已删除**，商户端前端目录现为 `app-mobile` | commit `8536d7e0`（同提交一并删除 store-terminal / merchant-mobile）；`docs/项目统一标准.md` §6.1 |
| 7 | `阿坚-记忆.md` | §17.1 `- **路径**：backend/ai-base/（独立 NestJS 子项目…）`（L917） | `backend/ai-base` **已物理删除**（源码归档仓库外）；仓内仅存 `docs/ai-base/*.md` 文档；AI 底座代码在独立仓 `D:\Users\ZXQL\ZXQL-AI` | commit `e9361c9c`（`chore(S3-36 二期): 物理删除非部署副本 backend/ai-base …`）；`git ls-files 'backend/ai-base/*'` = 0 条 |
| 8 | `阿坚-记忆.md` | §9.2 自动迁移机制（只写 `safeExec` / `SKIP_PATTERNS`）（L710-717） | **口径补充（补充非推翻）**：切分改走 `splitSqlStatements`（块首整行注释剥离后再判空，踩坑[63] 已修）；MIG-4 写闸门默认 `block`，`INSERT/UPDATE/DELETE/REPLACE/CALL` 一律跳过，放行须显式 `MIGRATION_WRITE_GATE=allow` | `backend/src/shared/migration.ts:336-359`、`:1284-1295` |
| 9 | `墨-记忆.md` | §1 技术栈表（L53）／`### store-terminal 前端`（L1306）／§十一 自查清单 `- [ ] cd store-terminal && npx eslint src/`（L1360）／§常用命令 `cd store-terminal && npx --no eslint src/`（L1386，4 处） | 同 #1 | 同 #1 |
| 10 | `林夕-记忆.md` | §2.2 技术栈表 `\| 门店终端 \| Vue3（store-terminal，待建）\|`（L49）／§2.3 前端项目列表 `\| store-terminal \| … \| 待建 \|`（L62）／§12 端尺寸表 `\| store-terminal \| 1024px Tablet \| …`（L675，3 处） | 同 #1 | 同 #1 |
| 11 | `苏然-记忆.md` | §2.2 检查项表 `\| store-terminal \| npx eslint src/ \| …`（L38）／§四 命令 `cd store-terminal && npx eslint src/`（L516）／§七 项目结构树 `├── store-terminal/`（L676，3 处） | 同 #1 | 同 #1 |
| 12 | `阿澈-记忆.md` | 头部 `> 职责：商户端 merchant-mobile 前端 + DDL/迁移 + …`（L5） | 同 #6 | 同 #6 |

### 4.2 逐文件 diff 规模

| 文件 | numstat | 插入处数（条数） | 行尾（改前→改后） |
|:--|:--|:--:|:--|
| `凌舟-记忆.md` | +7 / −0 | 5 | `i/lf w/crlf` → `i/lf w/crlf` |
| `墨-记忆.md` | +5 / −0 | 4 | `i/crlf w/crlf` → `i/crlf w/crlf` |
| `林夕-记忆.md` | +3 / −0 | 3 | `i/crlf w/crlf` → `i/crlf w/crlf` |
| `苏然-记忆.md` | +4 / −0 | 3 | `i/lf w/crlf` → `i/lf w/crlf` |
| `阿坚-记忆.md` | +3 / −0 | 3 | `i/lf w/crlf` → `i/lf w/crlf` |
| `阿澈-记忆.md` | +1 / −0 | 1 | `i/lf w/crlf` → `i/lf w/crlf` |
| **合计** | **+23 / −0** | **19** | 无漂移 |

> `+23` = 19 条订正行 + 4 个必要的空行分隔（表格/列表后接引用行时补一个空行，保证 Markdown 渲染不错行）。

### 4.3 订正方式与"不删历史"的落实

- **只新增、不改写**：原写法一律保留在原位（`10-final-verify.log` §⑥ 逐条断言锚点仍命中 1 处）；订正行以 `> ⚠️ 旧口径订正（…）：… 依据 …` 的形式紧随其所在**块之后**（表格后 / 代码块后 / 列表项后 / 引用块后），不改任何表格结构。
- **判定边界（本次刻意不含）**：各成员记忆里的大量 **历史任务记录**（如"R9-M2 store-terminal ESLint 0 error ✅"、"R36 412 文件 4725 用例"这类当期快照）**不是"旧口径"**，而是历史留痕，按"不要删历史"未做任何标注。本次只订正**描述"当前状态/结构/命令/清单"的表述**。

---

## 五、终验判据与读数（`10-final-verify.log`）

| # | 判据 | 读数 |
|:--:|:--|:--|
| ① | 改动面只在 `docs/**` | 11 个已跟踪文件 + 本证据目录；非 `docs/` 前缀 = **0** ✔ |
| ② | 反向自证：`.ts/.js/.mjs/.cjs/.vue/.html/.css/.json` 改动 | **0** ✔ |
| ③ | 逐文件 `+/-`、行尾、sha256（HEAD blob → 工作区） | 见原文；删除行全为 0；行尾无漂移 |
| ④ | 新增行性质 | 新增 30 行 / 删除 0；migrations 非注释新增 = 0；memories 非 `> ⚠️`/非空新增 = 0 ✔ |
| ⑤ | 口令字面量计数不变 | 8 组 `n -> n`，PASS ✔ |
| ⑥ | 原写法（锚点）仍在 | 7 条锚点各命中 1 处 ✔ |
| ⑦ | 被引用为"已删除"的对象现状 | `store-terminal/*`、`backend/ai-base/*` 均 0 条；删除提交 = `8536d7e0`、`e9361c9c` ✔ |
| ⑧ | 引用依据行存在 | `docs/项目统一标准.md`「移动端不做独立」、`R101-收口总清单.md:54`、`migration.ts` 的 `MIGRATION_WRITE_GATE` 均存在 ✔ |

> 说明：§③ 的 `sha256` 取自 `git show HEAD:<path>`（索引 blob，LF 归一化），与 apply 脚本按**工作区字节**（CRLF）记录的 `before` 不同（本仓 `core.autocrlf=true`）。两组读数的用途不同：前者验"提交前后差异"，后者验"工作区字节级未动邻行"。
