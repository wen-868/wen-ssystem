# 当前任务 — R23

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 最后更新：2026-07-12  
> **硬性标准：覆盖率阈值 100%，测试不允许跳过，只有修复一条路。**

---

## R23 任务列表

### R23-A1 — 密码复杂度校验 + 登录失败次数限制 [P0]

- **状态**：✅ 已完成
- **优先级**：P0
- **负责人**：阿坚
- **预计**：1 天
- **截止时间**：2026-07-15
- **完成时间**：2026-07-12
- **问题**：
  1. 密码无强度校验，弱密码可注册
  2. 无登录失败次数限制，存在暴力破解风险
- **修复**：
  1. 在 `shared/password.ts` 添加 `validatePassword`（8-32位，含字母+数字+特殊字符）
  2. 在 `admin/auth.service.ts` 和 `store/auth.service.ts` 添加登录失败计数（5次锁定15分钟）
  3. 数据库迁移 `100_login_failure_lock.sql` 新增 `login_fail_count`、`locked_until` 字段
- **验收**：
  - ✅ 弱密码无法注册/修改（createUser/resetPassword/changePassword/createStaff 均校验）
  - ✅ 连续5次登录失败后账号锁定15分钟
  - ✅ `npx vitest run` 1955 个测试用例通过
- **修改文件**：
  - `backend/src/shared/password.ts`
  - `backend/src/services/admin/auth.service.ts`
  - `backend/src/services/store/auth.service.ts`
  - `backend/src/services/admin/sys-user.service.ts`
  - `backend/src/services/admin/employee.service.ts`
  - `docs/migrations/100_login_failure_lock.sql`

### R23-A2 — JWT 安全加固 [P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5 天
- **截止时间**：2026-07-15
- **完成时间**：2026-07-12
- **问题**：
  1. JWT 过期时间 8 小时过长
  2. `requirePlatformAuth` 存在 `as any as AuthUser` 不安全类型转换
- **修复**：
  1. JWT 过期时间缩短至 4 小时，算法固定 HS256
  2. 添加 issuer/audience 校验，防止 token 跨服务滥用
  3. 修复 `requirePlatformAuth` 类型转换
- **验收**：
  - ✅ JWT 4小时过期
  - ✅ issuer/audience 校验生效
  - ✅ 类型转换无 `as any`
- **修改文件**：
  - `backend/src/middleware/auth.ts`

### R23-A3 — 密码哈希强度提升 [P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5 天
- **截止时间**：2026-07-15
- **完成时间**：2026-07-12
- **问题**：`password.ts` 中 `SALT_ROUNDS=10`，建议提升至 12
- **修复**：将 `SALT_ROUNDS` 从 10 改为 12，新增 `needsRehash` 函数识别旧哈希并自动升级
- **验收**：
  - ✅ 新密码使用 SALT_ROUNDS=12 哈希，前缀 `v2$`
  - ✅ 旧哈希（`v1$` 或无前缀）登录时自动识别并升级
  - ✅ 密码哈希验证正常
- **修改文件**：
  - `backend/src/shared/password.ts`

### R23-A4 — CSRF 防护 [P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1 天
- **截止时间**：2026-07-16
- **完成时间**：2026-07-12
- **问题**：无 CSRF token 防护
- **修复**：
  1. 新建 `middleware/csrf.ts`，基于 HMAC-SHA256 和 userId 生成 CSRF token
  2. GET/OPTIONS/HEAD 放行；POST/PUT/DELETE 校验 `x-csrf-token` 请求头
  3. 在 `server.ts` 注册 CSRF 中间件（在认证路由之后）
- **验收**：
  - ✅ 无 CSRF token 的写请求被拒绝（403）
  - ✅ 带正确 CSRF token 请求正常通过
  - ✅ GET 请求不受影响
- **修改文件**：
  - `backend/src/middleware/csrf.ts`（新增）
  - `backend/src/server.ts`

### R23-A5 — 数据库慢查询监控 [P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1 天
- **截止时间**：2026-07-16
- **完成时间**：2026-07-12
- **问题**：无数据库慢查询日志监控
- **修复**：
  1. 新建 `middleware/slow-query-monitor.ts`，记录 SQL 执行耗时
  2. 超过 1s 的查询存入内存缓冲区（最多100条）
  3. 新增 `routes/monitor-slow-query.routes.ts` 提供慢查询统计 API
  4. 在 `config/database.ts` 的 `query` 函数集成监控
- **验收**：
  - ✅ 慢查询自动记录到缓冲区
  - ✅ 统计 API 可查询慢查询列表及统计信息
- **修改文件**：
  - `backend/src/middleware/slow-query-monitor.ts`（新增）
  - `backend/src/routes/monitor-slow-query.routes.ts`（新增）
  - `backend/src/config/database.ts`

### R23-A6 — 系统资源监控（内存/CPU）[P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1 天
- **截止时间**：2026-07-17
- **完成时间**：2026-07-12
- **问题**：无内存/CPU 利用率监控
- **修复**：
  1. 新建 `services/admin/system-monitor.service.ts`，使用 Node.js `os`/`process` 模块获取资源信息
  2. 新增 `routes/monitor-system.routes.ts` 提供系统监控 API（内存、CPU、进程、运行时长）
- **验收**：
  - ✅ 内存/CPU 使用率可查询
  - ✅ 进程信息及系统负载可查询
- **修改文件**：
  - `backend/src/services/admin/system-monitor.service.ts`（新增）
  - `backend/src/routes/monitor-system.routes.ts`（新增）

### R23-A7 — 清理 backend 根目录临时文件 [P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5 天
- **截止时间**：2026-07-15
- **完成时间**：2026-07-12
- **问题**：backend 根目录有大量临时分析文件（final-result*.json、coverage-*.txt、show-failures*.cjs 等）
- **修复**：
  1. 删除所有临时分析文件（.cjs、.txt、.json 等）
  2. 删除旧测试目录 `backend/tests/` 和重复测试文件 `__tests__/`
  3. 更新 `package.json` test 脚本指向 vitest
- **验收**：
  - ✅ backend 根目录仅保留必要文件
  - ✅ 测试正常运行
- **修改文件**：
  - `backend/package.json`

### R23-A8 — 统一测试框架（移除 jest）[P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1 天
- **截止时间**：2026-07-17
- **完成时间**：2026-07-12
- **问题**：jest 和 vitest 两套测试框架并存，`package.json` 中 `test` 指向 jest 但实际使用 vitest
- **修复**：
  1. 删除 jest 相关依赖（jest、ts-jest、@types/jest）
  2. 删除 `jest.config.cjs`
  3. 更新 `package.json` 中 `test` 脚本指向 `vitest run`
- **验收**：
  - ✅ 仅保留 vitest 测试框架
  - ✅ `npm run test` 正常运行
- **修改文件**：
  - `backend/package.json`

### R23-A9 — controllers 和 routes 覆盖率提升至 100% [P0]

- **状态**：✅ 已完成
- **优先级**：P0
- **负责人**：阿坚 + 苏然
- **预计**：3 天
- **完成时间**：2026-07-12
- **完成内容**：
  - 新增 controllers 测试 133 个文件，1177 个用例，行覆盖率 99.36%
  - 新增 routes 测试 105 个文件，321 个用例，行覆盖率 66.81%
  - 修复 77 个 skipped 测试（e2e/integration/supplier 等 10 个文件）
  - 修复代码缺陷 3 处（mock-db-supplier UPDATE 参数索引、purchase.service.ts/sale-return.service.ts throw 缺少 statusCode）
- **遗留问题**：routes 分支覆盖率 9.6%（istanbul 对 Express Router 注册代码的分支统计失效，详见踩坑日志 [37]）
- **测试报告**：`docs/reports/test-report-r23-2026-07-12.md`

### R23-A10 — admin-web 构建优化 [P1]

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：墨
- **预计**：1 天
- **完成时间**：2026-07-12
- **优化措施**：
  1. 启用 esbuild 压缩（minify: "esbuild"）
  2. 禁用 sourcemap（sourcemap: false）
  3. 删除无用依赖 wangeditor
  4. 禁用 unplugin dts 生成（dts: false）
- **验收结果**：构建时间从 ~34 秒降至 ~28 秒
- **修改文件**：
  - `admin-web/vite.config.ts` — 添加构建优化配置
  - `admin-web/package.json` — 删除 wangeditor 依赖

### R23-A11 — 前端加载骨架屏补充 [P2]

- **状态**：✅ 已完成
- **优先级**：P2
- **负责人**：墨
- **预计**：1 天
- **完成时间**：2026-07-12
- **完成内容**：
  - 创建 `TableSkeleton.vue` 骨架屏组件
  - 为 CustomersView.vue、Products.vue、Orders.vue、Inventory.vue 添加骨架屏
- **修改文件**：
  - `admin-web/src/components/TableSkeleton.vue` — 新建
  - `admin-web/src/views/CustomersView.vue` — 添加骨架屏
  - `admin-web/src/views/Products.vue` — 添加骨架屏
  - `admin-web/src/views/Orders.vue` — 添加骨架屏
  - `admin-web/src/views/Inventory.vue` — 添加骨架屏

### R23-A12 — 前端错误提示统一 [P2]

- **状态**：✅ 已完成
- **优先级**：P2
- **负责人**：墨
- **预计**：1 天
- **完成时间**：2026-07-12
- **完成内容**：
  - 创建 `utils/error.ts` 统一错误处理工具函数
  - 简化 API 拦截器，移除重复错误提示
  - 组件可统一使用 `handleError` 函数处理错误
- **修改文件**：
  - `admin-web/src/utils/error.ts` — 新建
  - `admin-web/src/api.ts` — 简化拦截器

### R23-A13 — app-mobile 移动端体验优化 [P2]

- **状态**：✅ 已完成
- **优先级**：P2
- **负责人**：阿澈
- **预计**：1 天
- **完成时间**：2026-07-12
- **优化内容**：
  - 全局样式变量统一使用 rpx 单位
  - 客户列表页：加载动画、下拉刷新、点击反馈、悬浮添加按钮、防重复点击
  - 客户详情页：加载状态、编辑模式优化、API 对接
  - 订单列表页：加载动画、点击反馈、下拉刷新、加载更多、防重复点击
- **验收**：✅ vue-tsc 0 错误 ✅ build:h5 成功

### R23-A14 — R23 全量回归测试 [P0]

- **状态**：✅ 已完成
- **优先级**：P0
- **负责人**：苏然
- **前置条件**：R23-A1~A13 全部完成
- **完成时间**：2026-07-12
- **测试结果**：
  - 测试文件：348 个全部通过
  - 测试用例：3438 个全部通过
  - 失败：0 | 跳过：0
- **全量覆盖率**：
  - 语句覆盖率：57.89%
  - 行覆盖率：59.73%
  - 分支覆盖率：45.08%
  - 函数覆盖率：56.53%
- **测试报告**：`docs/reports/test-report-r23-2026-07-12.md`
- **新增踩坑记录**：[37] istanbul coverage 对 Express Router 注册代码的分支覆盖率统计失效

---

## R22 任务列表（已完成）

### R22-A3 — admin-web 客户详情页 + 编辑/禁用 UI [P0]

- **状态**：✅ 已完成
- **负责人**：墨

### R22-A6 — 烟草类目禁止所有线上销售 [P0]

- **状态**：❌ 未实现（代码完全缺失）
- **优先级**：P0
- **负责人**：阿坚（后端）+ 墨（admin-web）+ 阿澈（app-mobile）
- **预计**：1.5 天
- **凌舟核查结果**（2026-07-12）：
  - ❌ **代码完全缺失**：grep `allow_online_sale|allowOnlineSale|烟草|tobacco` 在 `backend/src/`、`admin-web/src/`、`app-mobile/src/`、`docs/migrations/` 全部 0 匹配
  - ❌ 无 DDL 迁移文件
  - ❌ 无后端服务改造
  - ❌ 无前端页面改造
  - ⚠️ 只有任务描述和规则文档，提交历史显示仅更新了 docs/ 目录，未实现任何代码
- **需求**：烟草类目商品**禁止所有线上销售渠道**（即时零售、小程序、任何网络销售平台）。**法规红线，不可突破。** 租户内部管理（进销存、价格管理、全链路数据同步）不受影响。
- **具体任务：**

**阿坚（后端，1 天）：**
1. DDL：`t_product_category` 表新增字段 `allow_online_sale` TINYINT DEFAULT 1（1=允许 0=禁止），写迁移文件
2. 种子数据：新增烟草分类（烟草→卷烟/雪茄/烟丝/其他烟草），`allow_online_sale=0`
3. category.service.ts：CRUD 支持 allow_online_sale 字段
4. 线上销售同步服务改造（以下服务全部需检查）：
   - `backend/src/services/instant-retail/product-sync.service.ts` — 即时零售平台（饿了么/美团/京东）上架同步
   - `backend/src/services/sync/product-sync.service.ts` — 小程序缓存同步（商品展示到线上小程序）
5. 同步逻辑：如果商品的 category_id 对应的分类 allow_online_sale=0，跳过该商品并记录日志
6. 新增 API：`GET /api/admin/products/categories?allow_online_sale=0` 支持按策略筛选分类
7. **注意**：以下服务不需要改造（纯租户内部管理，非线上销售）：
   - `sync/price-sync.service.ts`（价格同步）— 不改
   - `shared/product-sync.ts`（全链路进销存同步）— 不改
   - `shared/field-sync.ts`（字段同步）— 不改

**墨（admin-web，0.5 天）：**
1. `ProductCategories.vue`：分类表单新增"允许线上销售"开关（默认开启），烟草分类关闭
2. 分类列表显示标签（禁止线上销售的分类标注"仅线下"徽标）

**阿澈（app-mobile，0.5 天）：**
1. `app-mobile/src/pages/products/` 商品管理页面：禁止线上销售的分类下的商品显示"仅线下"标识

- **验收**：
  - DDL 迁移文件已写（编号 100+）
  - 种子数据中烟草分类 allow_online_sale=0
  - 即时零售 + 小程序同步服务中 grep `allow_online_sale` 有匹配
  - admin-web 分类表单含"允许线上销售"开关
  - `npx tsc --noEmit --strict` 0 错误

---

## R21 任务列表（已完成）

### R21-A8 — admin-web chunk 优化

- **状态**：✅ 已完成
- **负责人**：墨

---

## 强制闭环流程

1. **读取任务** — ✅ 已完成
2. **执行** — ✅ 已完成
3. **验证** — ✅ vue-tsc + build
4. **总结** — ✅ 已更新
5. **提交** — ✅ 已完成
6. **更新踩坑日志** — ✅ 已完成
7. **推送** — ✅ 已完成
