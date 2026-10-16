# ACTIVE-回执 · S3-233 返工单 F1（CodeQL 新 high：`admin-product.routes.ts` 上传路由缺限流）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）**｜日期：**2026-10-16**
> 对应派单：**S3-233 返工单 F1**（卡：`docs/tasks/inbox/ACTIVE-S3-233-F1.md`）
> 工作树：`D:\Users\ZXQL\wt-agents\S3-233`｜分支 `feat/s3-233-bclass-wiring-batch1`
> 前置核对（卡面要求）：`git fetch` 后 **HEAD = `b66e59a5`**（凌舟的合并收口提交）、工作树干净 ✔
> 本单**未 push / 未开 PR / 未 `git add -A`**；证据全部落 `docs/evidence/S3-233/raw/7x-*.txt`（新文件名）。

## 一、改了什么（**1 处代码** + 1 处用例登记 + 1 个判据脚本）

| # | 文件 | 改动 | 证据 |
|:--:|:--|:--|:--|
| 1 | `backend/src/routes/admin-product.routes.ts` | 第 34 行（现 **45** 行）`POST /products/upload-image` 注册点**内联** `rateLimit(AUTHED_ROUTE_LIMIT)`（新增两行 import：`express-rate-limit` + `../config/rate-limit`） | `raw/72-s3240-f1-selftest-final.txt` |
| 2 | `backend/src/__tests__/routes/authed-route-rate-limit-s3-208.test.ts` | 把该行登记为第 **12** 条运行期 case（打满阈值 ⇒ 第 N+1 次 429） | `raw/72-…`、`raw/75-s3240-f1-neg-runtime.txt` |
| 3 | `docs/evidence/S3-233/tools/s3240-f1-fs-route-scan.mjs`（新增） | 「同类行」全仓判据：复用第 57 项装置的两条判据（有鉴权 + 注册点无内联 `rateLimit(`），TARGETS 由 3 文件扩到 **189 个路由文件**，并加"文件系统访问迹象"两列 | `raw/70-s3240-f1-fs-route-scan.txt` |

**改动形状**（与仓内既有 14 处同族接线一致）：

```ts
adminProductRouter.post("/products/upload-image", rateLimit(AUTHED_ROUTE_LIMIT), requirePermission("goods:create"), upload.single("image"), uploadProductImage);
```

### ⚠️ 前提更正（卡面 §二 的片段与仓内既有形状不一致，我按"既有形状"执行）

卡面 §二 给的片段把**鉴权放在限流之前**并注明"与仓内既有 `rateLimit(AUTHED_ROUTE_LIMIT)` 注册点**同形**"。**实测该注解不成立**：仓内既有 **14 处**同族接线（`wechat.routes.ts` 5 / `marketing-miniapp.routes.ts` 7 / `commerce-fix.routes.ts` 2… 共 14 行）**全部**把 `rateLimit(...)` 放在鉴权之**前**，且**没有一处**是把限流放在鉴权之后的（检索命令与命中见 `raw/72-…` 第 ①/② 段与下方 §四）。

因此我按**卡面 §二 的标题要求**（"照第 57 项既有形状，不许自创"）落地为 `限流 → 鉴权 → multer → 控制器`，理由三条：
1. **与既有 14/14 行一致**（"既有形状"的客观含义）；
2. **CodeQL 判据不受顺序影响**（第 57 项装置的判据是"同一注册语句里出现内联 `rateLimit(`"，与位置无关 ⇒ 两种顺序都能消 high）；
3. **限流在鉴权之前才有运行期证据**：否则无令牌请求会被鉴权先拦成 401/403、请求永远到不了限流器 ⇒ S3-208 那类"打满阈值 ⇒ 429"的运行期断言对本行**不可达**（该文件头注释亦明文写"限流器在鉴权之前"）。

> 若凌舟坚持卡面片段的顺序，改回来是**一处一行的改动**（把两个参数换位），但需同步说明运行期 429 断言对该行不可达、需另行设计带桩鉴权的用例 —— 本单未擅自改动判据口径。

## 二、三条读数（卡面 §三.1~3）

| # | 命令 | 读数 | 原始输出 |
|:--:|:--|:--|:--|
| ① | `npx vitest run src/__tests__/routes/authed-route-rate-limit-s3-208.test.ts` | **17 passed**（含本单新增第 12 条：打满 60 次后第 61 次 **429**） | `raw/72-…` |
| ② | `npx vitest run src/__tests__/config/rate-limit-options.test.ts` | **8 passed** | `raw/72-…` |
| ③ | `npx vitest run src/__tests__/routes/rbac` | **15 文件 / 2227 用例 / 0 failed**（含 `upload-image` 所在的两文件：`rbac-b2-s3-220-product-wiring`、`rbac-b2-s3-233-gate-wiring-parity`） | `raw/72-…` |
| ④ | `npx tsc -p tsconfig.json --noEmit` | **0 错误（EXIT=0）** | `raw/72-…` |
| 附 | 全量 `npx vitest run` / `npm run build` / `guard-rbac-wiring --strict` | **681 文件 / 9882 用例 / 0 failed** · **EXIT=0** · **EXIT=0**（gaps 314 / 未登记 0） | `raw/79-…` / `raw/80-…` / `raw/78-…` |

### 为什么这条改动不会让既有两侧断言（403/200）回归（卡面 §三.3）

1. **阈值与请求量**：`AUTHED_ROUTE_LIMIT` = 窗口 5 分钟 / 阈值 **60 次/IP**；两个相关用例文件对 `POST /products/upload-image` 只发**个位数**请求（parity 的 60 行门断言里该端点 1 次、`401` 组 1 次；s3-220 表内 1 行 × 若干角色），**远低于 60**。
2. **桶不跨文件累积**：`rateLimit(AUTHED_ROUTE_LIMIT)` 每次调用生成**独立**限流器与独立 MemoryStore，且 vitest 按文件隔离进程 ⇒ 不存在"多文件累加打满"。
3. **顺序决定的语义与既有 11 条一致**：限流在鉴权之前 ⇒ 无权限/无令牌请求**也计数**（S3-208 用例头注释明文写该语义）。因此"**单次**请求 ⇒ 403/200"的结论不变，只有"同一 IP 连打 >60 次"才变 429 —— 那正是本规则要防的 DoS 场景。
4. **实测**：③ 的 2227 条（含 upload-image 的两侧断言）与全量 9882 条全绿 —— 不是推理，是跑出来的。

## 三、同类行结论（卡面 §三.4：全仓还有无其它同类新命中的行）

**判据与检索方式**（可复跑）：`node docs/evidence/S3-233/tools/s3240-f1-fs-route-scan.mjs`
—— 与第 57 项装置 `docs/evidence/S3-208/harness/codeql-missing-rate-limiting-predicate.mjs` **同一份** `AUTH_MIDDLEWARE` / `INLINE_RATE_LIMIT` 正则与同一括号配平抽取，只做两处扩展：① 扫描面从 3 个文件扩到 `backend/src/routes/*.ts` 全量（189 文件 / 1490 条注册）；② 增加"文件系统访问迹象"（语句级上传中间件 / 该语句引用的 controller 模块是否含 `node:fs`）。

**结果**（`raw/70-s3240-f1-fs-route-scan.txt`）：

| 分类 | 条数 | 说明 |
|:--|:--:|:--|
| 第 57 项宽类（有鉴权 + 注册点无内联限流） | **1415** | 大面存量，绝大多数既非上传也非 FS（F1 不属本类判据的目标面） |
| **A 精确同族**（注册语句上就有上传中间件） | **4** | 全部为**存量**、且都在**本单不得触碰的其它文件**：`avatar.routes.ts:20`、`miniapp-config.routes.ts:30`、`platform-config.routes.ts:50`、`platform-library.routes.ts:108` |
| B 近似上界（引用 controller **模块级**含 `node:fs`） | **33** | 模块级判定是**上界**（含误报：`platform-library` 23 条 + `sys-config` 11 条等，其 fs 多来自读备份目录等具体分支，非全量） |
| **本 PR 新增命中** | **1** | 即 `admin-product.routes.ts` 的 `POST /products/upload-image`（本单已修） |
| **`admin-product.routes.ts` 在同族判据下** | **0** ✅ | 脚本末行直接给"已清零：是 ✅" |

**结论**：本 PR 的同类新命中**只有这 1 条，已修**；其余同类均为**存量**且在别的路由文件里 ⇒ 按卡面 §二（"其它路由文件本单不动"）**未动**，此处只登记。建议：若要把 4 条 A 类存量收编，**另立一单**（跨 4 个文件、3 个不同鉴权族：`requireAuthWithTenant` ×2 / `requirePlatformAuth` / `requirePlatformPermission`）。

## 四、反测（门禁铁律：先证明会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 判据分辨力 | 摘掉本行的 `rateLimit(AUTHED_ROUTE_LIMIT)` | 同类行判据**重新报出**该行（A 类 4 → **5**、"已清零：**否 ❌**"、EXIT=1，且**只多这一条**） | `raw/74-s3240-f1-neg-scan.txt` |
| B 运行期分辨力 | 同上 | `authed-route-rate-limit-s3-208.test.ts`：**1 failed / 16 passed**，点名 `admin-product.routes.ts:34 POST /prod…`，`AssertionError: expected undefined to be '60'`（没有 `ratelimit-limit` 头 ⇒ 限流器不在链上） | `raw/75-s3240-f1-neg-runtime.txt` |
| 逐字节复原 | 复原后 SHA256 | 与注入前**一致**（`C385DC04…83666`）；判据回到 A 类 4 条、本文件"已清零：是 ✅" | `raw/73` / `raw/76` / `raw/77` |

## 五、卡外观察（只登记不动手）

1. **`rbac-g0-wiring.test.ts` 的跨批计数用例不剥注释**：它按**原文**统计路由文件里 `requirePermission(` 的出现次数（`rbac-g0-wiring.test.ts:709`），因此**注释里写出该字面形态会把计数 +1 并假红**。我第一版注释里写了该形态，**实测踩中**（`raw/71-s3240-f1-selftest-RED-g0-comment-token.txt`），改成白描措辞后回绿。建议后续按 S3-112 的做法给该计数剥注释（本单不擅自改他人用例口径）。
2. **`sys-config` / `platform-library` 的模块级 fs 上界**：33 条 B 类里，多数是"控制器文件里有一处 fs 调用"导致整模块路由被判入上界；若要精确定位，需按处理函数级解析（本单只给上界并标明方向）。

## 六、阻塞

**无**。唯一需要凌舟确认的是 §一 的**顺序前提更正**（我按"既有形状"执行并给出三条理由；若要求改回卡面片段顺序，请明示，我按指示改）。

## 七、提交

| 提交 | 内容 |
|:--|:--|
| **`bda77d0f`** | **本返工的主提交**：`fix(S3-233): 上传注册点补内联限流（CodeQL 新 high：js/missing-rate-limiting）` —— 代码 1 处 + 运行期用例登记 1 处 + 判据脚本 + 证据 `raw/70~80` |
| （其后一笔） | `docs(S3-233): 台账 §十九 读数按 rebase 后实测更正 + 回传卡变更记录（S5）`（台账 §19.1/§19.5、证据索引、回传卡 §〇） |
| （本文件） | F1 回执 |

**均在本分支本地，未 push**；完整列表以 `git log --oneline b66e59a5..HEAD` 为准（分支尖端哈希会因追加提交变化，故此处只钉主提交哈希）。
