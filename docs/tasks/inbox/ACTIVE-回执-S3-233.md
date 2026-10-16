# ACTIVE-回执 · S3-233（B 类收编第一批：门 → 后端接线）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）**｜日期：**2026-10-16**
> 对应派单：**S3-233**｜工作树：`D:\Users\ZXQL\wt-agents\S3-233`｜分支 `feat/s3-233-bclass-wiring-batch1`
> 基线：`be781a10`（含 #356 的 `3b94f432`）｜实质制品尖端：**`94bf7f18`**（其后 1 笔为回传文件；分支尖端以 `git log --oneline -1` 为准）
> 完整回传（十项）见 `docs/tasks/cards/R101-S3-233-阿坚-回传.md`
> 本单**未 push / 未开 PR / 未动 main / 未动他单工作树**；`ACTIVE.md` **未动**（见文末）。

## 改了什么（6 笔本地提交）

| 提交 | 内容 |
|:--|:--|
| `c81c4752` | 销售域 5 条 + 采购域 4 条写端点接线（9 条）＋ 本域用例同步 |
| `7818b1a1` | 库存/追溯域 20 条接线（stock-check 9 / transfer 8 / stock-warning 1 / store-inventory 1 / loss-gain 1） |
| `d5a52381` | 商品域 12 条 + 员工/账号域 7 条接线（19 条） |
| `71720b6d` | 营销域 5 条 + 财务域 4 条接线（9 条） |
| `94bf7f18` | 跨层一致性用例（新，120 条）+ 跨批计数（g0/g1/g2）+ 台账 §十八 + 证据 + 机读台账（gaps 378→321） |
| 末笔 | 回传卡（十项，含署名与派单编号）+ ACTIVE 回执 |

**改动面（自证）**：`backend/src/routes` **21 文件**（只加 `requirePermission("<既有码>")`）、用例 **12 文件**（11 改 + 1 新增）、
`backend/scripts/rbac-wiring-baseline.json`、`docs/tasks/R101-RBAC接线缺口清单.md` §十八、`docs/evidence/S3-233/**`。
**未动** `middleware`/`services`/`controllers`/迁移/角色种子/**前端门注册表（只读）**/`.github`/`deploy`/契约文档/收口总清单/`current-tasks.md`。

## 证据（原始输出，均可复跑）

| 项 | 结果 | 原始输出 |
|:--|:--|:--|
| 门级对账（27→26 门 / 60 行 / 58 唯一端点） | 60 = **60 已接 + 0 跳过** | `docs/evidence/S3-233/raw/61-s3240-gate-recon.txt` |
| `guard-rbac-wiring --strict` 终值 | **EXIT=0**（gaps 321 / 未登记 0 / 陈旧 0） | `raw/33-strict-after.txt`、`raw/64-s3240-final-check.txt` |
| 跨层一致性用例 | **120 passed** | `raw/62`、`raw/64` |
| 全量用例（backend） | **679 文件 / 9830 用例 / 0 failed** | `raw/51-s3240-full-vitest.txt` |
| `tsc --noEmit` / `npm run build` | 0 / **EXIT=0** | `raw/52-s3240-build.txt`、`raw/64` |
| 判据 §二.6（20 码 × 生产持有者） | 无持有者 **0** | `raw/60-s3240-prod-holders.txt` |
| 反测 A/B/C（s3238 轮）＋**反测 D（收尾轮独立复测）** | 摘中间件 ⇒ `--strict` **EXIT=1** 且点名、parity **1~2 failed**；复原 **EXIT=0** 且 SHA256 一致 | `raw/40/41/42`、`raw/43/44/45`、`raw/53~58-s3240-*` |
| 证据无明文凭据 | `guard-evidence-secrets` **PASS** | `raw/64` |
| rebase 台账差异实测 | main 371 / 本分支基底 378 / 本单 321；与 main 侧移除 **零重叠** ⇒ 投影 **314 / 91** | `raw/63-s3240-main-vs-branch-baseline.txt` |

## 阻塞点

**无**。卡面判据（对账 / 跨层一致性 / 两侧反测 / `--strict` / 回归 / 零回归论证）全部具备可复跑证据。
**未做**：rebase 到当前 `origin/main`（卡面基线为开工当日 main；合并口径见下）。

## 需凌舟处置的 4 项（详见回传卡 §九）

1. **合并口径**：本分支落后 main 7 个提交，`rbac-wiring-baseline.json` 两侧都改过 ⇒ 须按"合并两者的移除集合"处理（只取一侧会静默丢掉另一侧的移除）；投影读数 **314 条 / 91 文件**。
2. **I1' 待决：8 个码仅由全通配角色持有**（`goods:edit/create/delete`、`system:user:*`、`system:role:*`、`marketing:create`）＋ **`store:transfer` 与仓管员 `transfer:*` 不同码** ⇒ 补码或改门码需定案。
3. **16 条跨层漂移**（`instant-retail` `platform/*` 15 条 ＋ `deliveries/:deliveryId/status` 方法漂移）：需定以哪层为准。
4. **2 条 W 类仍在缺口**（`POST /api/admin/purchase-plans/`、`.../:planNo/convert`）：门已存在而授权模型未定。

## 收尾轮修的 4 处用例/断言缺陷（逐条留痕，台账 §18.8）

1. `rbac-b2-s3-214-purchase-wiring.test.ts`：`baseline.gaps[file]` 清零取 undefined ⇒ 断言以"参数类型错"变红、失去分辨力 ⇒ 改 `?? []`。
2. `s3-209-sale-cancel-wiring.test.ts`：对照行用 API 路径 `/auth/settings` 匹配文件内注册模式 ⇒ **匹配 0 行（假通过）** ⇒ 改 `/settings` 并给形参补 `"put"`。
3. `rbac-b2-s3-233-…-parity.test.ts`：标题"25 条"与其自身筛选口径（27）**自相矛盾** ⇒ 条数改由数据推导。
4. 同文件：删掉 `gaps=321 / files=94` 两个**跨批裸数字**（派单规范 §9.2 禁止），改为"和式 + 台账自洽"两条（**更严**：已接线+缺口+消费者端+查询型POST == 扫描总数 763）。

> ⚠️ **派单前提更正（主动报备）**：路由表写"留 **1 处**断言缺陷"，实测为 **4 处**（2 个 live 失败 ＋ 1 处 `tsc` 才可见的类型错误 ＋ 1 处标题与断言自相矛盾）。
> 后两类 **vitest 查不出**（不查类型）⇒ 建议后续同类收尾单把 `tsc --noEmit` 与全量 vitest **同时**列为判据（本单已如此执行）。

## 路由表处置请求

1. `inbox/ACTIVE.md` 的 **S3-233 在办行**请凌舟移入已完成表（请由凌舟处置——该文件当前同时承载 `s3240/s3241/s3242` 三方路由，**本单未改其一个字节**，以免影响另两单认领）。
2. 本单分支仍在本地（未 push），如需 PR 请由凌舟按既有流程 rebase 后推。
