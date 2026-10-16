# ACTIVE-回执 · S3-232（立码第一批 D6）

**汇报对象**：凌舟（总负责人）
**汇报人**：阿坚（后端 / 权限）· 执行会话 `/root/s3236_ajian`
**日期**：2026-10-16
**对应派单编号**：**S3-232**（卡：`docs/tasks/inbox/ACTIVE-S3-232.md`）
**完整回传（十项）**：`docs/tasks/cards/R101-S3-232-阿坚-回传.md`
**证据包**：`docs/evidence/S3-232/README.md`（含每个 raw 文件证明什么）

---

## 一、改了什么（逐文件）

| 文件 | 改动 |
|:--|:--|
| `backend/src/shared/system-permission-codes.ts` | **新增**：系统设置/基础域 **14 个新码**的目录（常量 + 机器可读目录 + 条数/端点数字 + D1 允许/禁止码 + 迁移文件名常量） |
| `docs/migrations/204_系统设置域权限点立码.sql` | **新增**：① D1 `STORE_MANAGER ← goods:create | goods:edit`（不含 `goods:delete`）；② 14 码写入 `t_sys_menu`（BUTTON，父行按各租户 `menu_code='system'`）。双守卫幂等，末尾机器可判核对 SELECT，§五 回滚逐条 |
| `docs/ops/S3-232-store-manager-goods-write-grant.sql` | **新增**：D1 的运维直连通道（与迁移前两条 UPDATE 逐字同源），含回滚素材、执行后核对、`goods:delete` 越权自证、其它角色零改动核对 |
| `backend/src/__tests__/shared/system-permission-codes.test.ts` | **新增** 29 例：条数/命名规范/目录↔迁移**双向**一致/提取器分辨力自证/端点存在性/D1 双侧同源/I1' 前置事实（生产底稿 + 生产同一份 `matchPermission`） |
| `backend/src/__tests__/shared/migration-c6-4-1.test.ts` | **改 1 行 + 注释**：`EXPECTED_MAX_MIGRATION` **203 → 204** |
| `docs/tasks/R101-待立码清单-五域.md` | **新增**：系统设置域 22 条逐条（14 立码 + 2 已改判 + 6 登记差异）+ 其余四域只表（报表/硬件打印/小程序移动端/工作台）+ 前端入口登记 |
| `docs/数据库变更清单.md` | **追加一节**：204 与 ops 脚本的登记（含幂等反测口径） |
| `docs/evidence/S3-232/**` | **新增**：harness 3 件 + raw 30 件 + README |

**零业务改动自证**：`git diff --name-only origin/main -- backend/src/routes backend/src/middleware backend/src/services` = **空**。
`.github/**`、`deploy/**`、收口总清单、`current-tasks.md`、`079_权限矩阵.sql`、前端代码 **均未动**。

---

## 二、证据（原始输出在 `docs/evidence/S3-232/`）

| 判据 | 读数 | 文件 |
|:--|:--|:--|
| 目录/命名/双向一致/D1 同源/端点存在性 | **29 passed**（+ 快照 15 = 44） | `raw/10-*` |
| 迁移真跑（官方通道 `run-migration.mjs`）三遍 | 均 `迁移执行成功`，EXIT=0 | `raw/22-*`、`25-*`、`32-*` |
| **幂等第一遍** | 授权 `Rows matched: 1 Changed: 1` ×2、菜单 `Records: 28`（合计 30） | `raw/28-*` |
| **幂等第二遍** | 授权 `Rows matched: 0 Changed: 0` ×2、菜单 `Records: 0`（合计 **0**） | `raw/29-*` |
| 库内读数 | 14 码 × 2 租户 = **28**、重复对 **0**、店长 `perm_len 11`、两码各 **1** 次、`goods:delete` **0** | `raw/26-*`、`33-*` |
| **反测 A** 摘 `NOT EXISTS` | `ER_DUP_ENTRY` / `errno 1062` / `uk_sys_menu_code_tenant` | `raw/30-*` |
| **反测 B** 摘 `JSON_CONTAINS` | 仍 `affectedRows: 1`；库内 `perm_len → 12`、`goods:create` **2** 次 | `raw/31-*` |
| **反测 C** 删 1 码 | 红 **3 failed / 26 passed**；复原后 **29 passed**、SHA256 逐字节一致 | `raw/61-*`、`62-*` |
| 启动期（空库） | `所有迁移完成`；204 的 DML 被写闸门**跳过 3 条**（2 UPDATE + 1 INSERT） | `raw/20b-*` |
| 回归 | vitest **9536 例 0 failed**；`tsc` **0 字节输出**；`build` 通过；`eslint` **0 error** | `raw/43-*`、`41-*`、`40-*`、`42-*` |
| 既有门禁 | `guard-rbac-wiring --strict`（gaps 378 / consumerEnd 45，与开工同值）+ 另三道 全 **EXIT=0** | `raw/50-*`、`51-*` |

**指纹（sha256 前 16）**：`system-permission-codes.ts = ED1F227FBBC00E52`｜`204_系统设置域权限点立码.sql = E31A17466256A9CC`｜
`system-permission-codes.test.ts = 20394657A1DCA490`｜`S3-232-store-manager-goods-write-grant.sql = 825DF55A2824D049`｜
`migration-c6-4-1.test.ts = 4169930F039F4ED1`｜`R101-待立码清单-五域.md = FE3E2D766763B81E`

---

## 三、台账 22 条的三分（含数字，可复算）

- **14 条立码**（表 A：alert 3 / archive 1 / notification(admin) 5 / push:test 1 / sms-template 3 / migration:run 1）；
- **2 条已改判消费者端**（`notification.routes.ts` 的小程序通知写端点，S3-205 §10.3 已更正台账 §三.9 的 1186–1187 行）⇒ **不立码**；
- **6 条登记差异**（表 C：本人头像 / 前端错误上报 / 分享链接收款 `auth:"none"` / App 离线同步 3 条）⇒ **不立码**，逐条给证据与建议去向。

本域账：39 = 35 需权限 + 4 公开；35 = 13 有现成码（approval 7 + sys-config 6）+ 22 需新码；**22 = 14 + 2 + 6**。

---

## 四、阻塞点

**无阻塞**（可继续下一批）。未做的三件（均在本单范围之外或需你执行）：

1. **生产未执行**（红线③）：204 与 ops 授权脚本均只产出。执行命令见回传卡 §七；执行后店长账号**须重新登录**（权限串签进 JWT）。
2. **其余四域只出表未立码**（卡 §一.2 明文范围）：报表 11 码 / 硬件打印 14 码 / 小程序移动端 5 码 / 工作台 8 码，属下批输入。
3. **未跑 CI 的 `migration-check` job**（本机无 Docker）：真库验证用本机便携 MySQL 8.0.28（同大版本），已在证据 README §二 标注边界。

---

## 五、待凌舟裁定项（7 项，详见回传卡 §九）

① 目录位置口径（卡面所指文件无 `PERMISSION_CATALOG`，本批落 per-域常量文件）；
② `t_sys_role_permission` / `t_sys_permission` 是否确认为废弃表并登记（授权判定只看 `t_sys_role.permissions`）；
③ 079 语料同步冲突（卡 §二"不回改" vs 提案 §三.2"同步"）——本批按卡执行，是否另立小单；
④ D1 是否收敛为仅 `default` 租户（本批对全部租户生效）；
⑤ 表 C 的 6 条差异去向（其中 `POST /api/sync/offline-orders` 建议改判"有现成码 `sale:create`"）；
⑥ 其余四域码粒度（报表域建议 4 条权限端点复用 1 码，若按端点 1:1 拆请在下批写明）；
⑦ 卡外观察两项：空库启动后角色权限串为空（灾备/新库重建拿不到生产权限串）、`069_商品SPU增加品牌ID.sql` 重跑不幂等（非空库二次启动必红 `Duplicate foreign key constraint name`）。

---

## 六、本回执的两处流程报备

1. **未把 `ACTIVE.md` 移入 `archive/`，也未删除它**：`ACTIVE.md` 当前是**多人并行路由表**
   （`ACTIVE-S3-223` ~ `ACTIVE-S3-232` 多行在办，其中数行属他人单）。按 2026-10-15 的路由表纪律
   （"不得删除他人尚未完成的在办行；`ACTIVE.md` 只允许追加或最小 patch"），本单**只写回执**，
   `ACTIVE.md` 的归档/在办行清理留给凌舟按最新路由表统一处置。
   本单对应的卡文件 `docs/tasks/inbox/ACTIVE-S3-232.md` 原地保留（未删、未移），如需归档请一并处置。
2. **`.env`（本机夹具库连接，含一次性本地 JWT 占位值）已在收尾时删除**，未提交、未 push；
   复跑所需的 4 个键见 `docs/evidence/S3-232/README.md` §二。

---

## 七、一行摘要

**S3-232 完成：D1 给 `STORE_MANAGER` 补 `goods:create|edit`（不含 delete）+ 系统设置/基础域立起 14 个新码并落全 5 处（目录 / 204 迁移 / ops 同源脚本 / 前端入口登记 / 断言与门禁同步），真库连跑两遍零变更、两侧反测证明守卫承重、目录↔迁移双向一致 29 例全绿；回归 9536 例 0 failed、tsc 0、eslint 0 error、build 通过、四道门禁 EXIT=0；零业务改动、未提交未 push；台账 22 条按 14+2+6 三分并给数字，其余四域只出码表；7 项待你裁定。**
