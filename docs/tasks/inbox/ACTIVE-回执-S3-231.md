# ACTIVE-回执 · S3-231（S3-229 验收异议整改）

> **汇报对象**：凌舟（总负责人）｜**汇报人**：阿坚（后端 / 权限）· `/root/s3229_ajian`｜**日期**：2026-10-16｜**派单编号**：S3-231
> 工作树 `D:\Users\ZXQL\wt-agents\S3-229`｜分支 `feat/s3-229-store-and-marketing-wiring`

## 一、三项异议逐条整改

### 1. 「代码零改动分支是假分支」⇒ 给出可复核 ref（三种等价取得方式 + blob 哈希 + 端到端验证）

- 代码 ref = **`ebbc15e3`**（分支 `feat/s3-229-store-and-marketing-wiring`，工作区干净）。
- **自包含 bundle**：`D:\Users\ZXQL\agents-logs\S3-229-ref-ebbc15e3.bundle`（SHA256 见 `06-bundle-verify.txt`）；
  **瘦 bundle**（前提=已有基线 `63ee9775`）：`…-ebbc15e3-thin.bundle`。
- **端到端验证**（`05-ref-verify.txt`）：把 bundle 取到**独立临时副本**（`git init` + `fetch` + `checkout`）后：
  ① 8 个关键文件 blob 哈希**逐文件一致（8/8）**；② 副本上 `--strict` **EXIT=0** 且全量输出 SHA256 `4FC6A6C4…DEE4B` 与工作树三连读数**逐字节相同**；
  ③ 副本上 `derive-counts.mjs` **EXIT=0**，九字段全 PASS。
- ‖ 说明：门禁与派生脚本**只依赖 node 内置模块** ⇒ 验收方**无需安装依赖**即可复核（vitest 才需要依赖）。
- ⚠️ **未 push**（派单卡红线 4 仍生效）；远端要 ref 请授权，我立即推。

### 2. 「门禁三处关键读数被目录噪声污染」⇒ 三处读数各三连复跑，只留关键行 + 全量哈希

| 读数 | 命令 | 三连结果 | 关键行文件 |
|:--|:--|:--|:--|
| ① `--strict` | `node backend/scripts/guard-rbac-wiring.mjs --strict` | **EXIT=0 ×3**，全量输出三连**逐字节一致**（SHA256 `4FC6A6C4…DEE4B`，39,300 B） | `01-strict-3runs.txt`（只留「台账核对」4 行 + EXIT + 全量哈希） |
| ② 报告模式 | `node backend/scripts/guard-rbac-wiring.mjs` | **EXIT=0 ×3**，三连一致（SHA256 `69AD6476…B82ED3`，39,175 B） | `02-report-3runs.txt`（只留「已接线/缺口」那一行） |
| ③ 机读模式 | `node backend/scripts/guard-rbac-wiring.mjs --json` | **EXIT=0 ×3**，三连一致（SHA256 `B2EA7E3A…26FABB`） | `04-json-3runs.txt` |

**读数只有三个数**：**已接线 337 处 ／ 缺口 378 处（113 文件）／ 未登记 0 + 陈旧 0（EXIT=0）**。
噪声澄清（实测）：读数①/② 的全量输出里字符串 `403` 出现 **0 次** ⇒ 本单读数文件里**不存在**任何 403 行；
若验收侧看到 403 告警行，来源不在本单这三份读数里 —— **请给出具体文件或命令，我立刻定位**。

### 3. 「`_counts` 三字段疑似错位」⇒ 逐字段独立复算（台账自述不算证据），九字段全 PASS

单命令复核：`node docs/evidence/S3-231/tools/derive-counts.mjs`（EXIT=0 即全对；原始输出 `03-counts-field-by-field.txt`）

| 字段 | 台账 | 实测重建 | 判定 | 实测方式（独立于台账） |
|:--|--:|--:|:--|:--|
| `files` | 113 | 113 | PASS | `--json` 中 `hasPermission=false && authForm='none'` 的**去重文件数** |
| `endpoints` | 378 | 378 | PASS | 同上的端点数 |
| `consumerEndFiles` | 5 | 5 | PASS | `authForm='consumer'` 去重文件数 |
| `consumerEndEndpoints` | 45 | 45 | PASS | `authForm='consumer'` 端点数 |
| `readOnlyPostFiles` / `readOnlyPostEndpoints` | 3 / 3 | 3 / 3 | PASS | `authForm='read-only'`（脚本 `READ_ONLY_POSTS` 登记） |
| `wiredEndpoints` | 337 | 337 | PASS | `hasPermission=true && authForm ∈ {inline,use-mount}` |
| `scannedEndpoints` | 763 | 763 | PASS | `--json` 行数 |
| `wiredPermOccurrences` | 308 | 308 | PASS | `routes/*.routes.ts` 里 `requirePermission(` 的**出现次数**（源码实测） |

**守恒式**：`378 + 45 + 3 + 337 = 763 = scannedEndpoints` ✅（且门禁四桶 `false|none` 378 / `true|inline` 337 / `false|read-only` 3 / `true|consumer` 45 之和 = 763）

**两个口径的差额分解**（证明不是错位，而是口径不同）：`308（用例口径）+ 32（门禁把平台侧端点算已接线）− 3（挂在 GET 行上的出现次数，源码实测 admin-library.routes.ts）` = **337 = `wiredEndpoints`** ✅

## 二、本次整改改了哪些文件（**零业务代码改动**）

| 文件 | 说明 |
|:--|:--|
| `docs/evidence/S3-231/tools/derive-counts.mjs` | 新增：`_counts` 九字段独立复算器（不一致即 EXIT=1） |
| `docs/evidence/S3-231/01~04-*.txt` | 新增：三处读数三连复跑（只留关键行 + 全量哈希） |
| `docs/evidence/S3-231/raw/**` | 新增：三连复跑的全量原文（`--strict`/报告/`--json` 各 3 份） |
| `docs/evidence/S3-231/04-ref.md` | 新增：ref 包（分支/提交/resha、blob 哈希、三种取得方式、复核路径） |
| `docs/evidence/S3-231/05-ref-verify.txt` | 新增：bundle → 独立副本 → blob 比对 + 门禁复跑 的端到端记录 |
| `docs/evidence/S3-231/06-bundle-verify.txt` | 新增：bundle 路径与 SHA256（生成于整改提交之后） |
| `docs/tasks/inbox/ACTIVE-回执-S3-231.md`、`docs/tasks/cards/R101-S3-231-阿坚-回传.md` | 新增：本次整改回执/回传 |

⇒ **业务代码、用例、台账、`_counts` 一字未动**（S3-231 之后若有人复核代码 blob，应与 `04-ref.md` §二 完全一致）。

## 三、阻塞点与需要你决定的事

1. **是否需要远端 ref**：我未 push（红线 4）。若验收方要 `origin` 上的分支，请一句授权；或由你直接推本分支。
2. **403 告警行的出处**：本单读数里为 0 次；若你手上有那份带 403 的文件，请给路径/命令，我定位（我怀疑是别的批次日志或 CI 输出）。
3. **S3-229 的两项待裁定**仍未变（会员等级 4 条码位口径、平台侧审核 2 条归属），本轮整改未触碰判定本身。

## 四、一行摘要

**已交可复核 ref（`ebbc15e3`；全量/瘦 bundle + blob 哈希 + 独立副本端到端验证：blob 8/8 一致、`--strict` EXIT=0 且全量输出逐字节同哈希）；三处读数各三连复跑、逐字节一致、只留关键行（403 行实测 0 次）；`_counts` 九字段独立复算全 PASS，差额 `308+32−3=337` 收敛 ⇒ 未见错位。业务代码零改动。**
