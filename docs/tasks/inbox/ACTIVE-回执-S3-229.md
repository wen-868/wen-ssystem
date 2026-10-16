# ACTIVE-回执 · S3-229（门店/租户域接线 + 营销域 W 类收编，B2 批 9）

> **汇报对象**：凌舟（总负责人）｜**汇报人**：阿坚（后端 / 权限）· `/root/s3233_ajian`｜**日期**：2026-10-16｜**派单编号**：S3-229
> 工作树 `D:\Users\ZXQL\wt-agents\S3-229`｜分支 `feat/s3-229-store-and-marketing-wiring`｜基线 `63ee9775`｜**未提交**

## 一、改了什么（8 个文件 + 1 新增用例 + 1 证据目录）

1. `backend/src/routes/demo.routes.ts`：`POST /seed`、`POST /reset` 挂 `requirePermission("store:create")`（+判定注释）。
2. `backend/src/routes/store-control.routes.ts`：管理面 5 条写端点接线 —— `PUT /configs/:storeId` → `store:edit`；`POST /:storeId/{open,close,suspend,resume}` → `store:create`（+判定注释）。
3. `backend/src/routes/community-marketing.routes.ts`：10 条写端点（拼团 join/start/end、砍价 start/help/end、秒杀 buy/pay/cancel/end）挂 `requirePermission("marketing:create")`，并按 D2 改写原「本批不接」注释。
4. `backend/src/routes/points.routes.ts`：**仅注释** —— 登记本批按 D2 复核后仍不接 4 条会员等级配置的理由（页面码 `customer:level` 对在用店长可见）。
5. 新增 `backend/src/__tests__/routes/rbac-b2-s3-229-store-and-marketing-wiring.test.ts`（**122 例**：名单自证 / 形状断言 / 403 与 200 两侧 / 零回归在用使用者对齐 / 范围控制 / 401 / 对账守恒）。
6. `backend/src/__tests__/routes/rbac-b2-s3-226-marketing-wiring.test.ts`：**状态变更同步**（community-marketing 10 条由"未接(W)"→"S3-229 已接"；`UNWIRED_CLASS_TOTAL` W 14→4；从"本批 0 接线文件"名单移除该文件；+1 例状态变更登记）。其 65 条已接行与 G0 名单断言未动。
7. `backend/src/__tests__/routes/rbac-g0-wiring.test.ts`：新增 `S3_229_WIRED_FILES`（demo 2 / store-control 5 / community-marketing 10）并把 `S3_229_WIRED_TOTAL` 纳入**和式**（未写裸数字）。
8. `backend/scripts/rbac-wiring-baseline.json`：逐键移除本批 17 条（`_counts` 同步：395→378 条 / 116→113 文件；`wiredPermOccurrences` 291→308）。
9. `docs/tasks/R101-RBAC接线缺口清单.md`：顺延新章节 **§十七**（§十六 已占用）。
10. `docs/evidence/S3-229/**`：判定留档、调用面、封装未用证明、门禁前后、反测、回归、工具（`tools/*.mjs`）。

## 二、证据（原始输出路径，全部可复跑）

| 项 | 结果 | 路径 |
|:--|:--|:--|
| 起点 | 缺口 395 条 / 116 文件；已接线 320 | `raw/02-guard-json-before.json` |
| 终点 | **缺口 378 条 / 113 文件；已接线 337**（+17） | `raw/10-guard-json-after.json` |
| `--strict` | 前后均 **EXIT=0**（未登记 0 / 陈旧 0） | `03-guard-strict-before.txt`、`12-guard-strict-after.txt` |
| 调用面（45 端点） | 逐条 文件:行（含"全仓无有效调用点"判定） | `02-callers.txt` |
| 封装未被页面使用（7 函数） | 除封装定义行外零 `.vue` 引用 | `03-unused-wrappers.txt` |
| 反测（先改台账再注入） | 摘中段接线 ⇒ 报告 337→336、缺口 378→379；`--strict` **EXIT=1** 且点名 `community-marketing.routes.ts:46`；vitest **5 failed**；逐字节还原（SHA256 一致）⇒ 复绿 | `25-neg-report.txt`、`26-neg-strict.txt`、`27-neg-vitest-red.txt`、`raw/24`、`raw/28`、`29-neg-restored-*` |
| 回归四道 | vitest **678 文件 / 9507 用例全绿**；tsc EXIT=0；eslint 0 error；根 build EXIT=0 | `30/31/32/33-*.txt` |
| 末行换行一致性 | 与 HEAD 一致（无多余 diff 噪声） | `34-final-newline-check.txt` |

## 三、分桶对账（一条不多、一条不少）

- **G1 门店/租户域 31** = 已接 **7**（demo 2 + store-control 5）＋ B 类 **8**（储值卡 4 + 门店会员 2 + 门店建档 2，入口无权限门）＋ 平台侧 **2**（`/api/tenant/applications/*` 走 `requirePlatformAuth`，商家码无效）＋ 公开 **2** ＋ 平台域 **12**（不在本单）。
- **G2 营销域 W 类 14** = 已接 **10**（community-marketing，菜单只授予 0 账号角色与只读观察员）＋ 不接 **4**（会员等级配置：页面码 `customer:level` 对**在用**店长可见 ⇒ 挂 `marketing:create` 即违反 I1）。

## 四、阻塞点

1. **【需裁定】会员等级配置 4 条的码位口径**（D2 前提不成立）：可选 (a) 改挂 `customer:level`（满足 I1）、(b) 给店长补 `marketing:create`（独立角色变更单）、(c) 前端补门后按 `marketing:create` 收编。本单取保守侧：**不接 + 登记**。
2. **【需裁定】平台侧 2 条审核端点**是否并入平台侧单（建议码 `requirePlatformPermission("tenant:manage")`）。
3. **【依赖】B 类 6 个 app-mobile 写端点 + 门店建档 2 条**需前端权限门（S3-230 口径）补好后，后端批才能收编。
4. 无环境/凭据阻塞；生产事实全部取自共用底稿（含 §十七.8-5 提出的 `customer:level` 补扫建议）。

## 五、未完成与遗留

- 本单**有意未接** 8 条 B 类 + 4 条 W 类 + 2 条平台侧（理由与证据见 §十七.3/§十七.4）；未接项**全部保留在机读台账 `gaps` 里**（未洗绿）。
- 卡外观察 4 条只登记不动手（我的页无条件入口 / S3-226 用例同步说明 / S3-119 限流门禁判据可被注释误触发 / 双前缀同业务）。
- **未动** `ACTIVE.md` 路由表、在办行与其它单的工作树（路由表属凌舟，另有 4 单在办：S3-223/224/225/229/230）；**未动** `current-tasks.md`（卡内红线 2 明令禁止）。

## 六、一行摘要

**S3-229 完成：17 条接线（store:create ×7、store:edit ×2、marketing:create ×10），缺口 395→378（116→113 文件），`--strict` EXIT=0，vitest / tsc / eslint / build 全绿；G1 31 = 7+8+2+2+12，G2 14 = 10+4；2 项待凌舟裁定（会员等级码位、平台侧审核端点归属）。**
