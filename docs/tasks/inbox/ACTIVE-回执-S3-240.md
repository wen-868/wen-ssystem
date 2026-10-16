# ACTIVE-回执 · S3-240（工作台 D4 前端补门）

> **汇报对象**：凌舟（总负责人）｜**汇报人**：墨（工作台前端 owner）｜**日期**：2026-10-17｜**派单编号**：**S3-240**
> 详细十项回传：`docs/tasks/cards/R101-S3-240-墨回传.md`（本文件为信箱回执摘要）

## 一、改了什么

1. **新增判据与注册表**：`admin-web/src/config/permission-gates.ts`（`matchPermissionCode` = 后端 `matchPermission` 逐条镜像；`BUTTON_GATES` 15 项：gated 13 / registered 2）、`admin-web/src/composables/usePermissionGate.ts`（`canGate(id)`，未登记 id 失败关闭）。
2. **判据点接入既有来源**：`stores/app.ts` 的 `permissions`（登录态）改为可为 `null`（未取到）；`hasPermission()` 由 `includes()` 升级为**与后端同源的通配匹配**（否则生产店主 `["*"]` 会被判成不持码）；新增 `ensurePermissions()`（仅未取到时补拉一次 `/admin/auth/me`，并发去重、失败关闭）。
3. **权限串来源两条都接上**：`LoginView.vue` 两条登录路径写入 `permissions`；`api/common.ts` 新增 `fetchCurrentUser()`；`router/index.ts` 守卫内 `await app.ensurePermissions()`（兜老缓存）。
4. **8 个页面 17 处写按钮按码显隐**（`v-if`，隐藏非置灰）：
   `goods:delete` → 品牌管理:39 / 商品标签:45 / 单位管理:28 / 商品分类:54 / 商品 SKU 单位行:539；
   `system:user:create|edit` → 员工管理:17,45,46,47 / 组织架构:14,52,53,54；
   `system:role:create|edit` → 角色管理:5,27,28,29。
5. **装置**：`admin-web/tests/permission-gates.spec.mjs`（判据同源 18 例 + 注册表↔源码一致性 + **真实 DOM 两侧反测**），已串入 `npm test`。

## 二、证据（可复跑）

| 判据 | 结果 | 原始输出 |
|:--|:--|:--|
| 覆盖表（码 × 页面 × 按钮 × 判定点行号） | 17 行 + 2 项登记，未登记引用 0 | `docs/evidence/S3-240/raw/30-覆盖表.txt`（`node docs/evidence/S3-240/tools/gate-coverage.mjs`） |
| 两侧反测（去码⇒不渲染 / 恢复⇒渲染） | 店主 `["*"]`=1、店长串=0、`null`=0、`[]`=0（逐门 × 逐页 17 行） | `raw/31-spec-permission-gates.txt` |
| 反测"该红就红"＋逐字节复原 | 摘门 ⇒ EXIT=1 点名 `goods-brand-delete`；换回 `includes()` ⇒ EXIT=1 点名店主假回归；复原 SHA256 逐字节一致；复跑 EXIT=0 | `raw/50-countertest.txt`（`pwsh -File docs/evidence/S3-240/tools/countertest.ps1`） |
| `vue-tsc --noEmit` 0 新增 | 改动前/后均 EXIT=0、零输出 | `raw/10-…-baseline.txt`、`raw/11-…-after.txt`（各配 `.note.txt`） |
| `eslint src/` 0 error | EXIT=0（0 error / 0 warning） | `raw/12-eslint-after.txt`（配 `.note.txt`） |
| `vite build` | EXIT=0（2m46s） | `raw/60-build.txt` |
| 不回归 | `npm test` = 3+30+装置 全绿；`guard-rbac-wiring --strict` EXIT=0 | `raw/32-npm-test.txt`、`raw/40-guard-rbac-wiring-strict.txt` |

## 三、阻塞点

**无。** 本单范围已全部落地自验；按要求**未 push、未开 PR**，等凌舟复验合并。

## 四、待裁定（详见回传卡 §九）

1. 「单按钮多码」2 项（角色/员工弹窗「保存」）按卡**只登记不门**（入口门已覆盖）——请裁定是否接受。
2. 后端模块通配只覆盖**首段**（`system:user:*` 不覆盖 `system:user:create`）：现网无该形态，是否另立单登记。
3. `admin-web/src/api/system.ts` 的 `/admin/system/employees*` 一族**后端零注册、全仓零调用**；建议并入 S3-242 跨层漂移影响面。
4. 组织架构页的部门/岗位增删改（`department.routes.ts` / `position.routes.ts`）后端**未挂码**，请裁定归属单。

## 五、分支与工作树

`feat/s3-240-adminweb-d4-gates` ｜ `D:\Users\ZXQL\wt-agents\S3-240`（基线 `7ea26e8d`）｜未 push
