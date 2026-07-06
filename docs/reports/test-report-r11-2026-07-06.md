# R11 测试报告 — R8 遗留任务补验收

> 日期：2026-07-06  
> 测试人：苏然  
> 验收对象：墨 R8-M2（表单校验三件套）、墨 R8-M4（前端路由规范化）  
> 验收方法：验收三步法（读代码 → 跑命令 → 看结果）  
> 对照标准：项目统一标准 第十一章 11.6 节

---

## R11-S1：墨 R8-M2 表单校验三件套正式验收 ✅ 通过

### 验收项 1：el-form 三件套（ref + :model + :rules）

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| el-form 总表单数 | `grep -rc '<el-form[ >]' src/views/ --include='*.vue'` | 127 |
| 缺 ref 的表单（排除 disabled/search/config/合理例外） | `grep '<el-form[ >]' \| grep -v ' ref=' \| ...` | 0 |
| 缺 :model 的表单（同上） | 同上 | 0 |
| 缺 :rules 的表单（同上） | 同上 | 0 |

**合理例外（无需校验）：**
- `CustomerTags.vue:86` — 标签选择器，无需要校验的输入字段
- `Products.vue:434` — 快速调价展示弹窗，el-input 只读
- `ProductCategories.vue` / `DepartmentManage.vue` — disabled 表单
- `PaymentConfigView.vue` / `SystemConfigView.vue` / `InstantRetailShelf.vue` — 配置面板
- `PlatformPanel.vue:93` — 回调URL/验签说明，只读展示

**代码证据：** grep 命令返回空结果，确认无遗漏。

### 验收项 2：FormRules + validate() 全覆盖

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 含 FormRules 的文件 | `grep -rl 'FormRules' src/views/ --include='*.vue'` | 57 个文件 |
| 缺 validate() 的文件 | `xargs grep -LE '\\.validate\\b'` | 0 |

**代码证据：** 57 个 FormRules 文件全部有 validate() 调用。

### 验收项 3：R10-M2 迁移验证（12 个文件）

| 文件 | FormRules | el-form :rules | 行内 :rules 残留 |
|------|:---:|:---:|:---:|
| GroupBuyManage.vue | 3 | 1 | 0 |
| CustomerCareRules.vue | 2 | 1 | 0 |
| CustomerSegments.vue | 2 | 1 | 0 |
| QuickEntryConfig.vue | 4 | 2 | 0 |
| RetailAnnouncement.vue | 2 | 1 | 0 |
| TodoList.vue | 2 | 1 | 0 |
| Units.vue | 2 | 1 | 0 |
| Brands.vue | 2 | 1 | 0 |
| CustomerTags.vue | 2 | 1 | 0 |
| SeckillManage.vue | 2 | 1 | 0 |
| MarketingTags.vue | 2 | 1 | 0 |
| ProductTags.vue | 2 | 1 | 0 |

**唯一保留行内 :rules 的文件：** `Products.vue`（SKU 动态 `:prop` 绑定，如 `:prop="'skus.' + idx + '.skuName'"`，无法移到 form-level）

**代码证据：** 每个文件 grep 确认 FormRules > 0、el-form :rules= > 0、el-form-item :rules= == 0。

### 验收项 4：R11 自检修复的 7 个表单

墨在 R11 自检中发现并修复了以下 7 个缺三件套的表单：

| 文件 | 表单 | 修复内容 |
|------|------|------|
| StoresView.vue | storeEditForm | +ref, +FormRules(name required), +validate() |
| PricesView.vue | skuPriceForm | +ref, +FormRules, +validate() |
| PricesView.vue | bindingForm | +ref, +FormRules(customerId/skuId required), +validate() |
| CustomerVisitRecords.vue | checkinForm | +ref, +FormRules(location required), +validate() |
| CustomerVisitRecords.vue | checkoutForm | +ref, +FormRules, +validate() |
| OrderProductMapView.vue | quickMapForm | +ref, +FormRules(localSkuId required), +validate() |
| CustomerPrices.vue | batchForm | +ref, +FormRules(customerId/skuIds/discountRate required), +validate() |

**代码证据：** 逐文件读取确认 ref + FormRules + validate() 均已添加。

---

## R11-S2：墨 R8-M4 前端路由规范化正式验收 ✅ 通过

### 验收项 1：meta.title 全中文

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 路由总数 | `grep -c 'name:' src/router/index.ts` | 113 |
| title 非中文 | `grep -oP "title: '\K[^']+" \| grep -vP '[\x{4e00}-\x{9fff}]'` | 0 |

**代码证据：** 113 条路由 title 全部为中文。

### 验收项 2：meta.icon 全覆盖

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| icon 覆盖数 | `grep -c 'icon:' src/router/index.ts` | 113 |
| icon 缺失 | `grep 'title:' \| grep -v 'icon:'` | 0 |

**代码证据：** 113/113 条路由全部有 meta.icon，导入 67 个 Element Plus Icons 组件。

### 验收项 3：路由命名 kebab-case

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| kebab-case 路由名 | `grep -c 'name: "[a-z]' src/router/index.ts` | 113 |
| PascalCase 残留 | `grep 'name: "[A-Z]' src/router/index.ts` | 0 |

**代码证据：** 113 条路由名全部为 kebab-case（如 sale-bills、sales-reports）。

### 验收项 4：权限守卫完整

| 检查项 | 代码位置 | 状态 |
|--------|------|:---:|
| Token 过期检查 | `auth.isTokenExpired()` → `auth.clearAuth()` → `next("/login")` | ✅ |
| requiresAuth 检查 | `to.meta.requiresAuth !== false && !token` → `next("/login")` | ✅ |
| 登录态跳转 | `to.path === "/login" && token` → `next("/dashboard")` | ✅ |
| 角色权限检查 | `allowedRoles.length > 0 && !allowedRoles.includes(userRole)` → `next("/dashboard")` | ✅ |

**代码证据：** 读取 `router.beforeEach` 完整代码，四个守卫全部存在且逻辑正确。

---

## 验收总结

| 验收项 | 检查数 | 通过 | 失败 | 结论 |
|--------|:---:|:---:|:---:|:---:|
| R11-S1 表单三件套 | 127 表单 / 57 FormRules / 12 迁移文件 | 全部 | 0 | ✅ 通过 |
| R11-S2 路由规范化 | 113 路由 / 4 守卫 | 全部 | 0 | ✅ 通过 |

**P0 问题：0 个**

**结论：墨 R8-M2（表单校验三件套）和 R8-M4（前端路由规范化）正式验收通过。**