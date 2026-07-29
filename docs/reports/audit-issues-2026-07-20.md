# 智享酒水库存管理系统 — 全面审查问题清单

> 审查时间：2026-07-20  
> 审查方式：生产环境浏览器实测 + 产品规划v6.1对比 + 代码审查  
> 生产地址：http://159.75.153.59

---

## 一、致命问题（系统不可用）

### P1-01：绝大多数后端API在真实MySQL下返回500
- **现象**：Dashboard加载后，所有API请求返回500错误或404
- **已测试的API状态**：

| API路径 | 状态码 | 说明 |
|---------|:------:|------|
| `/api/admin/auth/login` | 200 | ✅ 正常 |
| `/api/admin/health` | 200 | ✅ 正常 |
| `/api/admin/staff` | 200 | ✅ 正常 |
| `/api/admin/brands` | 200 | ✅ 正常 |
| `/api/admin/dashboard/supplier-stats` | 200 | ✅ 正常 |
| `/api/admin/dashboard/supplier-purchase-ranking` | 200 | ✅ 正常 |
| `/api/admin/dashboard/supplier-trend` | 200 | ✅ 正常 |
| `/api/admin/dashboard/supplier-on-time-rate` | 200 | ✅ 正常 |
| `/api/admin/system/stores` | **404** | ❌ 路由不存在 |
| `/api/admin/dashboard/overview` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/sales-trend` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/inventory-stats` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/customer-stats` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/top-products` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/top-customers` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/top-employees` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/category-pie` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/inventory-turnover` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/inventory-value-analysis` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/customer-growth-trend` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/customer-activity` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/customer-category-stats` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/inventory-warning` | **500** | ❌ SQL错误 |
| `/api/admin/dashboard/recent-alerts` | **500** | ❌ SQL错误 |
| `/api/admin/products` | **500** | ❌ SQL错误 |
| `/api/admin/products/categories` | **500** | ❌ SQL错误 |

- **根因**：service层手写SQL中表名混用了无`t_`前缀（如`brand`而非`t_brand`），`addTablePrefix()`只对`queryWithTenant`自动加前缀，手写SQL中的JOIN表名未统一
- **影响**：系统核心功能（商品、库存、客户、销售、订单、报表）全部不可用

### P1-02：migration角色分配失败导致所有用户roles为空
- **现象**：admin用户登录后roles返回空数组`[]`
- **根因**：`migration.ts`中角色分配使用了`safeExec(conn, sql, label)`，但`safeExec`函数不接受参数化值，导致`INSERT INTO t_sys_user_role VALUES (?, ?, ...)`中占位符无绑定值，SQL静默失败
- **影响**：前端无法通过角色做权限判断，所有用户看到相同菜单

### P1-03：侧边栏菜单不跳转（已修复但暴露API问题）
- **现象**：点击侧边栏菜单（如商品列表）后，URL不变，页面内容区不变
- **说明**：部署最新代码后路由跳转已修复（Products组件已加载），但页面因API 500无法展示数据
- **当前状态**：路由跳转正常，但页面全是空数据/错误状态

---

## 二、菜单缺失问题（对比产品规划v6.1）

### 产品规划12个一级模块 vs 侧边栏实际11个一级菜单

| 产品规划模块 | 侧边栏状态 | 问题说明 |
|-------------|:-----------:|---------|
| 1. 工作台 | ✅ 有 | — |
| 2. 销售管理 | ✅ 有 | 子菜单缺失严重（见下文） |
| 3. 采购管理 | ❌ **完全缺失** | 整个模块无菜单入口 |
| 4. 库存管理 | ✅ 有 | 子菜单缺失严重（见下文） |
| 5. 商品中心 | ✅ 有 | 子菜单缺失严重（见下文） |
| 6. 客户管理 | ✅ 有 | 子菜单缺失严重（见下文） |
| 7. 即时零售 | ✅ 有 | 子菜单缺失严重（见下文） |
| 8. 财务管理 | ✅ 有 | 子菜单缺失严重（见下文） |
| 9. 数据报表 | ✅ 有 | 子菜单缺失严重（见下文） |
| 10. 系统设置 | ✅ 有 | 子菜单缺失严重（见下文） |
| 11. 营销推广 | ✅ 有 | 子菜单缺失严重（见下文） |
| 12. 门店收银台 | ✅ 有（顶栏按钮） | 设计正确，通过顶栏切换 |

### 二级子菜单缺失明细

#### P2-01：采购管理 — 整个模块缺失（严重）
前端router中有8条采购路由，但侧边栏**完全没有采购管理入口**：
- 缺失：采购订单、采购入库、采购退货、采购合同、供应商管理、供应商对账、采购计划、采购付款

#### P2-02：销售管理 — 子菜单缺失
侧边栏仅5项，缺少：
- ❌ 收款关联（`/sales/collection-links`）
- ❌ 客户价格（`/sales/customer-prices`）
- ❌ 提成规则（`/sales/commission/rules`）
- ❌ 提成记录（`/sales/commission/records`）

#### P2-03：订单管理 — 子菜单缺失
侧边栏仅3项，缺少：
- ❌ 订单超时（`/order-timeout`）
- ❌ 订单路由（`/order-routing`）
- ❌ 订单同步（`/order-sync`）
- ❌ 订单异常（`/order-exception`）
- ❌ 订单商品映射（`/order-product-map`）
- ❌ 订单售后（`/order-aftersale`）

#### P2-04：库存管理 — 子菜单缺失
侧边栏仅3项（库存查询、库存盘点、库存预警），缺少：
- ❌ 库存调拨（`/inventory-transfer`）
- ❌ 库存批次（`/inventory-batch`）
- ❌ 库存共享设置（`/inventory-share-config`）
- ❌ 批量调价（`/inventory-batch-price`）
- ❌ 报价管理（`/inventory-price-quote`）
- ❌ 库存成本（`/inventory-cost`）
- ❌ 预警配置（`/inventory-alert-config`）
- ❌ 库存报表（`/inventory-reports`）

#### P2-05：商品中心 — 子菜单缺失
侧边栏仅3项（商品列表、商品分类、价格管理），缺少：
- ❌ 品牌管理（`/products/brands`）
- ❌ 单位管理（`/products/units`）
- ❌ 商品导入（`/products/import`）
- ❌ 商品标签（`/products/tags`）
- ❌ 标签分组（`/products/tag-groups`）
- ❌ 标签关联（`/products/tag-relation`）
- ❌ 商品审核（`/products/reviews`）
- ❌ 审核流程配置（`/products/review-workflow`）
- ❌ 审核任务（`/products/review-tasks`）
- ❌ 审核委托（`/products/review-delegation`）
- ❌ 套装与组合品（`/products/combo`）

#### P2-06：客户管理 — 子菜单缺失
侧边栏仅3项（客户列表、会员体系、储值卡），缺少：
- ❌ 客户标签（`/customer-tags`）
- ❌ 客户画像（`/customer-profile`）
- ❌ 客户关怀（`/customer-care`）
- ❌ 拜访记录（`/customer-visits`）
- ❌ 客户生命周期（`/customer-lifecycle`）
- ❌ 客户分群（`/customer-segments`）
- ❌ 信用管理（`/credit`）
- ❌ 积分规则（`/points-rules`）
- ❌ 等级配置（`/level-config`）

#### P2-07：即时零售 — 子菜单缺失
侧边栏仅3项（小程序订单、商品货架、零售报表），缺少：
- ❌ 平台配置（`/instant-retail/config`）
- ❌ 接单工作台（`/instant-retail/pickup`）
- ❌ 平台对账（`/instant-retail/payment`）
- ❌ 配送管理（`/instant-retail/delivery`）
- ❌ 平台管理（`/instant-retail/platform`）
- ❌ 订单看板（`/instant-retail/order-board`）
- ❌ 平台公告（`/instant-retail/announcements`）
- ❌ 零售看板（`/instant-retail/dashboard`）
- ❌ 库存同步（`/instant-retail/sync`）

#### P2-08：财务管理 — 子菜单缺失
侧边栏仅3项（银行账户、资金报表、票据管理），缺少：
- ❌ 收付款管理（`/payments`）
- ❌ 回款管理（`/finance/collection`）
- ❌ 客户对账（`/customer-statements`）
- ❌ 利润核算（`/finance/profit`）
- ❌ 收款单（`/finance/receipts`）
- ❌ 付款单（`/finance/payments`）
- ❌ 应收应付（`/finance/receivables-payables`）
- ❌ 费用管理（`/finance/expenses`）
- ❌ 财务对账（`/finance/reconciliation`）
- ❌ 财务看板（`/finance/dashboard`）

#### P2-09：数据报表 — 子菜单缺失
侧边栏仅4项（销售统计、商品排行、员工业绩、在线收款分析），缺少：
- ❌ 采购报表（`/reports/purchase`）
- ❌ 门店报表（`/reports/stores`）
- ❌ 销售分析（`/reports/sales-analysis`）
- ❌ 回款分析（`/reports/collection-analysis`）
- ❌ 客户分析（`/reports/customers`）
- ❌ 库存报表（`/reports/inventory`）
- ❌ 调拨统计（`/reports/transfer`）
- ❌ 自定义报表（`/reports/custom-report`）

#### P2-10：营销推广 — 子菜单缺失
侧边栏仅2项（营销活动、营销标签），缺少：
- ❌ 限时折扣（`/marketing/limited-discount`）
- ❌ 赠品规则（`/marketing/gift-rule`）
- ❌ 积分商城（`/marketing/points-mall`）
- ❌ 营销看板（`/marketing/dashboard`）
- ❌ 营销素材（`/marketing/materials`）
- ❌ 优惠券管理（`/marketing/coupon`）
- ❌ 秒杀活动（`/marketing/flash-sale`）
- ❌ 满减满赠（`/marketing/full-reduction`）
- ❌ 售后管理（`/aftersale`）

#### P2-11：系统设置 — 子菜单缺失
侧边栏仅7项（部门管理、岗位管理、员工管理、门店管理、角色权限、操作日志、错误日志），缺少：
- ❌ 系统配置（`/system/config`）
- ❌ 审批规则（`/system/approval/rules`）
- ❌ 我的审批（`/system/approval/my`）
- ❌ 报表权限（`/report-permissions`）
- ❌ 支付配置（`/system/payment`）
- ❌ 小程序配置（`/system/miniapp`）
- ❌ 系统监控（`/monitor`）
- ❌ 反馈管理（`/system/feedback`）

---

## 三、前端代码质量问题

### P3-01：views目录124个文件散落在根目录
- 所有功能页面.vue文件全部平铺在`views/`根目录
- 无任何功能子目录分类（sale/purchase/inventory/product/customer/finance/report等）
- 应按功能模块分子目录

### P3-02：3对功能重复文件
| views/根目录文件 | pos/目录文件 | 说明 |
|-----------------|-------------|------|
| SaleBills.vue (287行) | pos/SaleBillsView.vue (167行) | 销售单据列表重复 |
| SaleReturnsView.vue (284行) | pos/SaleReturnView.vue (194行) | 销售退货重复 |
| Collection.vue (261行) | pos/CollectionView.vue (141行) | 收款管理重复 |

### P3-03：api/pos.ts 命名不当
- 混合了POS收银API、职位管理API、租户监控API
- 应拆分为独立模块

### P3-04：SaaS平台残留代码（已修复）
- MainLayout.vue中的SaaS菜单已删除 ✅
- api/tenant.ts中的SaaS API已清理 ✅
- api/misc.ts中的平台API已清理 ✅

---

## 四、后端代码质量问题

### P4-01：service层SQL表名不统一
- 手写SQL中部分表名未加`t_`前缀（如`brand`应为`t_brand`）
- `addTablePrefix()`只对`queryWithTenant`自动加前缀，手写SQL不自动处理
- 需全面排查所有service中的手写SQL

### P4-02：migration中safeExec函数不支持参数化查询
- `safeExec(conn, sql, label)` 只有3个参数，不接受values
- 角色分配INSERT使用了占位符`?`但无法传值，静默失败
- 已修复为`conn.query(sql, [values])` ✅

### P4-03：404路由缺失
- `/api/admin/system/stores` 返回404（门店管理API路由未正确注册或路径不匹配）

---

## 五、部署与配置问题

### P5-01：pm2启动CWD错误（已修复）
- pm2启动时未设置`--cwd`，导致dotenv无法加载.env
- 已修复 ✅

### P5-02：deploy脚本强制USE_MOCK_DB=false（已修复）
- 部署脚本已增加sed强制覆盖 ✅

### P5-03：Nginx配置中残留已删除的子项目
- merchant-mobile和store-terminal配置已清理 ✅

---

## 六、UI/UX问题（浏览器实测）

### P6-01：Dashboard数据全部为零/空
- 所有指标卡片显示¥0、0单、0个
- 所有图表区域显示"暂无数据"
- 原因：API返回500 + 真实数据库无种子数据

### P6-02：门店选择器无数据
- Dashboard顶部"全部门店"下拉框无门店可选
- `/api/admin/system/stores`返回404

### P6-03：用户名显示"系 系统管理员"
- 顶栏右上角用户名前有"系"字前缀（可能取了角色代码首字母）
- 应只显示"系统管理员"

### P6-04：日期显示可能有时区问题
- Dashboard显示"2026年07月20日 星期一"
- 需确认是否跟随服务器时区

---

## 七、优先级排序与整改计划建议

### 第一优先级：系统可用性（必须立即修复）
1. **P1-01**：修复所有service层SQL表名前缀问题 → 全量排查所有手写SQL
2. **P1-02**：修复migration角色分配（已完成）
3. **P4-03**：修复门店管理404路由
4. 种子数据：为真实MySQL添加初始演示数据（门店、分类、商品等）

### 第二优先级：菜单完整性
5. **P2-01至P2-11**：补全所有缺失的二级菜单入口

### 第三优先级：代码质量
6. **P3-01**：views目录按功能重组
7. **P3-02**：处理功能重复文件
8. **P3-03**：api模块拆分

### 第四优先级：UI/UX优化
9. **P6-03**：修复用户名显示前缀
10. 其余UI细节待系统可用后逐一检查
