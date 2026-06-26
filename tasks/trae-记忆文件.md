# TRAE Agent 记忆文件

> 最后更新：2026-06-27
> 用途：记录关键上下文，避免遗忘

---

## 当前分支

- 工作分支：`feat/formal-mvp-a` ← 凌舟管理中枢指向此分支
- 已推送到远程：✅

## 当前产品版本

- **产品规划 V4.4.1**（凌舟 2026-06-27 更新）
- V4.4 新增：平台总后台 saas-admin（后端API + 前端项目）
- V4.4.1 新增：门店终端合并入商家移动端，域名精简为 4 个
- 开发顺序：胖路由拆分 → 多租户隔离 → 权限安全 → 平台总后台 → 前端缺口补齐

## 域名规划（4个）

| 域名 | 用途 | 状态 |
|------|------|------|
| api.onepan.cn | 后端 API | ✅ |
| admin.onepan.cn | 商家 PC 端（管理后台 + 收银台，按角色切换） | ✅ |
| m.onepan.cn | 商家移动端（商家功能 + 门店收银，按角色切换） | ✅ |
| saas.onepan.cn | 平台总后台 | ✅ 已添加就绪 |

> 门店终端 store.onepan.cn 已合并到 m.onepan.cn，店员登录后自动切换为收银视图

## 团队成员与分工

| 成员 | 角色 | V4.4 当前任务 |
|------|------|------|
| 凌舟 | 项目管理 | 深度审计、PROJECT_MEMORY 更新、任务下发 |
| 阿坚 | 后端 | M0-00 胖路由继续拆分（12个文件/8天）→ M0-01~07 多租户隔离（5天）→ M0-08~11 权限安全（10天）→ PLAT-API 平台总后台后端（3天）→ NEW 批量调价+报价推送API（3天） |
| 墨 | 前端 | P0 安全修复（1天）→ PLAT-FE 平台总后台saas-admin（15天/5页面）→ M0-FE 权限对接+PC统一（2天）→ G1 缺口补齐8视图（22天）→ G2 缺口补齐7视图（12天） |
| 阿澈 | 前端 | G3 即时零售 8视图（22天）→ G4 营销中心（8天） |
| 苏然 | 测试 | G5 全局验收回归（5天） |

## 代码仓库关键文件

- 项目管理中枢：`PROJECT_MEMORY.md`（凌舟更新，团队必读）
- 产品规划：`docs/product-plan-v4.html`
- 墨的任务：`tasks/tasks-墨.md`
- 阿坚任务：`tasks/tasks-阿坚.md`
- 后端路由：`backend/src/routes/`（admin.routes.ts 已从 2847 行拆到 83 行）
- 后端控制器：`backend/src/controllers/admin/`（8个）+ `store/`（7个）
- 后端服务：`backend/src/services/admin/`（8个）+ `store/`（7个）
- 共享层：`backend/src/shared/db.ts`（含 queryWithTenant）
- 迁移脚本：`docs/migrations/add_tenant_id.sql`（62表）

## V4.4 里程碑

| 里程碑 | 内容 | 累计工时 | 状态 |
|--------|------|:---:|:---:|
| M0 · 胖路由 | 12个文件拆分 + 分层模板 | 8天 | 🔴 |
| M1 · 多租户 | 迁移脚本补全 + 隔离验证 | 13天 | 🔴 |
| M2 · 权限安全 | RBAC + 越权拦截 + 同步 | 23天 | 🔴 |
| M3 · 底层完成 | 新增API + 安全修复 + PC统一 | 29天 | ⏳ |
| M4 · 平台总后台 | 后端API + 前端5页面 | 44天 | ⏳ |
| M5 · 前端补齐 | G1~G4 全部视图 | 112天 | ⏳ |
| M6 · 全局收尾 | 细节打磨 + 全端验收 | 117天 | ⏳ |

## 已完成事项

### P0 安全修复（2026-06-26 提交 71f3461）
- ✅ LoginView.vue：移除硬编码 admin/admin123 默认凭证
- ✅ router/index.ts：JWT exp 解析 + token 过期自动清除并跳转登录
- ✅ router/index.ts：404 兜底改为独立 NotFound 页面
- ✅ 补充迁移 SQL：add_tenant_id.sql, add_user_settings.sql, phase7_credit_tenant.sql, phase7_price_tenant.sql, phase9_tenant_subscription.sql

### 后端架构（阿坚 R2-01+R2-02，已合并到 feat/formal-mvp-a）
- ✅ controllers/admin/ 8 个 + controllers/store/ 7 个
- ✅ services/admin/ 8 个 + services/store/ 7 个
- ✅ types/index.ts 类型定义
- ✅ db.ts queryWithTenant + injectTenantCondition
- ✅ shared/tenant.ts 多租户工具
- ✅ 新增多条路由文件：approval/customer-merge/customer-payment等
- ✅ admin.routes.ts 从 2847 行 → 83 行

## 关键操作记录

- 2026-06-27：凌舟更新 V4.4（平台总后台）+ V4.4.1（移动端统一）
- 2026-06-27：域名精简为4个，门店终端合并到 m.onepan.cn
- 2026-06-26：P0 安全修复完成 + 迁移SQL补充（71f3461）
- 2026-06-26：发现工作分支错误，切换到 feat/formal-mvp-a
- 2026-06-26：将阿坚 R2-01+R2-02 从旧分支搬运到 feat/formal-mvp-a（95文件）
- 2026-06-25：创建 fmcg-精简方案-v1.1（参考用，当前执行 V4.4）

## 注意事项

- **凌舟只追踪 `feat/formal-mvp-a` 分支**，所有工作必须在此分支上
- **PROJECT_MEMORY.md** 是团队唯一管理中枢，由凌舟维护，不要直接修改
- 个人记忆文件放 `tasks/` 目录，命名格式 `tasks/人名-记忆文件.md`
- 凌舟更新很频繁，每次 commit 前先 `git pull --rebase`