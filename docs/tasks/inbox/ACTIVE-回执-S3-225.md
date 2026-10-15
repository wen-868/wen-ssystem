# ACTIVE-回执 · S3-225（员工/账号域权限接线 · B2 批 7）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）**｜日期：**2026-10-16**｜对应派单编号：**S3-225**
> 认领依据：派单消息显式写明本会话 agent 名 **`/root/s3230_ajian`**（复读 `docs/tasks/inbox/ACTIVE.md` 路由表 S3-225 行确认仍在）+ 卡 `ACTIVE-S3-225.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-225`｜分支：`feat/s3-225-staff-domain-wiring`｜**未 push、未开 PR**
> 完整十项回传：`docs/tasks/cards/R101-S3-225-阿坚-回传.md`（本回执为其摘要 + 回执口径）

## 一、改了什么

1. **接线 11 条**（员工/账号域 7 文件 / 31 写端点中的 11 条），全部挂**既有**权限码，不新立码、不改角色种子、不动迁移：

| 文件 | 条数 | 落地码 | 端点 |
|:--|--:|:--|:--|
| `admin-staff.routes.ts` | 1 | `system:user:edit` | `PUT /staff/:id/status` |
| `sys-user.routes.ts` | 3 | `system:user:create` / `system:user:edit` | `POST /`；`POST /:id/reset-password`、`DELETE /:id` |
| `rbac.routes.ts` | 2 | `system:role:edit` | `PUT /:id/data-permissions`、`PUT /users/:userId/roles` |
| `data-permission.routes.ts` | 5 | `system:role:create` / `system:role:edit` | `POST /`、`POST /roles/:roleId`；`PUT /:id`、`DELETE /:id`、`DELETE /roles/:roleId/:dataPermissionId` |

2. **不接 20 条**（逐条登记，见回传卡 §一.2 与台账 §十五.3）：**B 类 7**（app-mobile「我的」页对员工管理页/角色管理页是**无条件硬编码入口**，写调用点使用者集合不可枚举）、**自服务 7**（admin-auth 5 + user-session 2）、**自服务实际用途 1**（`PUT /api/admin/sys-users/:id` 唯一调用点传本人 id）、**查询型 POST 1**、**需新立码 4**（部门域，079 无部门域码）。
3. **用例**：新增 `rbac-b2-s3-225-staff-wiring.test.ts`（**129 用例**）；`rbac-g0-wiring.test.ts` 仅同步"总数 + 逐文件计数"快照（新增 `S3_225_WIRED_FILES`，**G0 名单行与逐行 403/200 断言一字未动**）。
4. **台账**：机读 `rbac-wiring-baseline.json`（仅移除本域 11 条 + `_counts` + `_s3225_note` / `_s3225_merge_note`）；人读 `R101-RBAC接线缺口清单.md` 新增 **§十五**。
5. **证据**：`docs/evidence/S3-225/**`（判定留档 / 调用面 / 锁定检查 / 持有复算 / 门禁前后 / 反测 / 回归 / 其余 6 门禁 / 哈希）。

**提交**：`0a9e8838`（代码+用例+台账+证据）｜合并 `origin/main`（`ea29ee1f`，含 S3-224 PR #350）｜终态 HEAD 见分支 `git log --oneline -1`。

## 二、证据（读数）

| 项 | 读数 | 原始输出 |
|:--|:--|:--|
| `guard-rbac-wiring`（分支，基线 `2b4a0e16`） | 已接线 212 → **223**；缺口 **512 → 501**（文件 134 → 134） | `10-guard-before.txt` / `12-guard-after.txt` |
| `--strict`（分支） | **EXIT=0** | `14-guard-strict-after.txt` |
| `guard-rbac-wiring`（**合并 origin/main 后**） | 已接线 223 → **255**；缺口 **480 → 469**（文件 **129**） | `30-guard-after-merged.txt` |
| `--strict`（合并态） | **EXIT=0**（469 / 未登记 0） | `31-guard-strict-merged.txt` |
| 本批用例 / 门禁套件 | **129 passed** / 分支态 **455**、合并态 **797 passed** | `20-vitest-s3225-first.txt` / `21-vitest-s3225-gates.txt` / `22-vitest-gates-merged.txt` |
| 全量 `npx vitest run` | 分支态 **675 文件 / 8922 用例 / 0 failed**；合并态 **676 文件 / 9085 用例 / 0 failed** | `13-vitest-full.txt` / `40-vitest-full-merged.txt` |
| `tsc` / `lint` / 根 `build` | 分支态 **0 / 0 error / EXIT=0**；合并态 **0 / 0 error（169 warning）/ EXIT=0** | `15`/`17`/`16` + `41`/`43`/`42`（merged） |
| 其余 6 条门禁 | **全 EXIT=0** | `79-other-guards.txt` |
| 反测 A / B / C / A′ | 摘线 ⇒ `--strict` **EXIT=1** + 用例 **3 failed**；改码 ⇒ 用例 **3 failed**；合并态复测同 | `23/24`、`25/26`、`27`、`32/33` |
| 复原校验 | 7 文件 SHA256 **0 处不一致**；`--strict` 回 EXIT=0 | `raw/30-*` / `raw/31-*` / `50-src-hashes.txt` |

## 三、阻塞点

**无阻塞。** 两点如实报备：

1. **无生产库访问权** ⇒ 持有核对用「卡面下发生产底稿 `docs/evidence/_shared/prod-roles-20261016.txt` + 仓库种子」，请凌舟复核（同 S3-222/S3-223 口径）。
2. **两单并行改动同一三处文件**（`rbac-wiring-baseline.json`、`rbac-g0-wiring.test.ts`、`rbac-b2-s3-223-finance-wiring.test.ts` 里那行硬编码全局总数断言）：本单已 `git merge origin/main` 并按**两侧并集**解决（缺口 469 / 两个 `S3_22x_WIRED_FILES` 块并存 / 总数 226 / `_s3225_merge_note` 写明口径）。**`ACTIVE.md` 与 `current-tasks.md` 本单未改**（四单并行共用路由表；卡 §四.2 亦禁止改 `current-tasks.md`）。

## 四、需凌舟裁定（摘要；全文见回传卡 §九）

1. `reset-password` 落地码：本批 `system:user:edit`（语义）vs 台账机器建议 `system:user:create`（持有者集合相同，零回归不受影响）；
2. `DELETE /api/user-session/user/:userId`：台账判「自服务」，语义偏管理面 ⇒ 是否改判；
3. `PUT /api/admin/sys-users/:id`：管理面接口承担「本人资料保存」⇒ 建议另立自服务端点后再补码；
4. 部门域 4 条需新立权限点（079 无部门域码）；
5. **建议固化跨批快照写法**（全局接线总数别再硬编码在某一批的用例里，本批被迫又改了 S3-223 那一行：215 → 226）；
6. 卡外观察 5 条（台账 §十五.7）是否另立单。

> 另：台账章节号由 `## 十四` 顺延为 `## 十五`（`## 十四` 已被在办 S3-224 占用且落盘更早），未改动任何人章节编号。

## 五、一行摘要

员工/账号域 31 条按「使用者已持码」接线 **11 条**（缺口分支内 **512 → 501**、合并态 **480 → 469**），其余 20 条按五类逐条登记不接；两侧 + 判据反测齐、`--strict` EXIT=0、合并态全量 **9085 用例 0 failed**、tsc/lint/build/其余 6 门禁全绿。

---

派单人：**凌舟（总负责人）**｜2026-10-16
汇报人：**阿坚（后端 / 权限）**｜2026-10-16
