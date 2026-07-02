# 智享全链管理系统 · 产品功能清单 v6.1 · 酒水行业适配版

**版本**: v6.1 · 酒水行业适配版
**日期**: 2026-06-30
**更新**: 2026-06-30 V6.1（补充5个已完成模块的完整字段定义：销售管理17表/280字段/73API、采购管理14表/230字段/48API、库存管理12表/170字段/55API、客户管理16表/210字段/66API、财务往来11表/180字段/52API，合计70表/~1070字段/294API）
**来源**: 掌盘全行业 v6.0 模板 → 适配酒水饮料行业

---

## 核心理念

### PC端统一

**PC端只有一端**：管理后台和收银台是同一个应用，根据账户角色权限自动切换功能视图。

- 老板/管理员登录 → 看到完整管理后台（全部菜单、报表、系统设置）
- 收银员登录 → 自动进入收银台模式（仅POS开单、班结、收款）
- 店长登录 → 管理后台视图 + 本门店数据范围
- 同一个入口、同一套代码、同一套部署，权限决定所见

> 不做"管理后台"和"收银台"两个独立PC端应用。收银台是管理后台的一个视图模式，通过角色权限切换。

### 移动端统一

**移动端也只有一端**：商家功能和门店收银是同一个 H5 应用，根据账户角色权限自动切换功能视图。

- 老板/管理员登录 → 看到完整商家功能（采购、销售、库存、报表、客户等）
- 店员登录 → 自动进入门店收银模式（POS开单、日结盘点、库存查询、商品查询）
- 同一个入口、同一套代码、同一套部署，权限决定所见

> 不做"商家移动端"和"门店终端"两个独立 H5 应用。门店终端是商家移动端的一个视图模式，通过角色权限切换。

### 域名规划

| 域名 | 用途 | 类型 |
|------|------|------|
| `api.onepan.cn` | 后端 API（所有端共用） | 后端 |
| `admin.onepan.cn` | 商家PC端（管理后台 + 收银台，权限切换） | 前端 |
| `m.onepan.cn` | 商家移动端（商家功能 + 门店收银，权限切换） | 前端 |
| `saas.onepan.cn` | 平台总后台（运营方超级管理端） | 前端 |

> 域名分配原则：PC端和移动端各自统一为一个域名，通过角色权限切换视图。平台总后台独立域名 `saas.onepan.cn`，与商家端完全隔离。4 个域名，简洁清晰。

### 定价策略

**待定**。产品定价模式将在全部功能完成后，结合成本核算、市场定位、竞品分析后确定。当前规划阶段不预设任何价格方案。

---

## 目录索引（12 个一级目录，统一 4 字）

1.  **工作总台** - 经营概览、待办提醒、快捷入口...
2.  **销售管理** - 销售开单、订单生命周期、分享收款、出库退货...
3.  **订单管理** - 全渠道订单聚合、分发、状态同步、异常处理（整合原全渠道订单中心）
4.  **采购管理** - 采购订单、入库、退货、供应商、对账...
5.  **库存管理** - 查询、出入库、盘点、调拨、预警、成本...
6.  **客户管理** - 客户档案、积分等级、储值卡、会员体系（整合原客户与会员中心）
7.  **商品中心** - 商品档案、SKU、分类品牌、标签属性、价格管理...
8.  **即时零售** - 平台对接、接单工作台、库存同步、履约调度...
9.  **财务往来** - 收款管理、付款管理、应收应付、对账中心（整合原财务与往来中心，原财务管理改名）
10. **数据报表** - 经营总览、销售分析、商品分析、客户分析...（原经营分析中心）
11. **营销中心** - 优惠券、限时折扣、满减满赠、积分商城...（原营销推广）
12. **系统设置** - 门店管理、员工管理、角色权限、操作日志、参数配置...（原系统管理，含门店子模块）

---

## 第一部分：字段属性体系（通用规范）

### 1.1 字段 8 属性

| 属性 | 取值说明 |
|------|---------|
| 字段名 | 中文显示名 + snake_case 编码 |
| 类型 | 17 种字段类型之一 |
| 必填 | ✓ 必填 / ✗ 选填 / 条件必填 |
| 长度/范围 | 字符数 / 数值区间 |
| 校验规则 | 12 种校验枚举之一或组合 |
| 默认值 | 字面值 / 公式 / 上下文变量 |
| 权限 | 8 种角色之一 |
| 备注 | 业务规则自由文本 |

### 1.2 字段类型枚举（17 种）

| 类型 | 前端组件 | 数据库 | 适用场景（酒水行业） |
|------|---------|--------|----------------------|
| text | Input | VARCHAR | 名称、编码、地址 |
| longtext | Textarea | TEXT | 商品详情、备注 |
| number | InputNumber | INT | 数量、比例 |
| decimal | InputNumber | DECIMAL | 酒精度 |
| money | InputMoney | DECIMAL(18,2) | 单价、金额 |
| percent | InputPercent | DECIMAL(5,2) | 折扣、税率 |
| date | DatePicker | DATE | 到期日、生产日期 |
| datetime | DateTimePicker | DATETIME | 创建时间 |
| select | Select | VARCHAR | 状态、类型 |
| multi-select | Select(multi) | JSON | 可售渠道 |
| search-select | AutoComplete | BIGINT(FK) | 客户搜索、商品搜索 |
| radio | Radio | TINYINT | 销售类型（现结/赊销） |
| checkbox | Checkbox | JSON | 标签多选 |
| toggle | Switch | TINYINT(0/1) | 启用/停用 |
| upload | Upload | VARCHAR(URL) | 文件 |
| image | Upload(image) | VARCHAR(URL) | 商品图片 |
| barcode | InputScan | VARCHAR | 条码（支持扫码枪） |
| signature | Canvas | VARCHAR(URL) | 对账签字（极少用） |
| richtext | Editor | TEXT | 商品详情 |
| formula | 只读 | 不存库 | 金额计算 |

### 1.3 校验规则枚举（12 种）

required / unique / len[a,b] / range[a,b] / regex / enum / fk / logic / compare / date-future / no-emoji / no-space

### 1.4 权限矩阵（8 种角色，适配酒水经销）

| 角色 | 说明 |
|------|------|
| ALL | 全部登录用户 |
| BOSS | 老板/总部管理员（全数据） |
| MGR | 店长/门店主管（限本门店） |
| SALES | 业务员（仅自己客户） |
| CASHIER | 收银员（POS/班结） |
| FIN | 财务（往来账操作） |
| STOCK | 库管（出入库权限） |
| CUSTOMER | 客户（小程序只读） |
| SYS | 系统（自动写入） |

### 1.5 优先级分层

| 标记 | 批次 | 适配套餐 |
|------|------|---------|
| 🔴 P0 | MVP 首发 | 基础版（必做，不上系统不可用） |
| 🟡 P1 | 第二批 | 进阶版（缺了能用但不完整） |
| 🟢 P2 | 远期 | 连锁版（锦上添花） |
| ⭐⭐ | 核心差异化 | — |

---

## 第二部分：商品中心

**定位**: 整个系统的"商品账"主数据底座，所有业务表外键根节点。

**适配说明**: 全行业模板保留，针对酒水做字段优化。删除不相关内容（套装组合可延后）。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 商品档案 | 🔴 P0 | SPU 级商品主数据 | ~80 | 保留酒精度、产地字段，删除化妆品规格等不相关内容 |
| 2. SKU 与规格单位 | 🔴 P0 | 计量单位体系、SKU规格 | ~60 | 保留箱/瓶双单位，适配酒水包装习惯 ✅ |
| 3. 分类与品牌 | 🔴 P0 | 两级分类、品牌库 | ~40 | 保留，酒水行业必须 |
| 4. 标签与属性管理 | 🔴 P0 | 香型、产地标签 | ~50 | 适配：香型、度数、产区等标签 |
| 5. 商品图片与详情 | 🔴 P0 | 主图、轮播、详情图 | ~30 | 保留 |
| 6. 批次追溯与有效期 | 🟡 P1 | 批次管理、追溯码、保质期 | ~45 | 追溯码+批次+有效期合并，酒水行业需要，放P1 |
| 7. 套装与组合品 | 🟢 P2 | 礼盒组合、套票 | ~30 | 不适合基础版，放在P2远期 |
| 8. 价格管理 | 🔴 P0 | 成本/零售/批发/小程序/门店价 | ~50 | 保留多价格体系，适配酒水多级价格 ✅ |
| 9. 商品营销标签 | 🔴 P0 | 新品、爆款、推荐标签 | ~26 | 保留 |
| 10. 商品导入导出 | 🔴 P0 | 批量导入商品 | ~10 | 保留 |
| 11. 商品审核与上下架 | 🟢 P2 | 工作流审核 | ~20 | 中小经销商不需要，放P2 |
| **合计** | | | **561** | 适配后保留 ~520 字段 |

### 商品中心 · 字段与表结构详解

#### 数据表定义

##### 1. product_spu（商品SPU表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 商品SPU ID |
| spu_code | VARCHAR(64) NOT NULL UNIQUE | 商品编码 |
| name | VARCHAR(255) NOT NULL | 商品名称 |
| sub_name | VARCHAR(255) DEFAULT NULL | 副标题 |
| category_id | BIGINT UNSIGNED DEFAULT NULL | 分类ID |
| brand_id | BIGINT UNSIGNED DEFAULT NULL | 品牌ID |
| alcohol_content | DECIMAL(5,2) DEFAULT NULL | 酒精度（%） |
| volume_ml | INT DEFAULT NULL | 净含量（ml） |
| origin | VARCHAR(128) DEFAULT NULL | 产地 |
| aroma_type | VARCHAR(32) DEFAULT NULL | 香型：酱香/浓香/清香/米香/兼香/其他 |
| shelf_life_days | INT DEFAULT NULL | 保质期天数 |
| main_image | VARCHAR(512) DEFAULT NULL | 主图URL |
| images | JSON DEFAULT NULL | 轮播图列表 |
| detail_images | JSON DEFAULT NULL | 详情图列表 |
| description | TEXT DEFAULT NULL | 商品描述 |
| tags | JSON DEFAULT NULL | 商品标签（新品/爆款/推荐等） |
| trace_enabled | TINYINT NOT NULL DEFAULT 0 | 是否启用追溯 |
| unit_type | VARCHAR(16) NOT NULL DEFAULT 'BOTTLE' | 基础单位：BOTTLE(瓶)/BOX(箱) |
| box_ratio | INT NOT NULL DEFAULT 1 | 箱/瓶换算比例（1箱=N瓶） |
| status | VARCHAR(32) NOT NULL DEFAULT 'DRAFT' | 状态：DRAFT/PUBLISHED/OFFLINE/DELETED |
| audit_status | VARCHAR(32) DEFAULT 'PENDING' | 审核状态：PENDING/APPROVED/REJECTED |
| audit_remark | VARCHAR(255) DEFAULT NULL | 审核备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 2. product_sku（商品SKU表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | SKU ID |
| spu_id | BIGINT UNSIGNED NOT NULL | 关联SPU ID |
| sku_code | VARCHAR(64) NOT NULL UNIQUE | SKU编码 |
| sku_name | VARCHAR(255) NOT NULL | SKU名称 |
| barcode | VARCHAR(64) DEFAULT NULL | 条码 |
| spec | VARCHAR(128) DEFAULT NULL | 规格描述（如：500ml/瓶） |
| unit | VARCHAR(16) NOT NULL DEFAULT 'BOTTLE' | 单位：BOTTLE/BOX |
| box_ratio | INT NOT NULL DEFAULT 1 | 箱瓶换算 |
| cost_price | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 成本价 |
| retail_price | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 建议零售价 |
| wholesale_price | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 批发价 |
| miniapp_price | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 小程序售价 |
| store_price | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 门店售价 |
| weight_g | INT DEFAULT NULL | 重量（克） |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/DISABLED |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 3. product_category（商品分类表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 分类ID |
| parent_id | BIGINT UNSIGNED DEFAULT NULL | 父分类ID |
| name | VARCHAR(64) NOT NULL | 分类名称 |
| icon | VARCHAR(255) DEFAULT NULL | 分类图标 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| level | TINYINT NOT NULL DEFAULT 1 | 层级：1/2 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 4. product_price（商品价格表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 价格ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| price_type | VARCHAR(32) NOT NULL | 价格类型：COST/RETAIL/WHOLESALE/MINIAPP/STORE |
| price | DECIMAL(12,2) NOT NULL | 价格 |
| effective_start | DATE DEFAULT NULL | 生效开始日期 |
| effective_end | DATE DEFAULT NULL | 生效结束日期 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 5. sku_price（阶梯价格表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 价格ID |
| sku_id | INT NOT NULL | SKU ID |
| price_level_id | INT NOT NULL | 价格等级ID |
| min_qty | INT DEFAULT 1 | 起订量 |
| price | DECIMAL(12,2) NOT NULL | 单价 |
| cost_price | DECIMAL(12,2) DEFAULT 0 | 成本价 |
| suggested_retail_price | DECIMAL(12,2) DEFAULT 0 | 建议零售价 |
| effective_start | DATE DEFAULT NULL | 生效开始日期 |
| effective_end | DATE DEFAULT NULL | 生效结束日期 |
| status | TINYINT DEFAULT 1 | 状态 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 6. price_level（价格等级表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 等级ID |
| level_code | VARCHAR(32) NOT NULL UNIQUE | 等级编码 |
| level_name | VARCHAR(64) NOT NULL | 等级名称 |
| discount_rate | DECIMAL(5,4) DEFAULT 1.0000 | 折扣率 |
| min_order_amount | DECIMAL(12,2) DEFAULT 0 | 最低订单金额门槛 |
| description | VARCHAR(255) DEFAULT '' | 等级说明 |
| sort_order | INT DEFAULT 0 | 排序 |
| status | TINYINT DEFAULT 1 | 状态 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 7. customer_price_binding（客户价格绑定表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 绑定ID |
| customer_id | BIGINT UNSIGNED NOT NULL | 客户ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| price_level_id | INT UNSIGNED DEFAULT NULL | 价格等级ID |
| custom_price | DECIMAL(12,2) DEFAULT NULL | 专属价格 |
| effective_start | DATE DEFAULT NULL | 生效开始 |
| effective_end | DATE DEFAULT NULL | 生效结束 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 8. trace_code（追溯码表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 追溯码ID |
| trace_code | VARCHAR(128) NOT NULL UNIQUE | 追溯码 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| batch_no | VARCHAR(64) DEFAULT NULL | 批次号 |
| production_date | DATE DEFAULT NULL | 生产日期 |
| expiry_date | DATE DEFAULT NULL | 有效期至 |
| status | VARCHAR(32) NOT NULL DEFAULT 'STORED' | 状态：STORED/SOLD/RETURNED/SCRAPPED |
| store_id | BIGINT UNSIGNED DEFAULT NULL | 当前所在门店 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 9. trace_config（追溯配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 配置ID |
| spu_id | BIGINT UNSIGNED NOT NULL | SPU ID |
| trace_type | VARCHAR(32) NOT NULL DEFAULT 'BATCH' | 追溯类型：BATCH(批次)/SINGLE(单品) |
| enabled | TINYINT NOT NULL DEFAULT 0 | 是否启用 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 10. trace_event_log（追溯事件日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| trace_code | VARCHAR(128) NOT NULL | 追溯码 |
| event_type | VARCHAR(32) NOT NULL | 事件类型：IN_STOCK/OUT_STOCK/SALE/RETURN/SCRAP |
| operator_id | BIGINT UNSIGNED DEFAULT NULL | 操作人 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 11. trace_scan_log（追溯扫码日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| trace_code | VARCHAR(128) NOT NULL | 追溯码 |
| scan_user_id | BIGINT UNSIGNED DEFAULT NULL | 扫码用户 |
| ip | VARCHAR(64) DEFAULT NULL | IP地址 |
| user_agent | VARCHAR(512) DEFAULT NULL | 用户代理 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 12. recall_record（召回记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 召回ID |
| recall_no | VARCHAR(64) NOT NULL UNIQUE | 召回单号 |
| sku_id | BIGINT UNSIGNED DEFAULT NULL | SKU ID |
| batch_no | VARCHAR(64) DEFAULT NULL | 批次号 |
| reason | VARCHAR(255) NOT NULL | 召回原因 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/IN_PROGRESS/COMPLETED |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 13. product_price_log（价格变更日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| price_type | VARCHAR(32) NOT NULL | 价格类型 |
| old_price | DECIMAL(12,2) NOT NULL | 旧价格 |
| new_price | DECIMAL(12,2) NOT NULL | 新价格 |
| change_reason | VARCHAR(255) DEFAULT NULL | 变更原因 |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 14. price_change_log（批量调价日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| batch_no | VARCHAR(64) NOT NULL | 调价批次号 |
| change_type | VARCHAR(32) NOT NULL | 调价类型：FIXED_AMOUNT/PERCENTAGE/PER_ITEM |
| change_value | DECIMAL(12,2) DEFAULT NULL | 调价幅度 |
| sku_count | INT NOT NULL DEFAULT 0 | 涉及SKU数 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/EXECUTED/ROLLBACK |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/products | 商品SPU列表 |
| POST | /api/admin/products | 创建商品 |
| GET | /api/admin/products/:id | 商品详情 |
| PUT | /api/admin/products/:id | 更新商品 |
| DELETE | /api/admin/products/:id | 删除商品 |
| POST | /api/admin/products/:id/publish | 上架商品 |
| POST | /api/admin/products/:id/offline | 下架商品 |
| GET | /api/admin/products/:id/skus | SKU列表 |
| POST | /api/admin/products/:id/skus | 创建SKU |
| PUT | /api/admin/skus/:id | 更新SKU |
| DELETE | /api/admin/skus/:id | 删除SKU |
| GET | /api/admin/categories | 分类列表 |
| POST | /api/admin/categories | 创建分类 |
| PUT | /api/admin/categories/:id | 更新分类 |
| DELETE | /api/admin/categories/:id | 删除分类 |
| GET | /api/admin/price-levels | 价格等级列表 |
| POST | /api/admin/price-levels | 创建价格等级 |
| PUT | /api/admin/price-levels/:id | 更新价格等级 |
| DELETE | /api/admin/price-levels/:id | 删除价格等级 |
| GET | /api/admin/sku-prices | 阶梯价格列表 |
| POST | /api/admin/sku-prices | 创建阶梯价格 |
| PUT | /api/admin/sku-prices/:id | 更新阶梯价格 |
| GET | /api/admin/customer-prices | 客户价格绑定列表 |
| POST | /api/admin/customer-prices | 创建客户价格绑定 |
| PUT | /api/admin/customer-prices/:id | 更新客户价格绑定 |
| DELETE | /api/admin/customer-prices/:id | 删除客户价格绑定 |
| GET | /api/admin/trace-codes | 追溯码列表 |
| POST | /api/admin/trace-codes | 生成追溯码 |
| GET | /api/admin/trace-codes/:code | 追溯码详情 |
| GET | /api/admin/trace-codes/:code/logs | 追溯码事件日志 |
| GET | /api/admin/recall-records | 召回记录列表 |
| POST | /api/admin/recall-records | 创建召回记录 |
| POST | /api/admin/products/import | 批量导入商品 |
| GET | /api/admin/products/export | 导出商品 |
| POST | /api/admin/products/batch-update-price | 批量调价 |
| GET | /api/admin/price-change-logs | 调价日志列表 |

#### 汇总统计

- 表数量：14
- 字段总数：约 180
- API数量：32


> **酒水行业关键字段**: 酒精度（alcohol_content）、产地（origin）、箱/瓶换算比例（box_ratio）、批次追溯（trace_enabled）、多渠道价格体系。

---

## 第三部分：采购管理

**定位**: 供应商端进货全流程。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 采购订单 | 🔴 P0 | 给供应商下订单 | ~70 | 保留 |
| 2. 采购入库 | 🔴 P0 | 货到入库 | ~50 | 保留 |
| 3. 采购退货 | 🔴 P0 | 临期/滞销退货给供应商 | ~45 | 酒水行业重要，临期品必须退 ✅ |
| 4. 供应商档案 | 🔴 P0 | 供应商基础信息 | ~80 | 保留账期、结算方式 |
| 5. 供应商对账 | 🔴 P0 | 对账单、付款核销 | ~70 | 保留 |
| 6. 采购计划与智能补货 | 🟡 P1 | 销售预测补货 | ~75 | 有价值但非必须，放P1 |
| 7. 采购合同 | 🟡 P1 | 合同管理 | ~40 | 中小客户不需要，放P1 |
| 8. 采购报表 | 🟡 P1 | 供应商贡献分析 | ~33 | 放P1 |
| **合计** | | | **463** | 适配后保留 ~338 字段 |

> **酒水适配**: 保留临期退货（重要），删除工程类采购相关内容。

### 采购管理 · 字段与表结构详解

### 2.1 数据表定义

#### 2.1.1 supplier（供应商表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 供应商ID |
| supplier_code | VARCHAR(64) NOT NULL UNIQUE | 供应商编码 |
| name | VARCHAR(128) NOT NULL | 供应商名称 |
| short_name | VARCHAR(64) DEFAULT NULL | 简称 |
| category | VARCHAR(32) DEFAULT NULL | 类别：酒厂/经销商/批发商 |
| province | VARCHAR(64) DEFAULT NULL | 省 |
| city | VARCHAR(64) DEFAULT NULL | 市 |
| district | VARCHAR(64) DEFAULT NULL | 区 |
| address | VARCHAR(255) DEFAULT NULL | 详细地址 |
| credit_level | VARCHAR(16) DEFAULT 'B' | 信用等级：A/B/C/D |
| settlement_type | VARCHAR(32) NOT NULL DEFAULT 'CASH' | 结算方式：CASH/MONTHLY/QUARTERLY |
| settlement_day | INT DEFAULT NULL | 结算日 |
| tax_rate | DECIMAL(8,4) NOT NULL DEFAULT 0.0000 | 默认税率 |
| bank_name | VARCHAR(128) DEFAULT NULL | 开户银行 |
| bank_account | VARCHAR(64) DEFAULT NULL | 银行账号 |
| bank_account_name | VARCHAR(64) DEFAULT NULL | 开户名 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.2 supplier_contact（供应商联系人表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 联系人ID |
| supplier_id | BIGINT UNSIGNED NOT NULL | 供应商ID |
| name | VARCHAR(64) NOT NULL | 联系人姓名 |
| mobile | VARCHAR(20) DEFAULT NULL | 手机号 |
| phone | VARCHAR(32) DEFAULT NULL | 固定电话 |
| email | VARCHAR(128) DEFAULT NULL | 邮箱 |
| wechat | VARCHAR(64) DEFAULT NULL | 微信号 |
| is_primary | TINYINT NOT NULL DEFAULT 0 | 是否主联系人 |
| position | VARCHAR(64) DEFAULT NULL | 职位 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.3 purchase_order（采购订单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 采购订单ID |
| order_no | VARCHAR(64) NOT NULL UNIQUE | 采购订单号 |
| supplier_id | BIGINT UNSIGNED NOT NULL | 供应商ID |
| supplier_name | VARCHAR(128) NOT NULL | 供应商名称快照 |
| store_id | BIGINT UNSIGNED NOT NULL | 入库门店ID |
| order_status | VARCHAR(32) NOT NULL DEFAULT 'DRAFT' | 订单状态：DRAFT/PENDING/APPROVED/PARTIAL/COMPLETED/CANCELLED |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| discount_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 优惠金额 |
| payable_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应付金额 |
| paid_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已付金额 |
| unpaid_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 未付金额 |
| expected_date | DATE DEFAULT NULL | 预计到货日期 |
| actual_date | DATE DEFAULT NULL | 实际到货日期 |
| operator_id | BIGINT UNSIGNED NOT NULL | 制单人 |
| auditor_id | BIGINT UNSIGNED DEFAULT NULL | 审核人 |
| audited_at | DATETIME DEFAULT NULL | 审核时间 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.4 purchase_order_item（采购订单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| order_no | VARCHAR(64) NOT NULL | 采购订单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| barcode | VARCHAR(128) DEFAULT NULL | 条码快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 采购单价（瓶） |
| tax_rate | DECIMAL(8,4) NOT NULL DEFAULT 0.0000 | 税率 |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计金额 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| total_amount | DECIMAL(12,2) NOT NULL | 含税小计 |
| in_stocked_qty | INT NOT NULL DEFAULT 0 | 已入库数量 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 2.1.5 purchase_in_stock（采购入库单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 采购入库单ID |
| stock_no | VARCHAR(64) NOT NULL UNIQUE | 入库单号 |
| order_no | VARCHAR(64) DEFAULT NULL | 关联采购订单号 |
| supplier_id | BIGINT UNSIGNED NOT NULL | 供应商ID |
| supplier_name | VARCHAR(128) NOT NULL | 供应商名称快照 |
| store_id | BIGINT UNSIGNED NOT NULL | 入库门店ID |
| stock_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/COMPLETED/VOIDED |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| total_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 合计金额 |
| operator_id | BIGINT UNSIGNED NOT NULL | 入库人 |
| auditor_id | BIGINT UNSIGNED DEFAULT NULL | 审核人 |
| audited_at | DATETIME DEFAULT NULL | 审核时间 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.6 purchase_in_stock_item（采购入库单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| stock_no | VARCHAR(64) NOT NULL | 入库单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 入库单价（瓶） |
| tax_rate | DECIMAL(8,4) NOT NULL DEFAULT 0.0000 | 税率 |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计金额 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| total_amount | DECIMAL(12,2) NOT NULL | 含税小计 |
| batch_no | VARCHAR(64) DEFAULT NULL | 批次号 |
| production_date | DATE DEFAULT NULL | 生产日期 |
| expiry_date | DATE DEFAULT NULL | 有效期至 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 2.1.7 purchase_return（采购退货单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 采购退货单ID |
| return_no | VARCHAR(64) NOT NULL UNIQUE | 退货单号 |
| order_no | VARCHAR(64) DEFAULT NULL | 关联采购订单号 |
| stock_no | VARCHAR(64) DEFAULT NULL | 关联入库单号 |
| supplier_id | BIGINT UNSIGNED NOT NULL | 供应商ID |
| supplier_name | VARCHAR(128) NOT NULL | 供应商名称快照 |
| store_id | BIGINT UNSIGNED NOT NULL | 退货门店ID |
| return_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/COMPLETED/VOIDED |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| total_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 合计金额 |
| refund_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应退金额 |
| refunded_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已退金额 |
| operator_id | BIGINT UNSIGNED NOT NULL | 退货人 |
| auditor_id | BIGINT UNSIGNED DEFAULT NULL | 审核人 |
| audited_at | DATETIME DEFAULT NULL | 审核时间 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.8 purchase_return_item（采购退货单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| return_no | VARCHAR(64) NOT NULL | 退货单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 退货单价（瓶） |
| tax_rate | DECIMAL(8,4) NOT NULL DEFAULT 0.0000 | 税率 |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计金额 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| total_amount | DECIMAL(12,2) NOT NULL | 含税小计 |
| reason | VARCHAR(255) DEFAULT NULL | 退货原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 2.1.9 purchase_payment（采购付款单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 采购付款单ID |
| payment_no | VARCHAR(64) NOT NULL UNIQUE | 付款单号 |
| supplier_id | BIGINT UNSIGNED NOT NULL | 供应商ID |
| supplier_name | VARCHAR(128) NOT NULL | 供应商名称快照 |
| payment_type | VARCHAR(32) NOT NULL DEFAULT 'ORDER' | 付款类型：ORDER/RETURN/ADVANCE |
| source_type | VARCHAR(32) DEFAULT NULL | 来源类型：PURCHASE_ORDER/PURCHASE_RETURN |
| source_no | VARCHAR(64) DEFAULT NULL | 来源单号 |
| amount | DECIMAL(12,2) NOT NULL | 付款金额 |
| payment_method | VARCHAR(32) NOT NULL DEFAULT 'BANK' | 付款方式：BANK/CASH/WECHAT/ALIPAY |
| bank_account | VARCHAR(64) DEFAULT NULL | 收款账号 |
| bank_account_name | VARCHAR(64) DEFAULT NULL | 收款人 |
| bank_name | VARCHAR(128) DEFAULT NULL | 收款银行 |
| voucher_no | VARCHAR(64) DEFAULT NULL | 凭证号 |
| payment_date | DATE NOT NULL | 付款日期 |
| operator_id | BIGINT UNSIGNED NOT NULL | 付款人 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/COMPLETED/VOIDED |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.10 supplier_statement（供应商对账单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 对账单ID |
| statement_no | VARCHAR(30) NOT NULL UNIQUE | 对账单号 |
| supplier_id | BIGINT UNSIGNED NOT NULL | 供应商ID |
| period_start | DATE NOT NULL | 对账开始日期 |
| period_end | DATE NOT NULL | 对账结束日期 |
| total_purchase_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 采购总额 |
| total_paid_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已付总额 |
| total_return_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 退货总额 |
| balance_amount | DECIMAL(12,2) GENERATED ALWAYS AS (total_purchase_amount - total_paid_amount - total_return_amount) STORED | 余额 |
| status | ENUM('DRAFT','CONFIRMED','DISPUTED') NOT NULL DEFAULT 'DRAFT' | 状态 |
| confirmed_by | BIGINT DEFAULT NULL | 确认人 |
| confirmed_at | DATETIME DEFAULT NULL | 确认时间 |
| remark | VARCHAR(500) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.11 supplier_statement_item（供应商对账明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| statement_id | BIGINT UNSIGNED NOT NULL | 对账单ID |
| purchase_order_id | BIGINT UNSIGNED NOT NULL | 采购订单ID |
| purchase_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 采购金额 |
| payment_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 付款金额 |
| return_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 退货金额 |
| balance | DECIMAL(12,2) GENERATED ALWAYS AS (purchase_amount - payment_amount - return_amount) STORED | 余额 |

#### 2.1.12 purchase_contract（采购合同表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 合同ID |
| contract_no | VARCHAR(32) NOT NULL | 合同编号 |
| supplier_id | BIGINT NOT NULL | 供应商ID |
| contract_name | VARCHAR(200) NOT NULL | 合同名称 |
| contract_type | VARCHAR(20) NOT NULL DEFAULT 'PURCHASE' | 类型：PURCHASE/FRAMEWORK |
| total_amount | DECIMAL(12,2) DEFAULT 0 | 合同总金额 |
| paid_amount | DECIMAL(12,2) DEFAULT 0 | 已付金额 |
| sign_date | DATE DEFAULT NULL | 签订日期 |
| start_date | DATE DEFAULT NULL | 开始日期 |
| end_date | DATE DEFAULT NULL | 结束日期 |
| status | VARCHAR(20) NOT NULL DEFAULT 'DRAFT' | 状态：DRAFT/SIGNED/EXECUTING/COMPLETED/TERMINATED |
| file_url | VARCHAR(500) DEFAULT NULL | 合同文件URL |
| remark | VARCHAR(500) DEFAULT NULL | 备注 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.13 purchase_plan（采购计划表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 计划ID |
| plan_no | VARCHAR(32) NOT NULL | 计划编号 |
| supplier_id | BIGINT NOT NULL | 供应商ID |
| store_id | BIGINT NOT NULL | 门店ID |
| plan_status | VARCHAR(20) NOT NULL DEFAULT 'DRAFT' | 状态：DRAFT/CONFIRMED/CONVERTED |
| goods_amount | DECIMAL(12,2) DEFAULT 0 | 计划采购金额 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 2.1.14 purchase_plan_item（采购计划明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 明细ID |
| plan_no | VARCHAR(32) NOT NULL | 计划编号 |
| sku_id | BIGINT NOT NULL | SKU ID |
| suggest_qty | INT NOT NULL DEFAULT 0 | 建议采购量 |
| current_stock | INT NOT NULL DEFAULT 0 | 当前库存 |
| safety_stock | INT NOT NULL DEFAULT 0 | 安全库存 |
| monthly_avg_sales | DECIMAL(10,2) DEFAULT 0 | 月均销量 |
| in_transit_qty | INT DEFAULT 0 | 在途采购量 |
| reason | VARCHAR(200) DEFAULT NULL | 补货原因 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |

### 2.2 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/suppliers | 供应商列表 |
| GET | /api/suppliers/:id | 供应商详情 |
| POST | /api/suppliers | 创建供应商 |
| PUT | /api/suppliers/:id | 更新供应商 |
| POST | /api/suppliers/:id/contacts | 添加联系人 |
| DELETE | /api/suppliers/:id/contacts/:contactId | 删除联系人 |
| GET | /api/suppliers/:id/purchase-orders | 供应商采购订单 |
| GET | /api/suppliers/:id/payments | 供应商付款记录 |
| GET | /api/suppliers/:id/products | 供应商供应商品 |
| GET | /api/suppliers/:id/stats | 供应商统计 |
| GET | /api/purchases | 采购订单列表 |
| GET | /api/purchases/:orderNo | 采购订单详情 |
| POST | /api/purchases | 创建采购订单 |
| PUT | /api/purchases/:orderNo | 更新采购订单 |
| DELETE | /api/purchases/:orderNo | 删除采购订单 |
| POST | /api/purchases/:orderNo/submit | 提交审核 |
| POST | /api/purchases/:orderNo/approve | 审核通过 |
| POST | /api/purchases/:orderNo/cancel | 取消订单 |
| POST | /api/purchases/:orderNo/in-stock | 执行入库 |
| GET | /api/purchase-in-stocks | 入库单列表 |
| GET | /api/purchase-in-stocks/:stockNo | 入库单详情 |
| POST | /api/purchase-in-stocks | 创建入库单 |
| POST | /api/purchase-in-stocks/:stockNo/approve | 审核入库单 |
| POST | /api/purchase-in-stocks/:stockNo/void | 作废入库单 |
| GET | /api/purchase-returns | 退货单列表 |
| GET | /api/purchase-returns/:returnNo | 退货单详情 |
| POST | /api/purchase-returns | 创建退货单 |
| POST | /api/purchase-returns/:returnNo/approve | 审核退货单 |
| POST | /api/purchase-returns/:returnNo/void | 作废退货单 |
| GET | /api/purchase-payments | 付款单列表 |
| GET | /api/purchase-payments/:paymentNo | 付款单详情 |
| POST | /api/purchase-payments | 创建付款单 |
| POST | /api/purchase-payments/:paymentNo/approve | 审核付款单 |
| POST | /api/purchase-payments/:paymentNo/void | 作废付款单 |
| POST | /api/supplier-statements/generate | 生成供应商对账单 |
| GET | /api/supplier-statements | 对账单列表 |
| GET | /api/supplier-statements/:statementNo | 对账单详情 |
| POST | /api/supplier-statements/:statementNo/confirm | 确认对账单 |
| POST | /api/supplier-statements/:statementNo/dispute | 争议对账单 |
| GET | /api/purchase-contracts | 采购合同列表 |
| POST | /api/purchase-contracts | 创建采购合同 |
| PUT | /api/purchase-contracts/:contractNo | 更新采购合同 |
| DELETE | /api/purchase-contracts/:contractNo | 删除采购合同 |
| POST | /api/purchase-contracts/:contractNo/upload | 上传合同文件 |
| GET | /api/purchase-plans/suggest | 采购建议 |
| POST | /api/purchase-plans | 创建采购计划 |
| GET | /api/purchase-plans | 采购计划列表 |
| POST | /api/purchase-plans/:planNo/convert | 转为采购订单 |

### 2.3 汇总统计

- 表数量：14
- 字段总数：约 230
- API数量：48

---

## 第四部分：库存管理

**定位**: 库存账、出入库、盘点、调拨、成本核算。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 库存查询 | 🔴 P0 | 实时库存查询 | ~35 | 保留 |
| 2. 出入库管理 | 🔴 P0 | 出入库单登记 | ~60 | 保留 |
| 3. 盘点 | 🔴 P0 | 盘点单、盈亏调整 | ~60 | 保留 |
| 4. 调拨 | 🔴 P0 | 门店间调拨 | ~50 | 多门店需要，保留 |
| 5. 库存预警 | 🔴 P0 | 低库存预警 | ~40 | 保留 |
| 6. 库存成本 | 🔴 P0 | 移动平均成本核算 | ~35 | 保留 |
| 7. 批次追溯与有效期 | 🟡 P1 | 批次管理、追溯码、保质期、临期预警 | ~70 | 追溯码+批次+保质期合并，白酒需要批次/追溯，啤酒饮料需要保质期 ✅ |
| 8. **批量价格调整** | 🔴 P0 | 批量选择商品调整批发价/零售价 | ~25 | 酒水行情每日变动，必须P0 ✅ |
| 9. **一键报价推送** | 🔴 P0 | 选商品调价格后一键推送报价给下属客户 | ~35 | 每日报价需求，站内信+微信推送 ✅ |
| 10. 损益处理 | 🟢 P2 | 报损报溢 | ~25 | 放P2 |
| 11. 库存报表 | 🟡 P1 | 库存周转率分析 | ~33 | 放P1 |
| **合计** | | | **538** | 适配后保留 ~405 字段 |

> **酒水适配**: 追溯码、批次、保质期合并为一个模块，放P1。白酒需要批次追溯码，啤酒饮料需要保质期，后期按需开启。
> **新增需求**: 酒水行情每日变动，新增**批量价格调整**和**一键报价推送**，解决每日报价痛点。

---

### 库存管理 · 新增模块详细设计

#### 8. 批量价格调整

> 优先级：🔴 P0 | 定位：酒水行情每日波动，批量选择商品快速调整价格

**核心场景**: 二批/经销每天根据上游行情变化，批量调整名下商品的批发价和零售价，一次性覆盖所有需要的商品。

**三级菜单**: 批量调价列表 / 新建批量调价 / 调价记录

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 新建批量调价 | 选择商品（多选/全选/按分类筛选）、当前价格、新价格、调价幅度（百分比/固定金额）、生效时间 | 支持按分类/品牌/供应商批量筛选商品 |
| 调价预览 | 商品列表、原价、新价、涨跌幅、影响客户数 | 提交前预览，确认无误后一键执行 |
| 调价记录 | 调价单号、操作人、调价时间、商品数量、调价前后对比 | 历史记录可追溯，支持撤销（限未推送的调价） |

**调价方式**:

| 方式 | 说明 |
|------|------|
| 固定金额调价 | 所有选中商品统一加/减 X 元 |
| 百分比调价 | 所有选中商品在当前价格基础上统一上浮/下调 X% |
| 逐商品调价 | 在表格中逐行输入每个商品的新价格 |
| 按参考价调价 | 基于成本价/上次进货价，按公式批量计算新售价 |

**价格层级**:
- 二批可以批量调整：给名下门店的批发价、小程序零售价
- 供应商可以批量调整：给名下二批的出厂供货价
- 门店可以批量调整：本店零售价

---

#### 9. 一键报价推送

> 优先级：🔴 P0 | 定位：调价完成后一键生成报价单，推送给名下客户

**核心场景**: 完成批量调价后，一键生成当日报价单，通过站内信+微信模板消息推送给名下所有客户，客户可实时查看最新报价。

**三级菜单**: 报价单管理 / 推送报价 / 报价查阅统计

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 报价单管理 | 报价单号、日期、商品数、推送状态、查阅人数/总人数 | 每日报价单列表，支持查看/编辑/重新推送 |
| 新建报价单 | 选择商品（从批量调价结果导入）、报价有效期（今日/本周/自定义）、备注（行情说明/促销信息） | 可追加文字说明，如"本周茅台到货，价格下调" |
| 推送报价 | 选择推送对象（全部客户/按客户等级/按标签/手动选择）、推送渠道（站内信+微信+短信） | 一键推送给名下所有客户 |

**推送渠道**:

| 渠道 | 说明 | 优先级 |
|------|------|:---:|
| 站内信 | 客户登录系统/小程序后，首页弹窗或消息中心显示最新报价 | 🔴 P0 |
| 微信模板消息 | 通过微信公众号/小程序推送报价更新通知，点击跳转报价详情 | 🔴 P0 |
| 短信通知 | 短信提醒客户查看最新报价（适合不常登录的客户） | 🟡 P1 |
| 报价海报 | 自动生成当日报价海报图片，可分享到微信群/朋友圈 | 🟡 P1 |

**客户查阅体验**:
- 客户收到推送后，点击直接查看当日完整报价单
- 报价单展示：商品名、规格、今日价格、涨跌（↑/↓ 箭头+颜色标识）、库存状态
- 客户可直接在报价单上点击"下单"，跳转至采购下单页面
- 报价单支持按分类筛选、按商品名搜索

**报价记录**:
- 推送记录：推送时间、推送渠道、推送人数、成功/失败数
- 查阅统计：哪些客户已查阅、哪些未查阅、查阅时间
- 一键催阅：对未查阅客户再次推送提醒

**安全控制**:
- 报价仅推送给交易关系内的客户（二批→名下门店，供应商→名下二批）
- 不同客户看到的报价单使用各自的价格层级（门店看到批发价，不会看到出厂价）
- 报价单有过期机制，过期后自动标记失效

### 库存管理 · 字段与表结构详解

### 3.1 数据表定义

#### 3.1.1 inventory_balance（库存余额表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 库存余额ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| stock_type | VARCHAR(32) NOT NULL DEFAULT 'OFFLINE' | 库存类型：ONLINE/OFFLINE |
| physical_qty | INT NOT NULL DEFAULT 0 | 物理库存 |
| locked_qty | INT NOT NULL DEFAULT 0 | 锁定库存 |
| available_qty | INT NOT NULL DEFAULT 0 | 可售库存 |
| version | BIGINT UNSIGNED NOT NULL DEFAULT 0 | 乐观锁版本 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 3.1.2 inventory_ledger（库存流水表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 库存流水ID |
| ledger_no | VARCHAR(64) NOT NULL UNIQUE | 库存流水号 |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| stock_type | VARCHAR(32) NOT NULL | 库存类型：ONLINE/OFFLINE |
| biz_type | VARCHAR(64) NOT NULL | 业务类型：ORDER_LOCK/ORDER_PAY/ORDER_CANCEL/SALE/ADJUST |
| biz_no | VARCHAR(64) NOT NULL | 关联业务单号 |
| change_qty | INT NOT NULL | 变动数量 |
| before_qty | INT NOT NULL | 变动前物理库存 |
| after_qty | INT NOT NULL | 变动后物理库存 |
| before_locked_qty | INT NOT NULL DEFAULT 0 | 变动前锁定库存 |
| after_locked_qty | INT NOT NULL DEFAULT 0 | 变动后锁定库存 |
| operator_id | BIGINT UNSIGNED DEFAULT NULL | 操作人 |
| idempotency_key | VARCHAR(128) NOT NULL UNIQUE | 幂等键 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 3.1.3 inventory_batch（库存批次表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 批次ID |
| store_id | INT NOT NULL | 门店ID |
| sku_id | INT NOT NULL | SKU ID |
| batch_no | VARCHAR(64) NOT NULL | 批次号 |
| quantity | INT NOT NULL DEFAULT 0 | 批次数量 |
| locked_quantity | INT NOT NULL DEFAULT 0 | 锁定数量 |
| production_date | DATE DEFAULT NULL | 生产日期 |
| expiry_date | DATE DEFAULT NULL | 过期日期 |
| cost_price | DECIMAL(10,2) DEFAULT NULL | 成本价 |
| supplier_id | INT DEFAULT NULL | 供应商ID |
| inbound_order_id | INT DEFAULT NULL | 入库单ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 3.1.4 stock_check（盘点单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 盘点单ID |
| check_no | VARCHAR(32) NOT NULL | 盘点编号 |
| store_id | BIGINT NOT NULL | 门店ID |
| check_status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/CHECKING/CHECKED/AUDITED |
| total_sku | INT DEFAULT 0 | 盘点SKU总数 |
| checked_sku | INT DEFAULT 0 | 已盘点SKU数 |
| profit_qty | INT DEFAULT 0 | 盘盈数量 |
| loss_qty | INT DEFAULT 0 | 盘亏数量 |
| operator_id | BIGINT DEFAULT NULL | 操作人ID |
| auditor_id | BIGINT DEFAULT NULL | 审核人ID |
| audited_at | DATETIME DEFAULT NULL | 审核时间 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 3.1.5 stock_check_item（盘点单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 明细ID |
| check_no | VARCHAR(32) NOT NULL | 盘点编号 |
| sku_id | BIGINT NOT NULL | SKU ID |
| book_qty | INT NOT NULL DEFAULT 0 | 账面数量 |
| actual_qty | INT DEFAULT NULL | 实际数量 |
| diff_qty | INT DEFAULT 0 | 差异数量 |
| diff_reason | VARCHAR(200) DEFAULT NULL | 差异原因 |
| cost_price | DECIMAL(12,2) DEFAULT 0 | 成本价 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |

#### 3.1.6 transfer_order（调拨单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 调拨单ID |
| transfer_no | VARCHAR(32) NOT NULL | 调拨编号 |
| from_store_id | BIGINT NOT NULL | 调出门店ID |
| to_store_id | BIGINT NOT NULL | 调入门店ID |
| transfer_status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SHIPPED/RECEIVED |
| goods_amount | DECIMAL(12,2) DEFAULT 0 | 调拨金额 |
| operator_id | BIGINT DEFAULT NULL | 操作人ID |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 3.1.7 transfer_order_item（调拨单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 明细ID |
| transfer_no | VARCHAR(32) NOT NULL | 调拨编号 |
| sku_id | BIGINT NOT NULL | SKU ID |
| box_qty | INT DEFAULT 0 | 箱数 |
| bottle_qty | INT DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL DEFAULT 0 | 总瓶数 |
| unit_price | DECIMAL(12,2) DEFAULT 0 | 单价 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |

#### 3.1.8 expiry_alert_config（效期预警配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 配置ID |
| alert_level | TINYINT NOT NULL | 预警级别(1/2/3) |
| level_name | VARCHAR(20) NOT NULL | 级别名称 |
| days_before_expiry | INT NOT NULL | 提前天数 |
| action | VARCHAR(20) NOT NULL | 动作：REMIND/RESTRICT/BLOCK |
| color | VARCHAR(20) NOT NULL | 颜色值 |
| enabled | TINYINT(1) NOT NULL DEFAULT 1 | 是否启用 |
| description | VARCHAR(255) DEFAULT '' | 描述 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 3.1.9 expiry_alert_record（效期预警记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 记录ID |
| batch_id | INT NOT NULL | 批次ID |
| store_id | INT NOT NULL | 门店ID |
| sku_id | INT NOT NULL | SKU ID |
| sku_name | VARCHAR(128) DEFAULT '' | 商品名称 |
| batch_no | VARCHAR(64) DEFAULT '' | 批次号 |
| production_date | DATE DEFAULT NULL | 生产日期 |
| expiry_date | DATE DEFAULT NULL | 过期日期 |
| days_remaining | INT NOT NULL | 剩余天数 |
| alert_level | TINYINT NOT NULL | 预警级别 |
| action_taken | VARCHAR(20) NOT NULL | 执行动作：REMIND/RESTRICT/BLOCK |
| status | ENUM('PENDING','HANDLED','EXPIRED') NOT NULL DEFAULT 'PENDING' | 状态 |
| handled_by | INT DEFAULT NULL | 处理人ID |
| handled_at | DATETIME DEFAULT NULL | 处理时间 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 3.1.10 stock_warning_config（库存预警配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 配置ID |
| store_id | BIGINT NOT NULL | 门店ID |
| sku_id | BIGINT NOT NULL | SKU ID |
| min_qty | INT NOT NULL DEFAULT 0 | 最低库存阈值 |
| max_qty | INT NOT NULL DEFAULT 0 | 最高库存阈值 |
| enabled | TINYINT DEFAULT 1 | 是否启用 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 3.1.11 store_control_config（门店管控配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 配置ID |
| store_id | INT NOT NULL UNIQUE | 门店ID |
| auto_open_time | TIME DEFAULT NULL | 自动开门时间 |
| auto_close_time | TIME DEFAULT NULL | 自动关门时间 |
| max_daily_orders | INT DEFAULT NULL | 每日最大订单数 |
| max_order_amount | DECIMAL(10,2) DEFAULT NULL | 每日最大订单金额 |
| suspended_reason | TEXT DEFAULT NULL | 暂停原因 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 3.1.12 store_status_log（门店状态变更记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 记录ID |
| store_id | INT NOT NULL | 门店ID |
| from_status | VARCHAR(20) NOT NULL | 变更前状态 |
| to_status | VARCHAR(20) NOT NULL | 变更后状态 |
| change_type | ENUM('MANUAL','SCHEDULED','AUTO') NOT NULL | 变更类型 |
| operator_id | INT DEFAULT NULL | 操作人ID |
| remark | VARCHAR(255) DEFAULT '' | 备注 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 3.2 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/inventory-batches/batches | 批次列表 |
| GET | /api/inventory-batches/batches/fifo-suggestion/:storeId/:skuId | FIFO出库建议 |
| GET | /api/inventory-batches/batches/:id | 批次详情 |
| POST | /api/inventory-batches/batches | 创建批次 |
| PUT | /api/inventory-batches/batches/:id | 更新批次 |
| POST | /api/inventory-batches/batches/:id/split | 拆分批 |
| GET | /api/inventory-batches/batches/:id/trace | 批次追溯 |
| GET | /api/inventory-batches/products/:spuId/batches | 商品批次 |
| GET | /api/inventory-batches/expiry-configs | 效期预警配置列表 |
| POST | /api/inventory-batches/expiry-configs | 创建效期预警配置 |
| PUT | /api/inventory-batches/expiry-configs/:id | 更新效期预警配置 |
| DELETE | /api/inventory-batches/expiry-configs/:id | 删除效期预警配置 |
| GET | /api/inventory-batches/expiry-alerts | 效期预警记录列表 |
| GET | /api/inventory-batches/expiry-alerts/statistics | 效期预警统计 |
| PUT | /api/inventory-batches/expiry-alerts/:id/handle | 处理效期预警 |
| POST | /api/admin-stock-checks | 创建盘点单 |
| GET | /api/admin-stock-checks | 盘点单列表 |
| GET | /api/admin-stock-checks/:id | 盘点单详情 |
| PUT | /api/admin-stock-checks/:id | 更新盘点单 |
| POST | /api/admin-stock-checks/:id/start | 开始盘点 |
| POST | /api/admin-stock-checks/:id/complete | 完成盘点 |
| POST | /api/admin-stock-checks/:id/cancel | 取消盘点 |
| POST | /api/admin-stock-checks/:id/handle-diff | 处理差异 |
| GET | /api/admin-stock-checks/statistics | 盘点统计 |
| GET | /api/store-stock-checks/my | 门店盘点列表 |
| GET | /api/store-stock-checks/:id | 门店盘点详情 |
| PUT | /api/store-stock-checks/:id/items/:itemId | 更新盘点明细 |
| POST | /api/store-stock-checks/:id/submit | 提交盘点 |
| GET | /api/stock-warnings | 库存预警列表 |
| POST | /api/stock-warnings/config | 批量配置预警 |
| GET | /api/stock-warnings/configs | 预警配置列表 |
| POST | /api/admin-transfers | 创建调拨单 |
| GET | /api/admin-transfers | 调拨单列表 |
| GET | /api/admin-transfers/:id | 调拨单详情 |
| PUT | /api/admin-transfers/:id | 更新调拨单 |
| POST | /api/admin-transfers/:id/submit | 提交调拨单 |
| POST | /api/admin-transfers/:id/approve | 审核调拨单 |
| POST | /api/admin-transfers/:id/reject | 驳回调拨单 |
| POST | /api/admin-transfers/:id/cancel | 取消调拨单 |
| POST | /api/admin-transfers/:id/ship | 发货 |
| POST | /api/store-transfers/:id/receive | 收货 |
| GET | /api/store-transfers/in-transit | 在途调拨单 |
| GET | /api/store-transfers/my-shipments | 我的发货 |
| GET | /api/inventory-cost/cost-detail | 库存成本明细 |
| GET | /api/inventory-cost/cost-trend | 库存成本趋势 |
| POST | /api/inventory-loss-gains/report-loss-gain | 报损/报溢 |
| GET | /api/inventory-loss-gains/loss-gains | 报损报溢列表 |
| GET | /api/admin/inventory-balance | 库存余额列表 |
| GET | /api/admin/inventory-logs | 库存流水列表 |
| GET | /api/admin/inventory-alerts | 库存预警 |
| GET | /api/store/inventory | 门店库存 |
| POST | /api/store/inventory/adjust | 调整库存 |
| GET | /api/store/inventory/logs | 门店库存流水 |
| GET | /api/store/inventory/alerts | 门店库存预警 |

### 3.3 汇总统计

- 表数量：12
- 字段总数：约 170
- API数量：55

---

 ## 第五部分：销售管理

**定位**: 卖给谁、卖什么、多少钱、收款状态，核心是分享收款闭环。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 销售开单 | 🔴 P0 | 销售开单表单 | ~100 | 保留，我们已经实现 |
| 2. 销售订单生命周期 | 🔴 P0 | 状态机、操作日志 | ~50 | 增加 SHARED（已分享待支付）、OVERDUE（逾期）状态 ✅ |
| 3. 单据分享与在线收款 | 🔴⭐⭐ P0 | **核心差异化**：分享链接 → 微信支付 → 状态同步 | ~75 | 我们完全缺失，必须优先做 ✅ |
| 4. 客户档案（B+C统一） | 🔴 P0 | B端客户+C端会员统一档案 | ~85 | 整合到客户管理，这里保留关联引用 |
| 5. 价格策略与折扣 | 🟡 P1 | 客户专属价格、整单折扣 | ~50 | 放P1 |
| 6. 信用与赊销额度（B端） | 🟡 P1 | 授信管理、逾期管控 | ~35 | B端客户需要，放P1 |
| 7. 出库与退货履约 | 🔴 P0 | 销售出库、销售退货 | ~40 | 保留 |
| 8. POS 与现场辅助 | 🟡 P1 | 收银台、挂单 | ~30 | 我们已有门店终端，这里放P1 |
| 9. 销售人员与提成 | 🟡 P1 | 提成规则、提成计算 | ~40 | 酒水需要业务员提成，放P1 |
| 10. 销售报表 | 🟡 P1 | 销售汇总、排名分析 | ~32 | 保留 |
| **合计** | | | **587** | 适配后保留 ~587 字段（核心模块不删减） |

> **核心差异化**: 单据分享与在线收款闭环 ⭐⭐
> - 销售开单后生成带 UUID 的分享链接
> - 客户微信打开即可支付，支付完成自动回写状态
> 解决了"业务员跑单、客户欠款、对账难"痛点，酒水批发必备

### 销售管理 · 字段与表结构详解

### 1.1 数据表定义

#### 1.1.1 sale_bill（线下销售单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 销售单ID |
| bill_no | VARCHAR(64) NOT NULL UNIQUE | 销售单号 |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称快照 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号快照 |
| customer_type | VARCHAR(32) NOT NULL DEFAULT 'RETAIL' | 客户身份快照 |
| sale_type | VARCHAR(32) NOT NULL DEFAULT 'CASH' | 销售类型：CASH(现销)/CREDIT(赊销) |
| business_status | VARCHAR(32) NOT NULL DEFAULT 'CREATED' | 业务状态：DRAFT/CREATED/COMPLETED/VOIDED/RETURNED |
| collection_status | VARCHAR(32) NOT NULL DEFAULT 'UNPAID' | 收款状态：UNPAID/PENDING/SHARED/PARTIAL/PAID/OVERDUE/CLOSED |
| due_date | DATE DEFAULT NULL | 应收截止日期（赊销时） |
| statement_id | BIGINT UNSIGNED DEFAULT NULL | 关联对账单ID |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| discount_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 优惠金额 |
| rounding_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 抹零金额 |
| receivable_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应收金额 |
| received_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已收金额 |
| unreceived_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 未收金额 |
| share_collection_count | INT NOT NULL DEFAULT 0 | 分享收款次数 |
| last_share_time | DATETIME DEFAULT NULL | 最近分享时间 |
| last_payment_time | DATETIME DEFAULT NULL | 最近收款时间 |
| locked_amount_flag | TINYINT NOT NULL DEFAULT 0 | 金额是否锁定 |
| operator_id | BIGINT UNSIGNED NOT NULL | 开单人 |
| remark | VARCHAR(255) DEFAULT NULL | 客户可见备注 |
| internal_remark | VARCHAR(255) DEFAULT NULL | 内部备注 |
| void_reason | VARCHAR(255) DEFAULT NULL | 作废原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.2 sale_bill_item（线下销售单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| bill_no | VARCHAR(64) NOT NULL | 销售单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 成交单价，按瓶 |
| price_type | VARCHAR(32) NOT NULL | 价格类型：RETAIL/WHOLESALE/STORE |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计 |
| trace_required | TINYINT NOT NULL DEFAULT 0 | 是否需要追溯 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 1.1.3 sale_return（销售退货单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 销售退货单ID |
| return_no | VARCHAR(64) NOT NULL UNIQUE | 退货单号 |
| source_bill_no | VARCHAR(64) DEFAULT NULL | 关联销售单号 |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称快照 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号快照 |
| return_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/COMPLETED/VOIDED |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| discount_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 优惠金额 |
| refund_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应退金额 |
| refunded_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已退金额 |
| refund_method | VARCHAR(32) DEFAULT NULL | 退款方式：CASH/WECHAT/BANK |
| operator_id | BIGINT UNSIGNED NOT NULL | 退货人 |
| auditor_id | BIGINT UNSIGNED DEFAULT NULL | 审核人 |
| audited_at | DATETIME DEFAULT NULL | 审核时间 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.4 sale_return_item（销售退货单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| return_no | VARCHAR(64) NOT NULL | 退货单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 退货单价（瓶） |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计 |
| reason | VARCHAR(255) DEFAULT NULL | 退货原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 1.1.5 sale_payment（销售收款单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 销售收款单ID |
| receipt_no | VARCHAR(64) NOT NULL UNIQUE | 收款单号 |
| source_type | VARCHAR(32) NOT NULL | 来源类型：SALE_BILL/SALE_RETURN/STATEMENT |
| source_no | VARCHAR(64) NOT NULL | 来源单号 |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称快照 |
| amount | DECIMAL(12,2) NOT NULL | 收款金额 |
| payment_method | VARCHAR(32) NOT NULL DEFAULT 'CASH' | 收款方式：CASH/WECHAT/ALIPAY/BANK/COLLECTION |
| voucher_no | VARCHAR(64) DEFAULT NULL | 凭证号 |
| payment_date | DATE NOT NULL | 收款日期 |
| operator_id | BIGINT UNSIGNED NOT NULL | 收款人 |
| status | VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' | 状态：COMPLETED/VOIDED |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.6 collection_link（分享收款链接表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 分享收款ID |
| link_no | VARCHAR(64) NOT NULL UNIQUE | 分享收款单号 |
| source_type | VARCHAR(32) NOT NULL | 来源类型：SALE_BILL/MINIAPP_ORDER/STATEMENT |
| source_no | VARCHAR(64) NOT NULL | 来源单号 |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| amount | DECIMAL(12,2) NOT NULL | 本次收款金额 |
| tax_enabled | TINYINT NOT NULL DEFAULT 0 | 是否展示税率 |
| tax_rate | DECIMAL(8,4) NOT NULL DEFAULT 0.0000 | 税率 |
| tax_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 税额 |
| paid_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已支付金额 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/PARTIAL/PAID/EXPIRED/CLOSED |
| share_channel | VARCHAR(32) NOT NULL | 分享方式：MINIAPP_CARD/LINK/IMAGE/QR_CODE |
| share_user_id | BIGINT UNSIGNED NOT NULL | 分享人 |
| share_time | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 分享时间 |
| expire_at | DATETIME NOT NULL | 过期时间 |
| view_count | INT NOT NULL DEFAULT 0 | 查看次数 |
| last_view_time | DATETIME DEFAULT NULL | 最近查看时间 |
| pay_no | VARCHAR(64) DEFAULT NULL | 关联支付单号 |
| token | VARCHAR(128) NOT NULL UNIQUE | 访问令牌 |
| closed_reason | VARCHAR(255) DEFAULT NULL | 关闭原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.7 collection_view_log（分享收款访问日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| link_no | VARCHAR(64) NOT NULL | 分享收款单号 |
| ip | VARCHAR(64) DEFAULT NULL | 访问IP |
| user_agent | VARCHAR(512) DEFAULT NULL | 用户代理 |
| viewed_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 访问时间 |

#### 1.1.8 price_level（价格等级表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 等级ID |
| level_code | VARCHAR(32) NOT NULL UNIQUE | 等级编码 |
| level_name | VARCHAR(64) NOT NULL | 等级名称 |
| discount_rate | DECIMAL(5,4) DEFAULT 1.0000 | 折扣率 |
| min_order_amount | DECIMAL(12,2) DEFAULT 0 | 最低订单金额门槛 |
| description | VARCHAR(255) DEFAULT '' | 等级说明 |
| sort_order | INT DEFAULT 0 | 排序 |
| status | TINYINT DEFAULT 1 | 状态 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.9 sku_price（阶梯价格表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 价格ID |
| sku_id | INT NOT NULL | SKU ID |
| price_level_id | INT NOT NULL | 价格等级ID |
| min_qty | INT DEFAULT 1 | 起订量 |
| price | DECIMAL(12,2) NOT NULL | 单价 |
| cost_price | DECIMAL(12,2) DEFAULT 0 | 成本价 |
| suggested_retail_price | DECIMAL(12,2) DEFAULT 0 | 建议零售价 |
| effective_start | DATE DEFAULT NULL | 生效开始日期 |
| effective_end | DATE DEFAULT NULL | 生效结束日期 |
| status | TINYINT DEFAULT 1 | 状态 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.10 customer_price_binding（客户价格等级绑定表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 绑定ID |
| customer_id | INT NOT NULL UNIQUE | 客户ID |
| price_level_id | INT NOT NULL | 价格等级ID |
| apply_reason | VARCHAR(255) DEFAULT '' | 申请原因 |
| status | ENUM('PENDING','APPROVED','REJECTED','EXPIRED') DEFAULT 'PENDING' | 状态 |
| approved_by | INT DEFAULT NULL | 审批人 |
| approved_at | DATETIME DEFAULT NULL | 审批时间 |
| expire_at | DATETIME DEFAULT NULL | 到期时间 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.11 customer_price（客户专属价格表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 价格ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| sku_id | BIGINT NOT NULL | SKU ID |
| custom_price | DECIMAL(12,2) NOT NULL | 客户专属价格 |
| effective_start | DATE DEFAULT NULL | 生效开始日期 |
| effective_end | DATE DEFAULT NULL | 生效结束日期 |
| status | TINYINT DEFAULT 1 | 状态 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.12 customer_credit（客户授信额度表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 授信ID |
| customer_id | INT NOT NULL UNIQUE | 客户ID |
| credit_limit | DECIMAL(12,2) NOT NULL DEFAULT 0 | 授信总额度 |
| credit_used | DECIMAL(12,2) NOT NULL DEFAULT 0 | 已用额度 |
| credit_frozen | DECIMAL(12,2) NOT NULL DEFAULT 0 | 冻结额度 |
| credit_available | DECIMAL(12,2) GENERATED ALWAYS AS (credit_limit - credit_used - credit_frozen) STORED | 可用额度 |
| payment_term | ENUM('COD','NET_7','NET_15','NET_30','NET_60','NET_90') DEFAULT 'COD' | 账期 |
| late_fee_rate | DECIMAL(6,4) DEFAULT 0.0005 | 日滞纳金费率 |
| max_late_fee_rate | DECIMAL(6,4) DEFAULT 0.3 | 最高滞纳金比例 |
| warning_threshold | DECIMAL(5,2) DEFAULT 0.80 | 预警阈值 |
| overdue_freeze_days | INT DEFAULT 15 | 逾期自动冻结天数 |
| status | ENUM('ACTIVE','FROZEN','CLOSED') DEFAULT 'ACTIVE' | 状态 |
| freeze_reason | VARCHAR(255) DEFAULT NULL | 冻结原因 |
| frozen_at | DATETIME DEFAULT NULL | 冻结时间 |
| unfrozen_at | DATETIME DEFAULT NULL | 解冻时间 |
| version | INT DEFAULT 1 | 乐观锁版本号 |
| tenant_id | VARCHAR(36) NOT NULL DEFAULT 'default' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.13 credit_operation_log（授信操作日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 日志ID |
| customer_id | INT NOT NULL | 客户ID |
| operation_type | ENUM('ADJUST_LIMIT','OCCUPY','RELEASE','FREEZE','UNFREEZE','OVERDUE_DEDUCT','MANUAL_ADJUST') NOT NULL | 操作类型 |
| amount | DECIMAL(12,2) NOT NULL | 变动金额 |
| balance_before | DECIMAL(12,2) NOT NULL | 操作前可用额度 |
| balance_after | DECIMAL(12,2) NOT NULL | 操作后可用额度 |
| related_order_no | VARCHAR(64) DEFAULT NULL | 关联订单号 |
| operator_id | INT NOT NULL | 操作人 |
| remark | VARCHAR(255) DEFAULT '' | 备注 |
| tenant_id | VARCHAR(36) NOT NULL DEFAULT 'default' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 1.1.14 collection_record（催收记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 催收记录ID |
| customer_id | INT NOT NULL | 客户ID |
| receivable_no | VARCHAR(64) DEFAULT NULL | 关联应收单号 |
| overdue_days | INT DEFAULT 0 | 逾期天数 |
| overdue_amount | DECIMAL(12,2) DEFAULT 0 | 逾期金额 |
| collection_level | ENUM('REMIND','LIGHT','MEDIUM','HEAVY','SEVERE') NOT NULL | 催收等级 |
| collection_method | ENUM('SMS','PHONE','VISIT','LETTER','LEGAL') NOT NULL | 催收方式 |
| collection_content | TEXT | 催收内容 |
| contact_person | VARCHAR(64) DEFAULT '' | 联系人 |
| contact_result | ENUM('PROMISED','REFUSED','NO_ANSWER','PARTIAL_PAID','DISPUTED') DEFAULT NULL | 催收结果 |
| promised_amount | DECIMAL(12,2) DEFAULT NULL | 承诺还款金额 |
| promised_date | DATE DEFAULT NULL | 承诺还款日期 |
| next_follow_up_date | DATE DEFAULT NULL | 下次跟进日期 |
| operator_id | INT NOT NULL | 操作人 |
| tenant_id | VARCHAR(36) NOT NULL DEFAULT 'default' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 1.1.15 sales_commission_rule（销售提成规则表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 规则ID |
| rule_name | VARCHAR(100) NOT NULL | 规则名称 |
| rule_type | VARCHAR(20) NOT NULL | 规则类型：FIXED_AMOUNT/FIXED_RATE/TIERED |
| config | JSON NOT NULL | 规则配置JSON |
| effective_start | DATE DEFAULT NULL | 生效开始日期 |
| effective_end | DATE DEFAULT NULL | 生效结束日期 |
| status | TINYINT DEFAULT 1 | 状态 |
| remark | VARCHAR(500) DEFAULT NULL | 备注 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 1.1.16 sales_commission_record（销售提成记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 记录ID |
| record_no | VARCHAR(32) NOT NULL | 记录编号 |
| bill_no | VARCHAR(32) NOT NULL | 销售单号 |
| staff_id | BIGINT NOT NULL | 员工ID |
| rule_id | BIGINT NOT NULL | 提成规则ID |
| commission_amount | DECIMAL(12,2) NOT NULL | 提成金额 |
| base_amount | DECIMAL(12,2) NOT NULL | 计算基数 |
| rate | DECIMAL(6,4) DEFAULT NULL | 提成比例 |
| status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SETTLED/CANCELLED |
| settled_at | DATETIME DEFAULT NULL | 结算时间 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 1.1.17 price_change_log（价格变更历史表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 日志ID |
| sku_id | INT NOT NULL | SKU ID |
| price_level_id | INT NOT NULL | 价格等级ID |
| old_price | DECIMAL(12,2) | 原价格 |
| new_price | DECIMAL(12,2) | 新价格 |
| change_reason | VARCHAR(255) DEFAULT '' | 变更原因 |
| changed_by | INT NOT NULL | 变更人 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 1.2 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/sale-bills | 销售单列表 |
| GET | /api/admin/sale-bills/export-csv | 导出销售单CSV |
| POST | /api/admin/sale-bills/batch-collection-link | 批量创建收款链接 |
| POST | /api/admin/collection-links/:linkNo/revoke | 撤销收款链接 |
| GET | /api/admin/collection-links | 收款链接列表 |
| GET | /api/admin/collection-links/stats | 收款链接统计 |
| GET | /api/share/collections/:token | 分享收款详情 |
| GET | /api/share/collections/:token/page | H5支付页面数据 |
| POST | /api/share/collections/:token/pay | 发起支付 |
| POST | /api/share/collections/:token/wx-notify | 微信支付回调 |
| GET | /api/sale-returns | 销售退货单列表 |
| GET | /api/sale-returns/:returnNo | 退货单详情 |
| POST | /api/sale-returns | 创建退货单 |
| POST | /api/sale-returns/:returnNo/approve | 审核退货单 |
| POST | /api/sale-returns/:returnNo/refund | 执行退款 |
| GET | /api/sale-returns/sale-bills/:billNo | 查询关联销售单 |
| GET | /api/commission/rules | 提成规则列表 |
| POST | /api/commission/rules | 创建提成规则 |
| PUT | /api/commission/rules/:id | 更新提成规则 |
| DELETE | /api/commission/rules/:id | 删除提成规则 |
| POST | /api/commission/calculate | 计算提成 |
| POST | /api/commission/settle | 结算提成 |
| GET | /api/commission/records | 提成记录列表 |
| GET | /api/price/levels | 价格等级列表 |
| POST | /api/price/levels | 创建价格等级 |
| PUT | /api/price/levels/:id | 更新价格等级 |
| DELETE | /api/price/levels/:id | 禁用价格等级 |
| GET | /api/price/skus/:skuId/prices | 阶梯价格列表 |
| POST | /api/price/skus/:skuId/prices | 设置阶梯价格 |
| PUT | /api/price/prices/:id | 更新价格 |
| DELETE | /api/price/prices/:id | 删除价格 |
| POST | /api/price/best-price | 最优价查询 |
| GET | /api/price/customer-bindings | 客户价格绑定列表 |
| POST | /api/price/customer-bindings | 创建客户价格绑定 |
| PUT | /api/price/customer-bindings/:id/approve | 审批绑定 |
| PUT | /api/price/customer-bindings/:id/reject | 拒绝绑定 |
| DELETE | /api/price/customer-bindings/:id | 取消绑定 |
| GET | /api/price/change-logs | 价格变更日志 |
| POST | /api/price/batch/preview | 批量调价预览 |
| POST | /api/price/batch/execute | 批量调价执行 |
| GET | /api/price/batch/logs | 批量调价日志 |
| GET | /api/price/batch/:batchNo | 批量调价详情 |
| GET | /api/credit/credits | 授信列表 |
| GET | /api/credit/credits/:customerId | 授信详情 |
| POST | /api/credit/credits/:customerId | 初始化授信 |
| GET | /api/credit/credits/:customerId/check | 检查授信 |
| POST | /api/credit/credits/:customerId/occupy | 占用额度 |
| POST | /api/credit/credits/:customerId/release | 释放额度 |
| POST | /api/credit/credits/:customerId/freeze | 冻结额度 |
| POST | /api/credit/credits/:customerId/unfreeze | 解冻额度 |
| PUT | /api/credit/credits/:customerId/limit | 调整额度 |
| PUT | /api/credit/credits/:customerId/term | 调整账期 |
| POST | /api/credit/credits/:customerId/evaluate | 信用评估 |
| GET | /api/credit/credits/:customerId/intercept | 风控拦截检查 |
| POST | /api/credit/credits/:customerId/auto-init | 自动初始化授信 |
| GET | /api/credit/credits/strategy/collection | 催收策略配置 |
| GET | /api/credit/credits/strategy/tiers | 信用等级体系 |
| GET | /api/credit/collections | 催收记录列表 |
| POST | /api/credit/collections | 创建催收记录 |
| PUT | /api/credit/collections/:id | 更新催收记录 |
| GET | /api/credit/collections/overdue | 逾期客户列表 |
| POST | /api/credit/collections/auto-generate | 自动生成催收 |
| POST | /api/credit/collections/batch-remind | 批量催收提醒 |
| GET | /api/credit/collections/statistics | 催收统计 |
| GET | /api/credit/risk-customers | 风险客户列表 |
| GET | /api/credit/risk-list | 风险客户列表 |
| GET | /api/customer-prices | 客户专属价格列表 |
| POST | /api/customer-prices | 创建客户专属价格 |
| PUT | /api/customer-prices/:id | 更新客户专属价格 |
| DELETE | /api/customer-prices/:id | 删除客户专属价格 |
| GET | /api/store/sale-bills | 门店销售单列表 |
| POST | /api/store/sale-bills | 创建销售单 |
| GET | /api/store/sale-bills/overdue | 逾期销售单 |
| GET | /api/store/sale-bills/overdue/check | 检查逾期 |
| GET | /api/store/sale-bills/:billNo | 销售单详情 |
| POST | /api/store/sale-bills/:billNo/collection-link | 创建收款链接 |
| POST | /api/store/sale-bills/:billNo/offline-payment | 线下收款 |
| POST | /api/store/sale-bills/:billNo/payment | 销售单收款 |

### 1.3 汇总统计

- 表数量：17
- 字段总数：约 280
- API数量：73

---

## 第六部分：订单管理（整合原全渠道订单中心）

**定位**: 小程序门店、抖音小店、美团饿了么，订单统一承接分发。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 全渠道订单聚合 | 🔴 P0 | 多平台订单统一入库 | ~55 | 保留，如果只做批发可以延后，但我们规划了即时零售 ✅ |
| 2. 订单分发与路由 | 🔴 P0 | 哪个门店接单、哪个仓库发货 | ~60 | 保留 |
| 3. 订单合并与拆分 | 🟡 P1 | 多单合并、一单多仓拆分 | ~35 | 不需要放P1 |
| 4. 订单状态同步 | 🔴 P0 | 平台状态 ↔ 系统状态双向同步 | ~45 | 保留 |
| 5. 订单异常处理 | 🔴 P0 | 缺货、取消、退款统一处理 | ~50 | 保留 |
| 6. 订单售后聚合 | 🟡 P1 | 全渠道售后统一处理 | ~40 | 放P1 |
| 7. 订单报表 | 🟡 P1 | 订单趋势、渠道占比 | ~26 | 放P1 |
| 8. 全渠道商品映射 | 🔴 P0 | 平台商品编码 ↔ 系统商品 | ~50 | 保留 |
| **合计** | | | **361** | 适配后保留 ~260 字段（删减非必须） |

### 订单管理 · 字段与表结构详解

#### 数据表定义

##### 1. miniapp_order（全渠道订单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 订单ID |
| order_no | VARCHAR(64) NOT NULL UNIQUE | 订单号 |
| platform | VARCHAR(32) NOT NULL | 订单来源：MINIAPP/MEITUAN/ELEME/JD/DOUYIN/OFFLINE |
| platform_order_no | VARCHAR(128) DEFAULT NULL | 平台订单号 |
| store_id | BIGINT UNSIGNED NOT NULL | 接单门店ID |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID（B端批发客户） |
| consumer_id | BIGINT UNSIGNED DEFAULT NULL | 消费者ID（C端零售客户） |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称快照 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号 |
| customer_type | VARCHAR(32) DEFAULT 'RETAIL' | 客户类型：RETAIL/WHOLESALE |
| order_type | VARCHAR(32) NOT NULL DEFAULT 'NORMAL' | 订单类型：NORMAL/MERGE/SPLIT |
| parent_order_no | VARCHAR(64) DEFAULT NULL | 父订单号（合并/拆分时） |
| order_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 订单状态：PENDING/ACCEPTED/PROCESSING/SHIPPED/COMPLETED/CANCELLED/REFUNDED |
| accept_deadline | DATETIME DEFAULT NULL | 接单截止时间（60秒倒计时） |
| accepted_at | DATETIME DEFAULT NULL | 接单时间 |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| freight_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 运费 |
| discount_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 优惠金额 |
| payable_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应付金额 |
| paid_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已付金额 |
| payment_method | VARCHAR(32) DEFAULT NULL | 支付方式：WECHAT/ALIPAY/BALANCE/COD |
| paid_at | DATETIME DEFAULT NULL | 支付时间 |
| delivery_type | VARCHAR(32) DEFAULT NULL | 配送方式：SELF_PICKUP/DELIVERY/EXPRESS |
| delivery_address | JSON DEFAULT NULL | 收货地址 |
| delivery_time | DATETIME DEFAULT NULL | 期望送达时间 |
| receiver_name | VARCHAR(64) DEFAULT NULL | 收货人 |
| receiver_mobile | VARCHAR(20) DEFAULT NULL | 收货人手机 |
| tracking_no | VARCHAR(64) DEFAULT NULL | 物流单号 |
| shipped_at | DATETIME DEFAULT NULL | 发货时间 |
| completed_at | DATETIME DEFAULT NULL | 完成时间 |
| cancel_reason | VARCHAR(255) DEFAULT NULL | 取消原因 |
| cancel_type | VARCHAR(32) DEFAULT NULL | 取消类型：USER/SYSTEM/ADMIN |
| remark | VARCHAR(255) DEFAULT NULL | 客户备注 |
| internal_remark | VARCHAR(255) DEFAULT NULL | 内部备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 2. miniapp_order_item（订单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| order_no | VARCHAR(64) NOT NULL | 订单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(255) NOT NULL | SKU名称快照 |
| sku_image | VARCHAR(512) DEFAULT NULL | SKU图片快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 成交单价 |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计 |
| platform_sku_code | VARCHAR(128) DEFAULT NULL | 平台SKU编码 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 3. payment_order（支付单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 支付单ID |
| pay_no | VARCHAR(64) NOT NULL UNIQUE | 支付单号 |
| order_no | VARCHAR(64) NOT NULL | 关联订单号 |
| amount | DECIMAL(12,2) NOT NULL | 支付金额 |
| payment_method | VARCHAR(32) NOT NULL | 支付方式：WECHAT/ALIPAY/BALANCE |
| transaction_id | VARCHAR(128) DEFAULT NULL | 第三方交易号 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SUCCESS/FAILED/CLOSED |
| paid_at | DATETIME DEFAULT NULL | 支付成功时间 |
| fail_reason | VARCHAR(255) DEFAULT NULL | 失败原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 4. refund_order（退款单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 退款单ID |
| refund_no | VARCHAR(64) NOT NULL UNIQUE | 退款单号 |
| order_no | VARCHAR(64) NOT NULL | 关联订单号 |
| pay_no | VARCHAR(64) DEFAULT NULL | 关联支付单号 |
| amount | DECIMAL(12,2) NOT NULL | 退款金额 |
| reason | VARCHAR(255) NOT NULL | 退款原因 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SUCCESS/FAILED |
| refund_type | VARCHAR(32) NOT NULL | 退款类型：FULL/PARTIAL |
| operator_id | BIGINT UNSIGNED DEFAULT NULL | 操作人 |
| refunded_at | DATETIME DEFAULT NULL | 退款时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 5. sale_return（销售退货单表）— 与销售管理共用

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 退货单ID |
| return_no | VARCHAR(64) NOT NULL UNIQUE | 退货单号 |
| source_bill_no | VARCHAR(64) DEFAULT NULL | 关联销售单号 |
| order_no | VARCHAR(64) DEFAULT NULL | 关联订单号（线上下单售后） |
| return_type | VARCHAR(32) NOT NULL DEFAULT 'SALE' | 退货类型：SALE(销售退货)/ORDER(订单售后) |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称快照 |
| return_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/COMPLETED/VOIDED |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| refund_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应退金额 |
| refunded_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已退金额 |
| refund_method | VARCHAR(32) DEFAULT NULL | 退款方式 |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| after_sale_type | VARCHAR(32) DEFAULT NULL | 售后类型：REFUND_ONLY/RETURN_REFUND/EXCHANGE |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 6. sale_return_item（退货明细表）— 与销售管理共用

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| return_no | VARCHAR(64) NOT NULL | 退货单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 退货单价 |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计 |
| reason | VARCHAR(255) DEFAULT NULL | 退货原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 7. miniapp_order_sync_log（订单同步日志表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| order_no | VARCHAR(64) NOT NULL | 订单号 |
| platform | VARCHAR(32) NOT NULL | 平台 |
| sync_type | VARCHAR(32) NOT NULL | 同步类型：STATUS/SKU/PRICE/STOCK |
| sync_direction | VARCHAR(32) NOT NULL | 方向：PUSH_TO_PLATFORM/PULL_FROM_PLATFORM |
| request_data | JSON DEFAULT NULL | 请求数据 |
| response_data | JSON DEFAULT NULL | 响应数据 |
| status | VARCHAR(32) NOT NULL | 状态：SUCCESS/FAILED |
| error_msg | VARCHAR(512) DEFAULT NULL | 错误信息 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 8. platform_reconciliation（平台对账表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 对账ID |
| platform | VARCHAR(32) NOT NULL | 平台 |
| reconciliation_date | DATE NOT NULL | 对账日期 |
| platform_order_count | INT NOT NULL DEFAULT 0 | 平台订单数 |
| platform_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 平台金额 |
| system_order_count | INT NOT NULL DEFAULT 0 | 系统订单数 |
| system_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 系统金额 |
| diff_count | INT NOT NULL DEFAULT 0 | 差异单数 |
| diff_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 差异金额 |
| commission_amount | DECIMAL(12,2) DEFAULT NULL | 佣金金额 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/MATCHED/DIFF/ADJUSTED |
| operator_id | BIGINT UNSIGNED DEFAULT NULL | 对账人 |
| adjusted_at | DATETIME DEFAULT NULL | 调整时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 9. platform_review（平台评价表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 评价ID |
| platform | VARCHAR(32) NOT NULL | 平台 |
| platform_review_id | VARCHAR(128) DEFAULT NULL | 平台评价ID |
| order_no | VARCHAR(64) NOT NULL | 关联订单号 |
| rating | TINYINT NOT NULL | 评分：1-5 |
| content | TEXT DEFAULT NULL | 评价内容 |
| reply_content | VARCHAR(500) DEFAULT NULL | 回复内容 |
| replied_at | DATETIME DEFAULT NULL | 回复时间 |
| synced_at | DATETIME DEFAULT NULL | 同步时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/orders | 订单列表 |
| GET | /api/admin/orders/:orderNo | 订单详情 |
| PUT | /api/admin/orders/:orderNo/status | 更新订单状态 |
| POST | /api/admin/orders/:orderNo/accept | 接单 |
| POST | /api/admin/orders/:orderNo/cancel | 取消订单 |
| POST | /api/admin/orders/:orderNo/ship | 发货 |
| POST | /api/admin/orders/:orderNo/complete | 完成订单 |
| GET | /api/admin/orders/:orderNo/items | 订单明细 |
| GET | /api/admin/returns | 退货单列表 |
| POST | /api/admin/returns | 创建退货单 |
| GET | /api/admin/returns/:returnNo | 退货单详情 |
| PUT | /api/admin/returns/:returnNo/status | 更新退货状态 |
| GET | /api/admin/refunds | 退款单列表 |
| POST | /api/admin/refunds | 创建退款单 |
| GET | /api/admin/refunds/:refundNo | 退款单详情 |
| GET | /api/admin/payments | 支付单列表 |
| GET | /api/admin/order-sync-logs | 同步日志列表 |
| GET | /api/admin/platform-reconciliations | 平台对账列表 |
| POST | /api/admin/platform-reconciliations/reconcile | 执行对账 |
| GET | /api/admin/platform-reviews | 平台评价列表 |
| POST | /api/admin/platform-reviews/:id/reply | 回复评价 |
| GET | /api/admin/platform-reviews/sync | 同步平台评价 |

#### 汇总统计

- 表数量：9（其中2张与销售管理共用，3张P1新增）
- 字段总数：约 160
- API数量：21


---

## 第七部分：即时零售

**定位**: 小程序商城 + 外卖平台对接 + 60秒接单 + 实时库存防超卖。覆盖C端消费者零售、B端批发客户自助下单，是系统唯一的客户流量入口。

**核心差异化** ⭐⭐

**小程序归属说明**: 小程序作为即时零售的核心载体，承载C端零售下单、B端批发客户自助采购、会员积分储值、在线支付等全部客户触达功能。不独立为一级目录，整合在即时零售下。

### 二级模块总览

| 二级模块 | 优先级 | 说明 | 字段数 |
|---------|--------|------|--------:|
| A. 小程序基础配置 | 🔴 P0 | 店铺装修、页面配置、公告管理 | ~55 |
| B. 商品货架管理 | 🔴 P0 | 小程序商品展示、分类、搜索、价格分层 | ~70 |
| C. C端零售下单 | 🔴 P0 | 普通消费者浏览→下单→支付→收货 | ~80 |
| D. B端批发下单 | 🔴⭐ P0 | 批发客户查看批发价→下单采购→对账付款 | ~90 |
| E. 购物车与结算 | 🔴 P0 | 购物车、优惠券、满减、结算 | ~50 |
| F. 在线支付 | 🔴 P0 | 微信支付、支付记录、退款 | ~40 |
| G. 订单中心 | 🔴 P0 | 订单列表、状态追踪、物流查询 | ~55 |
| H. 会员中心 | 🔴 P0 | 积分、储值、等级、优惠券、地址 | ~75 |
| I. 配送管理 | 🔴 P0 | 配送方式、运费模板、自提点 | ~45 |
| J. 平台对接管理 | 🔴 P0 | 美团/饿了么/京东到家/抖音即配 | ~60 |
| K. 60秒接单工作台 | 🔴⭐⭐ P0 | 强制倒计时接单，超时自动拒 | ~50 |
| L. 商品上架同步 | 🔴 P0 | 价格库存同步到外卖平台 | ~55 |
| M. 履约调度 | 🔴 P0 | 自配/第三方配送分配 | ~60 |
| N. 缺货与异常处理 | 🔴 P0 | 缺货自动拒单、重调度 | ~45 |
| O. 实时库存原子扣减 | 🔴 P0 | 下单即锁库存防超卖 | ~30 |
| P. 平台对账与佣金 | 🟡 P1 | 佣金核对、对账差异 | ~50 |
| Q. 平台评价管理 | 🟡 P1 | 评价同步回复 | ~25 |
| R. 零售经营分析 | 🟡 P1 | 小程序+外卖平台销售、毛利分析 | ~40 |
| **合计** | | | **~975**（原505 + 小程序470） |

### 即时零售 · 字段与表结构详解

#### 数据表定义

##### 1. retail_shop_config（小程序店铺配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 配置ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| shop_name | VARCHAR(128) NOT NULL | 店铺名称 |
| logo | VARCHAR(512) DEFAULT NULL | 店铺Logo |
| description | VARCHAR(500) DEFAULT NULL | 店铺简介 |
| contact_phone | VARCHAR(20) DEFAULT NULL | 联系电话 |
| business_hours_start | TIME DEFAULT NULL | 营业开始时间 |
| business_hours_end | TIME DEFAULT NULL | 营业结束时间 |
| address | VARCHAR(255) DEFAULT NULL | 店铺地址 |
| latitude | DECIMAL(10,7) DEFAULT NULL | 纬度 |
| longitude | DECIMAL(10,7) DEFAULT NULL | 经度 |
| home_banners | JSON DEFAULT NULL | 首页轮播图 |
| home_nav_icons | JSON DEFAULT NULL | 首页导航图标 |
| home_recommend_ids | JSON DEFAULT NULL | 首页推荐商品 |
| tabbar_config | JSON DEFAULT NULL | 底部导航配置 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/INACTIVE |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 2. retail_category（小程序分类表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 分类ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| parent_id | BIGINT UNSIGNED DEFAULT NULL | 父分类ID |
| name | VARCHAR(64) NOT NULL | 分类名称 |
| icon | VARCHAR(255) DEFAULT NULL | 分类图标 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| level | TINYINT NOT NULL DEFAULT 1 | 层级 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 3. retail_banner（小程序轮播图表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 轮播图ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| image_url | VARCHAR(512) NOT NULL | 图片URL |
| link_type | VARCHAR(32) DEFAULT NULL | 链接类型：PRODUCT/CATEGORY/URL/NONE |
| link_value | VARCHAR(512) DEFAULT NULL | 链接值 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| start_time | DATETIME DEFAULT NULL | 开始展示时间 |
| end_time | DATETIME DEFAULT NULL | 结束展示时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 4. retail_product（小程序商品上架表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 上架ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| retail_price | DECIMAL(12,2) NOT NULL | 小程序零售价 |
| miniapp_wholesale_price | DECIMAL(12,2) DEFAULT NULL | 小程序批发价（B端可见） |
| stock | INT NOT NULL DEFAULT 0 | 小程序库存 |
| is_recommend | TINYINT NOT NULL DEFAULT 0 | 是否推荐 |
| is_new | TINYINT NOT NULL DEFAULT 0 | 是否新品 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ONLINE' | 状态：ONLINE/OFFLINE |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 5. retail_order（即时零售订单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 订单ID |
| order_no | VARCHAR(64) NOT NULL UNIQUE | 订单号 |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号 |
| customer_type | VARCHAR(32) NOT NULL DEFAULT 'RETAIL' | 客户类型：RETAIL/WHOLESALE |
| order_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 订单状态 |
| accept_deadline | DATETIME DEFAULT NULL | 接单截止时间 |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| freight_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 运费 |
| discount_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 优惠金额 |
| coupon_id | BIGINT UNSIGNED DEFAULT NULL | 使用优惠券ID |
| coupon_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 优惠券抵扣 |
| payable_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应付金额 |
| paid_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已付金额 |
| payment_method | VARCHAR(32) DEFAULT NULL | 支付方式 |
| paid_at | DATETIME DEFAULT NULL | 支付时间 |
| delivery_type | VARCHAR(32) DEFAULT NULL | 配送方式 |
| delivery_address | JSON DEFAULT NULL | 收货地址 |
| delivery_fee | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 配送费 |
| expected_delivery_time | DATETIME DEFAULT NULL | 期望送达时间 |
| actual_delivery_time | DATETIME DEFAULT NULL | 实际送达时间 |
| receiver_name | VARCHAR(64) DEFAULT NULL | 收货人 |
| receiver_mobile | VARCHAR(20) DEFAULT NULL | 收货人手机 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| cancel_reason | VARCHAR(255) DEFAULT NULL | 取消原因 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 6. retail_order_item（即时零售订单明细表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| order_no | VARCHAR(64) NOT NULL | 订单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(255) NOT NULL | SKU名称快照 |
| sku_image | VARCHAR(512) DEFAULT NULL | SKU图片快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| unit_price | DECIMAL(12,2) NOT NULL | 成交单价 |
| subtotal_amount | DECIMAL(12,2) NOT NULL | 小计 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 7. delivery_config（配送配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 配置ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| delivery_type | VARCHAR(32) NOT NULL | 配送方式：SELF_PICKUP/DELIVERY/EXPRESS |
| name | VARCHAR(64) NOT NULL | 配送方式名称 |
| min_order_amount | DECIMAL(12,2) DEFAULT 0 | 起送金额 |
| base_fee | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 基础配送费 |
| free_delivery_amount | DECIMAL(12,2) DEFAULT NULL | 免配送费门槛 |
| delivery_radius_km | DECIMAL(5,2) DEFAULT NULL | 配送半径（公里） |
| delivery_time_min | INT DEFAULT NULL | 预计配送时间（分钟） |
| self_pickup_address | VARCHAR(255) DEFAULT NULL | 自提点地址 |
| self_pickup_hours | VARCHAR(128) DEFAULT NULL | 自提点营业时间 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 8. delivery_record（配送记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 配送记录ID |
| order_no | VARCHAR(64) NOT NULL | 订单号 |
| delivery_type | VARCHAR(32) NOT NULL | 配送方式 |
| delivery_status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 配送状态：PENDING/ASSIGNED/PICKING/SHIPPING/DELIVERED/FAILED |
| delivery_person | VARCHAR(64) DEFAULT NULL | 配送员 |
| delivery_person_mobile | VARCHAR(20) DEFAULT NULL | 配送员电话 |
| pickup_time | DATETIME DEFAULT NULL | 取货时间 |
| delivered_time | DATETIME DEFAULT NULL | 送达时间 |
| delivery_fee | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 配送费 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 9. retail_operation_log（零售操作日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| action | VARCHAR(64) NOT NULL | 操作类型 |
| target_type | VARCHAR(32) NOT NULL | 目标类型：ORDER/PRODUCT/CONFIG |
| target_id | VARCHAR(64) NOT NULL | 目标ID |
| detail | JSON DEFAULT NULL | 操作详情 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 10. retail_announcement（小程序公告表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 公告ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| title | VARCHAR(128) NOT NULL | 公告标题 |
| content | TEXT NOT NULL | 公告内容 |
| is_top | TINYINT NOT NULL DEFAULT 0 | 是否置顶 |
| start_time | DATETIME DEFAULT NULL | 开始展示时间 |
| end_time | DATETIME DEFAULT NULL | 结束展示时间 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 11. retail_cart（购物车表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 购物车ID |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| checked | TINYINT NOT NULL DEFAULT 1 | 是否选中 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 12. retail_consumer_address（消费者收货地址表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 地址ID |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| name | VARCHAR(64) NOT NULL | 收货人姓名 |
| mobile | VARCHAR(20) NOT NULL | 收货人手机 |
| province | VARCHAR(64) NOT NULL | 省 |
| city | VARCHAR(64) NOT NULL | 市 |
| district | VARCHAR(64) NOT NULL | 区 |
| detail | VARCHAR(255) NOT NULL | 详细地址 |
| is_default | TINYINT NOT NULL DEFAULT 0 | 是否默认地址 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/retail/shop-config | 获取店铺配置 |
| PUT | /api/retail/shop-config | 更新店铺配置 |
| GET | /api/retail/categories | 分类列表 |
| POST | /api/retail/categories | 创建分类 |
| PUT | /api/retail/categories/:id | 更新分类 |
| DELETE | /api/retail/categories/:id | 删除分类 |
| GET | /api/retail/banners | 轮播图列表 |
| POST | /api/retail/banners | 创建轮播图 |
| PUT | /api/retail/banners/:id | 更新轮播图 |
| DELETE | /api/retail/banners/:id | 删除轮播图 |
| GET | /api/retail/products | 上架商品列表 |
| POST | /api/retail/products | 上架商品 |
| PUT | /api/retail/products/:id | 更新上架商品 |
| POST | /api/retail/products/:id/offline | 下架商品 |
| GET | /api/retail/orders | 订单列表 |
| GET | /api/retail/orders/:orderNo | 订单详情 |
| POST | /api/retail/orders/:orderNo/accept | 接单 |
| POST | /api/retail/orders/:orderNo/ship | 发货 |
| POST | /api/retail/orders/:orderNo/complete | 完成 |
| GET | /api/retail/delivery-configs | 配送配置列表 |
| POST | /api/retail/delivery-configs | 创建配送配置 |
| PUT | /api/retail/delivery-configs/:id | 更新配送配置 |
| DELETE | /api/retail/delivery-configs/:id | 删除配送配置 |
| GET | /api/retail/announcements | 公告列表 |
| POST | /api/retail/announcements | 创建公告 |
| PUT | /api/retail/announcements/:id | 更新公告 |
| DELETE | /api/retail/announcements/:id | 删除公告 |
| GET | /api/retail/cart | 购物车列表 |
| POST | /api/retail/cart | 加入购物车 |
| PUT | /api/retail/cart/:id | 更新购物车 |
| DELETE | /api/retail/cart/:id | 删除购物车项 |
| POST | /api/retail/cart/clear | 清空购物车 |
| GET | /api/retail/addresses | 收货地址列表 |
| POST | /api/retail/addresses | 创建收货地址 |
| PUT | /api/retail/addresses/:id | 更新收货地址 |
| DELETE | /api/retail/addresses/:id | 删除收货地址 |
| GET | /api/retail/operation-logs | 操作日志 |

#### 汇总统计

- 表数量：12（9张已有 + 3张P1新增）
- 字段总数：约 180
- API数量：34


---

### A. 小程序基础配置

> 优先级：🔴 P0 | 定位：小程序店铺的基础设置

**三级菜单**: 店铺信息 / 首页装修 / 导航配置 / 公告管理 / 客服设置

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 店铺信息 | 店铺名称、logo、简介、联系电话、营业时间、地址 | 小程序首页展示 |
| 首页装修 | 轮播图、导航图标、商品推荐位、活动弹窗 | 拖拽式装修 |
| 导航配置 | 底部TabBar（首页/分类/购物车/我的） | 图标+文字配置 |
| 公告管理 | 公告标题、内容、置顶、有效期 | 首页滚动公告 |
| 客服设置 | 客服微信号、电话、工作时间 | 在线客服入口 |

---

### B. 商品货架管理

> 优先级：🔴 P0 | 定位：小程序端商品展示与搜索

**三级菜单**: 分类展示 / 商品搜索 / 商品详情 / 价格分层展示

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 分类展示 | 分类名称、图标、排序、商品列表 | 两级分类侧边栏 |
| 商品搜索 | 关键词、搜索历史、热门搜索、搜索结果 | 支持商品名/条码搜索 |
| 商品详情 | 主图轮播、规格选择、价格、库存、详情图、加入购物车 | 含箱/瓶规格切换 |
| 价格分层展示 | 零售价（C端）、批发价（B端绑定后可见） | **核心**：普通客户仅见零售价，绑定批发客户可见批发价 |

---

### C. C端零售下单

> 优先级：🔴 P0 | 定位：普通消费者小程序下单流程

**三级菜单**: 商品浏览 / 下单结算 / 支付收银 / 订单确认

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 商品浏览 | 商品列表、分类筛选、详情、加购 | C端仅展示零售价 |
| 下单结算 | 收货地址、商品明细、数量、小计、优惠券、满减、配送费、合计 | 支持箱/瓶双单位 |
| 支付收银 | 微信支付、支付金额、支付状态 | JSAPI支付 |
| 订单确认 | 订单号、商品明细、金额、预计送达时间 | 下单成功页 |

---

### D. B端批发下单

> 优先级：🔴⭐ P0 | 定位：绑定批发客户在小程序端自助采购，核心差异化

**三级菜单**: 批发商品专区 / 采购下单 / 批发对账 / 采购付款

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 批发商品专区 | 批发价、起订量、阶梯价、可售库存 | **仅绑定批发客户可见批发价**，C端客户完全看不到 |
| 采购下单 | 客户身份识别、批发价展示、商品明细、整单金额、赊销/现结 | 自动识别批发客户身份，展示其专属批发价 |
| 批发对账 | 对账单列表、本期采购、已付/未付金额、账单详情 | 批发客户可自主查看对账信息 |
| 采购付款 | 待付账单、微信支付、付款记录 | 批发客户在线付款，自动核销应收 |

---

### E. 购物车与结算

> 优先级：🔴 P0 | 定位：统一购物车管理

**三级菜单**: 购物车列表 / 优惠券选择 / 满减计算 / 结算页

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 购物车列表 | 商品、规格、数量、单价、小计、全选 | 支持批量编辑数量 |
| 优惠券选择 | 可用优惠券、已选优惠券、优惠金额 | 自动匹配最优优惠券 |
| 满减计算 | 满减规则匹配、减免金额 | 自动计算满减优惠 |
| 结算页 | 商品汇总、优惠明细、配送费、实付金额 | 最终确认 |

---

### F. 在线支付

> 优先级：🔴 P0 | 定位：微信支付全流程

**三级菜单**: 支付配置 / 支付记录 / 退款管理

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 支付配置 | 微信商户号、API密钥、证书 | 后台配置 |
| 支付记录 | 支付单号、金额、状态、时间、关联订单 | 支付流水 |
| 退款管理 | 退款单号、退款金额、退款原因、状态 | 支持部分/全额退款 |

---

### G. 订单中心（小程序端）

> 优先级：🔴 P0 | 定位：客户自主查看订单状态

**三级菜单**: 全部订单 / 待付款 / 待发货 / 待收货 / 已完成 / 售后

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 全部订单 | 订单号、商品、金额、状态、时间 | 按状态Tab筛选 |
| 待付款 | 倒计时、去支付按钮 | 超时自动取消 |
| 待发货 | 预计发货时间、催单按钮 | 发货进度 |
| 待收货 | 物流信息、确认收货 | 物流追踪 |
| 已完成 | 评价入口、再次购买 | 订单归档 |
| 售后 | 售后单号、类型、状态、进度 | 退款/退货/换货 |

---

### H. 会员中心（小程序端）

> 优先级：🔴 P0 | 定位：客户个人中心

**三级菜单**: 我的资料 / 我的积分 / 我的储值 / 我的优惠券 / 收货地址 / 我的等级

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 我的资料 | 头像、昵称、手机号、绑定微信 | 微信授权登录 |
| 我的积分 | 积分余额、积分明细、积分兑换 | 积分记录 |
| 我的储值 | 储值余额、充值记录、消费记录 | 储值卡管理 |
| 我的优惠券 | 可用券、已用券、过期券 | 优惠券列表 |
| 收货地址 | 收货人、电话、地址、默认 | 最多20个地址 |
| 我的等级 | 当前等级、升级进度、等级权益 | 会员等级展示 |

---

### I. 配送管理

> 优先级：🔴 P0 | 定位：配送方式与运费配置

**三级菜单**: 配送方式 / 运费模板 / 自提点管理

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 配送方式 | 快递配送、同城配送、到店自提 | 多配送方式 |
| 运费模板 | 模板名称、计费方式、首重/续重、地区 | 灵活的运费规则 |
| 自提点管理 | 自提点名称、地址、电话、营业时间 | 门店自提 |

---

### J-R. 外卖平台对接（保留原即时零售模块）

| 二级模块 | 优先级 | 说明 | 字段数 |
|---------|--------|------|--------:|
| J. 平台对接管理 | 🔴 P0 | 美团/饿了么/京东到家/抖音即配密钥配置 | ~60 |
| K. 60秒接单工作台 | 🔴⭐⭐ P0 | 强制倒计时接单，超时自动拒 | ~50 |
| L. 商品上架同步 | 🔴 P0 | 价格库存同步到外卖平台 | ~55 |
| M. 履约调度 | 🔴 P0 | 自配/第三方配送分配 | ~60 |
| N. 缺货与异常处理 | 🔴 P0 | 缺货自动拒单、重调度 | ~45 |
| O. 实时库存原子扣减 | 🔴 P0 | 下单即锁库存防超卖 | ~30 |
| P. 平台对账与佣金 | 🟡 P1 | 佣金核对、对账差异 | ~50 |
| Q. 平台评价管理 | 🟡 P1 | 评价同步回复 | ~25 |
| R. 零售经营分析 | 🟡 P1 | 小程序+各平台销售、毛利分析 | ~40 |

> **酒水适配**: 小程序是自营客户流量入口，外卖平台是公域流量入口，两者都要保留 P0 核心模块。小程序B端批发下单功能是酒水行业的核心差异化。

---

## 第八部分：客户管理（整合原客户与会员中心）

**定位**: B端批发商 + C端会员统一管理，积分储值。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 积分与等级 | 🔴 P0 | 积分累计、等级升级 | ~50 | 保留，C端客户需要 |
| 2. 储值卡管理 | 🔴 P0 | 储值开卡、充值、消费 | ~70 | 保留，门店零售需要 |
| 3. 标签与画像 | 🟡 P1 | 消费标签、客户画像 | ~65 | 放P1 |
| 4. 客户关怀 | 🟡 P1 | 生日祝福、节日营销 | ~55 | 放P1 |
| 5. 客户全生命周期看板 | 🟡 P1 | 从潜客到流失全链路 | ~50 | 放P1 |
| 6. 客户分群与营销联动 | 🟡 P1 | 分群群发、定向营销 | ~55 | 放P1 |
| 7. 会员体系（B+C统一） | 🔴 P0 | B客户 + C会员统一体系 | ~80 | 保留 |
| 8. 商家管理后台 | 🔴 P0 | 客户自主查询订单积分 | ~110 | 保留，小程序需要 |
| 9. 信用管理（B端） | 🟡 P1 | 赊销额度、账期 | ~60 | 移至销售管理/财务往来 |
| **合计** | | | **695** | 适配后保留 ~480 字段 |

> **整合说明**: 原"客户与会员中心"整个整合到一级目录"客户管理"，删除了不相关的社交裂变内容。

### 客户管理 · 字段与表结构详解

### 4.1 数据表定义

#### 4.1.1 member（会员客户表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 会员ID |
| openid | VARCHAR(128) DEFAULT NULL UNIQUE | 微信openid |
| unionid | VARCHAR(128) DEFAULT NULL | 微信unionid |
| mobile | VARCHAR(20) NOT NULL UNIQUE | 手机号 |
| name | VARCHAR(64) DEFAULT NULL | 客户名称 |
| address | VARCHAR(255) DEFAULT NULL | 客户地址 |
| remark | VARCHAR(500) DEFAULT NULL | 备注 |
| customer_type | VARCHAR(32) NOT NULL DEFAULT 'RETAIL' | 客户身份：RETAIL/WHOLESALE |
| settlement_type | VARCHAR(32) NOT NULL DEFAULT 'CASH' | 结算方式：CASH/ACCOUNT |
| staff_id | BIGINT UNSIGNED DEFAULT NULL | 归属销售员ID |
| points | INT NOT NULL DEFAULT 0 | 积分 |
| level_code | VARCHAR(32) DEFAULT NULL | 会员等级 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| last_order_at | DATETIME DEFAULT NULL | 最近下单时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.2 customer_points（客户积分表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 积分ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| total_points | INT DEFAULT 0 | 累计积分 |
| available_points | INT DEFAULT 0 | 可用积分 |
| frozen_points | INT DEFAULT 0 | 冻结积分 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.3 points_record（积分变动记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 记录ID |
| record_no | VARCHAR(32) NOT NULL | 记录编号 |
| customer_id | BIGINT NOT NULL | 客户ID |
| type | VARCHAR(20) NOT NULL | 类型：EARN/REDEEM/EXPIRE/ADJUST |
| points | INT NOT NULL | 积分变动数 |
| balance_after | INT NOT NULL | 变动后余额 |
| source_type | VARCHAR(20) DEFAULT NULL | 来源类型 |
| source_no | VARCHAR(32) DEFAULT NULL | 来源单号 |
| remark | VARCHAR(200) DEFAULT NULL | 备注 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 4.1.4 points_rule（积分规则表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 规则ID |
| rule_name | VARCHAR(100) NOT NULL | 规则名称 |
| earn_type | VARCHAR(20) NOT NULL | 获取方式：PURCHASE/SIGN_IN/BIRTHDAY/REFERRAL |
| earn_rate | DECIMAL(6,4) DEFAULT 0 | 积分比例 |
| daily_limit | INT DEFAULT 0 | 每日上限 |
| enabled | TINYINT DEFAULT 1 | 是否启用 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.5 customer_level（客户等级表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 等级ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| level_name | VARCHAR(20) NOT NULL DEFAULT 'VIP1' | 等级名称 |
| level_points | INT DEFAULT 0 | 当前等级积分 |
| upgraded_at | DATETIME DEFAULT NULL | 升级时间 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.6 level_config（等级配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 配置ID |
| level_name | VARCHAR(20) NOT NULL | 等级名称 |
| min_points | INT NOT NULL DEFAULT 0 | 最低积分 |
| max_points | INT NOT NULL DEFAULT 0 | 最高积分 |
| discount_rate | DECIMAL(4,2) DEFAULT 1.00 | 折扣率 |
| benefits | JSON DEFAULT NULL | 权益配置 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.7 store_value_card（储值卡表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 储值卡ID |
| card_no | VARCHAR(32) NOT NULL | 卡号 |
| customer_id | BIGINT NOT NULL | 客户ID |
| customer_name | VARCHAR(100) DEFAULT NULL | 客户姓名 |
| balance | DECIMAL(12,2) DEFAULT 0 | 当前余额 |
| total_recharge | DECIMAL(12,2) DEFAULT 0 | 累计充值 |
| total_consume | DECIMAL(12,2) DEFAULT 0 | 累计消费 |
| status | VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/FROZEN/CANCELLED |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.8 store_value_transaction（储值卡交易记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 交易ID |
| trans_no | VARCHAR(32) NOT NULL | 交易编号 |
| card_no | VARCHAR(32) NOT NULL | 卡号 |
| customer_id | BIGINT NOT NULL | 客户ID |
| type | VARCHAR(20) NOT NULL | 类型：RECHARGE/CONSUME/REFUND/ADJUST |
| amount | DECIMAL(12,2) NOT NULL | 金额 |
| balance_after | DECIMAL(12,2) NOT NULL | 交易后余额 |
| pay_method | VARCHAR(20) DEFAULT NULL | 支付方式 |
| source_no | VARCHAR(32) DEFAULT NULL | 来源单号 |
| remark | VARCHAR(200) DEFAULT NULL | 备注 |
| operator_id | BIGINT DEFAULT NULL | 操作人ID |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 4.1.9 customer_tag（客户标签表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 标签ID |
| tag_name | VARCHAR(50) NOT NULL | 标签名称 |
| tag_type | VARCHAR(20) NOT NULL DEFAULT 'MANUAL' | 类型：MANUAL/AUTO |
| tag_group | VARCHAR(50) DEFAULT NULL | 标签分组 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 4.1.10 customer_tag_relation（客户标签关联表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 关联ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| tag_id | BIGINT NOT NULL | 标签ID |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 4.1.11 customer_profile（客户画像表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 画像ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| age_group | VARCHAR(20) DEFAULT NULL | 年龄段 |
| gender | VARCHAR(10) DEFAULT NULL | 性别 |
| prefer_category | VARCHAR(500) DEFAULT NULL | 偏好品类 |
| prefer_brand | VARCHAR(500) DEFAULT NULL | 偏好品牌 |
| avg_order_amount | DECIMAL(12,2) DEFAULT 0 | 平均客单价 |
| total_order_count | INT DEFAULT 0 | 累计消费次数 |
| last_order_at | DATETIME DEFAULT NULL | 最近消费时间 |
| total_points | INT DEFAULT 0 | 累计积分 |
| member_level | VARCHAR(20) DEFAULT NULL | 会员等级 |
| lifecycle_stage | VARCHAR(20) DEFAULT 'PROSPECT' | 生命周期阶段 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.12 customer_care_rule（客户关怀规则表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 规则ID |
| rule_name | VARCHAR(100) NOT NULL | 规则名称 |
| trigger_type | VARCHAR(20) NOT NULL | 触发类型：BIRTHDAY/HOLIDAY/INACTIVE/LEVEL_UP |
| template_content | TEXT | 关怀内容模板 |
| reward_points | INT DEFAULT 0 | 奖励积分 |
| reward_coupon_id | BIGINT DEFAULT NULL | 奖励优惠券ID |
| enabled | TINYINT DEFAULT 1 | 是否启用 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.13 customer_care_log（客户关怀记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 记录ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| rule_id | BIGINT NOT NULL | 关怀规则ID |
| trigger_type | VARCHAR(20) NOT NULL | 触发类型 |
| sent_content | TEXT | 发送内容 |
| sent_at | DATETIME DEFAULT NULL | 发送时间 |
| status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SENT/FAILED |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 4.1.14 customer_segment（客户分群表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 分群ID |
| segment_name | VARCHAR(100) NOT NULL | 分群名称 |
| conditions | JSON NOT NULL | 分群条件 |
| member_count | INT DEFAULT 0 | 成员数 |
| auto_refresh | TINYINT DEFAULT 0 | 是否自动刷新 |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 4.1.15 customer_segment_member（客户分群成员表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT AUTO_INCREMENT | 成员ID |
| segment_id | BIGINT NOT NULL | 分群ID |
| customer_id | BIGINT NOT NULL | 客户ID |
| tenant_id | VARCHAR(64) NOT NULL DEFAULT '' | 租户ID |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 4.1.16 customer_visit（客户拜访记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 拜访记录ID |
| visit_no | VARCHAR(64) NOT NULL UNIQUE | 拜访单号 |
| customer_id | BIGINT UNSIGNED NOT NULL | 客户ID |
| customer_name | VARCHAR(64) NOT NULL | 客户名称快照 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号 |
| store_id | BIGINT UNSIGNED NOT NULL | 所属门店ID |
| visitor_id | BIGINT UNSIGNED NOT NULL | 拜访人(员工ID) |
| visitor_name | VARCHAR(64) NOT NULL | 拜访人姓名 |
| visit_type | VARCHAR(32) NOT NULL DEFAULT 'ONSITE' | 拜访类型：ONSITE/PHONE/ONLINE |
| visit_purpose | VARCHAR(32) NOT NULL DEFAULT 'ROUTINE' | 拜访目的：ROUTINE/ORDER/COLLECTION/COMPLAINT/PROMOTION/AFTER_SALE |
| visit_date | DATE NOT NULL | 拜访日期 |
| start_time | DATETIME DEFAULT NULL | 拜访开始时间 |
| end_time | DATETIME DEFAULT NULL | 拜访结束时间 |
| duration_minutes | INT DEFAULT NULL | 拜访时长(分钟) |
| address | VARCHAR(255) DEFAULT NULL | 拜访地址 |
| latitude | DECIMAL(10,7) DEFAULT NULL | 纬度 |
| longitude | DECIMAL(10,7) DEFAULT NULL | 经度 |
| contact_person | VARCHAR(64) DEFAULT NULL | 联系人 |
| contact_position | VARCHAR(64) DEFAULT NULL | 联系人职位 |
| contact_mobile | VARCHAR(20) DEFAULT NULL | 联系人电话 |
| visit_summary | TEXT | 拜访总结 |
| follow_up_required | TINYINT(1) NOT NULL DEFAULT 0 | 是否需要跟进 |
| follow_up_date | DATE DEFAULT NULL | 下次跟进日期 |
| follow_up_content | VARCHAR(255) DEFAULT NULL | 跟进内容说明 |
| next_action | VARCHAR(255) DEFAULT NULL | 下一步行动计划 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PLANNED' | 状态：PLANNED/VISITED/COMPLETED/CANCELLED |
| related_order_no | VARCHAR(64) DEFAULT NULL | 关联订单号 |
| images | JSON DEFAULT NULL | 拜访照片 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| tenant_id | VARCHAR(36) NOT NULL DEFAULT 'default' | 租户ID |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

### 4.2 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/members | 客户列表 |
| POST | /api/admin/members | 创建客户 |
| GET | /api/admin/members/stats | 客户统计 |
| GET | /api/admin/members/:id | 客户详情 |
| PUT | /api/admin/members/:id | 更新客户 |
| PUT | /api/admin/members/:id/disable | 禁用客户 |
| PUT | /api/admin/members/:id/assign-staff | 分配销售员 |
| GET | /api/admin/members/:id/purchase-stats | 客户采购统计 |
| GET | /api/admin/members/:id/price-history | 客户价格历史 |
| GET | /api/admin/members/:id/sale-bills | 客户销售单 |
| GET | /api/admin/members/:id/payments | 客户付款记录 |
| GET | /api/admin/members/:id/statements | 客户对账单 |
| POST | /api/admin/members/register | 注册会员 |
| GET | /api/admin/members/:id/member-card | 会员卡信息 |
| PUT | /api/admin/members/:id/member-level | 更新会员等级 |
| GET | /api/admin/members/benefits | 会员权益 |
| GET | /api/admin/members/lifecycle/stages | 生命周期阶段 |
| GET | /api/admin/members/lifecycle/trend | 生命周期趋势 |
| GET | /api/admin/members/lifecycle/detail | 生命周期详情 |
| GET | /api/points/rules | 积分规则列表 |
| POST | /api/points/rules | 创建积分规则 |
| PUT | /api/points/rules/:id | 更新积分规则 |
| POST | /api/points/:id/points/adjust | 调整客户积分 |
| GET | /api/points/:id/points/records | 客户积分记录 |
| GET | /api/points/levels/config | 等级配置列表 |
| POST | /api/points/levels/config | 创建等级配置 |
| PUT | /api/points/levels/config/:id | 更新等级配置 |
| GET | /api/store-value-cards | 储值卡列表 |
| POST | /api/store-value-cards | 创建储值卡 |
| GET | /api/store-value-cards/:cardNo | 储值卡详情 |
| POST | /api/store-value-cards/:cardNo/recharge | 充值 |
| POST | /api/store-value-cards/:cardNo/consume | 消费 |
| POST | /api/store-value-cards/:cardNo/refund | 退款 |
| POST | /api/store-value-cards/:cardNo/freeze | 冻结 |
| POST | /api/store-value-cards/:cardNo/unfreeze | 解冻 |
| GET | /api/store-value-cards/:cardNo/transactions | 交易记录 |
| GET | /api/customer-tags | 标签列表 |
| POST | /api/customer-tags | 创建标签 |
| PUT | /api/customer-tags/:id | 更新标签 |
| DELETE | /api/customer-tags/:id | 删除标签 |
| POST | /api/customer-tags/:id/tags | 给客户打标签 |
| DELETE | /api/customer-tags/:id/tags/:tagId | 移除客户标签 |
| GET | /api/customer-tags/:id/profile | 客户画像 |
| GET | /api/customer-segments | 分群列表 |
| POST | /api/customer-segments | 创建分群 |
| PUT | /api/customer-segments/:id | 更新分群 |
| DELETE | /api/customer-segments/:id | 删除分群 |
| POST | /api/customer-segments/:id/refresh | 刷新分群成员 |
| GET | /api/customer-segments/:id/members | 分群成员列表 |
| GET | /api/customer-care/rules | 关怀规则列表 |
| POST | /api/customer-care/rules | 创建关怀规则 |
| PUT | /api/customer-care/rules/:id | 更新关怀规则 |
| DELETE | /api/customer-care/rules/:id | 删除关怀规则 |
| GET | /api/customer-care/logs | 关怀记录列表 |
| POST | /api/customer-care/rules/:id/execute | 执行关怀规则 |
| GET | /api/customer-visits | 拜访列表 |
| POST | /api/customer-visits | 创建拜访 |
| GET | /api/customer-visits/:visitNo | 拜访详情 |
| PUT | /api/customer-visits/:visitNo | 更新拜访 |
| POST | /api/customer-visits/:visitNo/checkin | 签到 |
| POST | /api/customer-visits/:visitNo/checkout | 签退 |
| POST | /api/customer-visits/:visitNo/cancel | 取消拜访 |
| GET | /api/customer-visits/follow-up/pending | 待跟进列表 |
| GET | /api/customer-visits/statistics | 拜访统计 |

### 4.3 汇总统计

- 表数量：16
- 字段总数：约 210
- API数量：66

---

## 第九部分：营销中心

**定位**: 促销活动、客户触达。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 营销活动管理 | 🟡 P1 | 活动列表、状态管控 | ~60 | 放P1 |
| 2. 优惠券 | 🟡 P1 | 满减券、折扣券 | ~90 | 放P1 |
| 3. 秒杀拼团 | 🟢 P2 | 秒杀、拼团活动 | ~70 | 酒水零售不需要，放P2 |
| 4. 限时折扣 | 🟡 P1 | 限时降价促销 | ~40 | 保留P1 |
| 5. 满减满赠 | 🟡 P1 | 满X元减Y元/赠酒 | ~40 | 酒水行业适用 ✅ |
| 6. 积分商城 | 🟡 P1 | 积分兑换商品 | ~45 | 放P1 |
| 7. 社群营销 | 🟢 P2 | 社群裂变、分销 | ~65 | 不适合酒水批发，放P2 |
| 8. 营销看板 | 🟡 P1 | 活动效果分析 | ~30 | 放P1 |
| 9. 营销素材库 | 🟡 P1 | 海报素材管理 | ~40 | 放P1 |
| **合计** | | | **540** | 适配后保留 ~345 字段 |

### 营销中心 · 字段与表结构详解

#### 数据表定义

##### 1. coupon_template（优惠券模板表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 模板ID |
| template_code | VARCHAR(64) NOT NULL UNIQUE | 模板编码 |
| name | VARCHAR(128) NOT NULL | 优惠券名称 |
| type | VARCHAR(32) NOT NULL | 类型：FULL_REDUCTION/DISCOUNT/GIFT/EXCHANGE |
| use_scope | VARCHAR(32) NOT NULL DEFAULT 'ALL' | 适用范围：ALL/CATEGORY/PRODUCT |
| scope_ids | JSON DEFAULT NULL | 适用范围ID列表 |
| threshold_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 使用门槛金额 |
| discount_amount | DECIMAL(12,2) DEFAULT NULL | 优惠金额（满减券） |
| discount_rate | DECIMAL(5,4) DEFAULT NULL | 折扣率（折扣券，如0.85=八五折） |
| max_discount_amount | DECIMAL(12,2) DEFAULT NULL | 最高优惠金额（折扣券上限） |
| gift_product_ids | JSON DEFAULT NULL | 赠品SKU ID列表 |
| total_qty | INT NOT NULL DEFAULT 0 | 总发放量 |
| per_user_limit | INT NOT NULL DEFAULT 1 | 每人限领 |
| valid_days | INT NOT NULL | 有效天数 |
| start_time | DATETIME DEFAULT NULL | 开始时间 |
| end_time | DATETIME DEFAULT NULL | 结束时间 |
| status | VARCHAR(32) NOT NULL DEFAULT 'DRAFT' | 状态：DRAFT/ACTIVE/PAUSED/ENDED |
| description | VARCHAR(500) DEFAULT NULL | 使用说明 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 2. user_coupon（用户优惠券表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 优惠券ID |
| coupon_no | VARCHAR(64) NOT NULL UNIQUE | 优惠券编号 |
| template_id | BIGINT UNSIGNED NOT NULL | 模板ID |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| status | VARCHAR(32) NOT NULL DEFAULT 'UNUSED' | 状态：UNUSED/USED/EXPIRED/FROZEN |
| source_type | VARCHAR(32) NOT NULL | 获取来源：CLAIM/ISSUE/ACTIVITY |
| used_order_no | VARCHAR(64) DEFAULT NULL | 使用订单号 |
| used_at | DATETIME DEFAULT NULL | 使用时间 |
| expire_at | DATETIME NOT NULL | 过期时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 3. promotion_activity（营销活动表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 活动ID |
| activity_code | VARCHAR(64) NOT NULL UNIQUE | 活动编码 |
| name | VARCHAR(128) NOT NULL | 活动名称 |
| type | VARCHAR(32) NOT NULL | 活动类型：LIMITED_DISCOUNT/FULL_REDUCTION/GIFT/POINTS/COMMUNITY |
| description | VARCHAR(500) DEFAULT NULL | 活动描述 |
| banner_image | VARCHAR(512) DEFAULT NULL | 活动海报 |
| start_time | DATETIME NOT NULL | 开始时间 |
| end_time | DATETIME NOT NULL | 结束时间 |
| status | VARCHAR(32) NOT NULL DEFAULT 'DRAFT' | 状态：DRAFT/PENDING/ACTIVE/PAUSED/ENDED/CANCELLED |
| budget_amount | DECIMAL(12,2) DEFAULT NULL | 活动预算 |
| used_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已使用预算 |
| store_ids | JSON DEFAULT NULL | 适用门店 |
| operator_id | BIGINT UNSIGNED NOT NULL | 创建人 |
| auditor_id | BIGINT UNSIGNED DEFAULT NULL | 审核人 |
| audited_at | DATETIME DEFAULT NULL | 审核时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 4. full_reduction_rule（满减满赠规则表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 规则ID |
| activity_id | BIGINT UNSIGNED NOT NULL | 活动ID |
| threshold_amount | DECIMAL(12,2) NOT NULL | 满减门槛 |
| discount_amount | DECIMAL(12,2) DEFAULT NULL | 减金额 |
| gift_sku_ids | JSON DEFAULT NULL | 赠品SKU列表 |
| gift_qty | INT DEFAULT NULL | 赠品数量 |
| max_use_per_order | INT DEFAULT 1 | 每单最多使用次数 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 5. seckill_product（秒杀商品表）— P2

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 秒杀ID |
| activity_id | BIGINT UNSIGNED NOT NULL | 活动ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| seckill_price | DECIMAL(12,2) NOT NULL | 秒杀价 |
| seckill_stock | INT NOT NULL | 秒杀库存 |
| per_user_limit | INT NOT NULL DEFAULT 1 | 每人限购 |
| start_time | DATETIME NOT NULL | 秒杀开始时间 |
| end_time | DATETIME NOT NULL | 秒杀结束时间 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/ACTIVE/ENDED |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 6. group_buy_activity（拼团活动表）— P2

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 拼团活动ID |
| activity_id | BIGINT UNSIGNED NOT NULL | 活动ID |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| group_price | DECIMAL(12,2) NOT NULL | 拼团价 |
| min_group_size | INT NOT NULL | 成团人数 |
| group_duration_hours | INT NOT NULL | 拼团有效期（小时） |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 7. group_buy_record（拼团记录表）— P2

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 拼团记录ID |
| group_no | VARCHAR(64) NOT NULL UNIQUE | 拼团编号 |
| group_buy_activity_id | BIGINT UNSIGNED NOT NULL | 拼团活动ID |
| initiator_id | BIGINT UNSIGNED NOT NULL | 发起人ID |
| current_size | INT NOT NULL DEFAULT 1 | 当前人数 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SUCCESS/FAILED |
| expire_at | DATETIME NOT NULL | 过期时间 |
| completed_at | DATETIME DEFAULT NULL | 成团时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 8. group_buy_participant（拼团参与者表）— P2

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 参与者ID |
| group_no | VARCHAR(64) NOT NULL | 拼团编号 |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| order_no | VARCHAR(64) DEFAULT NULL | 关联订单号 |
| is_initiator | TINYINT NOT NULL DEFAULT 0 | 是否发起人 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 9. promotion_stack_rule（活动叠加规则表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 规则ID |
| activity_id_1 | BIGINT UNSIGNED NOT NULL | 活动1 ID |
| activity_id_2 | BIGINT UNSIGNED NOT NULL | 活动2 ID |
| can_stack | TINYINT NOT NULL DEFAULT 0 | 是否可叠加 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 10. marketing_operation_log（营销操作日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| activity_id | BIGINT UNSIGNED DEFAULT NULL | 活动ID |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| action | VARCHAR(64) NOT NULL | 操作类型 |
| detail | JSON DEFAULT NULL | 操作详情 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 11. points_mall_item（积分商城商品表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 商品ID |
| name | VARCHAR(128) NOT NULL | 商品名称 |
| image | VARCHAR(512) DEFAULT NULL | 商品图片 |
| points_required | INT NOT NULL | 所需积分 |
| stock | INT NOT NULL DEFAULT 0 | 库存 |
| per_user_limit | INT NOT NULL DEFAULT 1 | 每人限兑 |
| start_time | DATETIME DEFAULT NULL | 开始时间 |
| end_time | DATETIME DEFAULT NULL | 结束时间 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/INACTIVE |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 12. points_mall_order（积分兑换订单表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 订单ID |
| order_no | VARCHAR(64) NOT NULL UNIQUE | 订单号 |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| item_id | BIGINT UNSIGNED NOT NULL | 兑换商品ID |
| points_used | INT NOT NULL | 消耗积分 |
| qty | INT NOT NULL DEFAULT 1 | 兑换数量 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/DELIVERED/CANCELLED |
| delivery_address | JSON DEFAULT NULL | 收货地址 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 13. marketing_asset（营销素材表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 素材ID |
| name | VARCHAR(128) NOT NULL | 素材名称 |
| type | VARCHAR(32) NOT NULL | 素材类型：IMAGE/VIDEO/COPYWRITING |
| content | TEXT DEFAULT NULL | 素材内容（文案） |
| file_url | VARCHAR(512) DEFAULT NULL | 文件URL |
| tags | JSON DEFAULT NULL | 素材标签 |
| category | VARCHAR(32) DEFAULT NULL | 素材分类 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/coupon-templates | 优惠券模板列表 |
| POST | /api/admin/coupon-templates | 创建优惠券模板 |
| PUT | /api/admin/coupon-templates/:id | 更新优惠券模板 |
| DELETE | /api/admin/coupon-templates/:id | 删除优惠券模板 |
| POST | /api/admin/coupon-templates/:id/issue | 发放优惠券 |
| GET | /api/admin/user-coupons | 用户优惠券列表 |
| GET | /api/admin/promotions | 营销活动列表 |
| POST | /api/admin/promotions | 创建营销活动 |
| PUT | /api/admin/promotions/:id | 更新营销活动 |
| POST | /api/admin/promotions/:id/start | 启动活动 |
| POST | /api/admin/promotions/:id/pause | 暂停活动 |
| POST | /api/admin/promotions/:id/end | 结束活动 |
| DELETE | /api/admin/promotions/:id | 删除活动 |
| GET | /api/admin/promotions/:id/rules | 活动规则列表 |
| POST | /api/admin/promotions/:id/rules | 创建活动规则 |
| PUT | /api/admin/promotions/rules/:id | 更新活动规则 |
| DELETE | /api/admin/promotions/rules/:id | 删除活动规则 |
| GET | /api/admin/promotions/stack-rules | 叠加规则列表 |
| POST | /api/admin/promotions/stack-rules | 创建叠加规则 |
| GET | /api/admin/points-mall/items | 积分商城商品列表 |
| POST | /api/admin/points-mall/items | 创建积分商城商品 |
| PUT | /api/admin/points-mall/items/:id | 更新积分商城商品 |
| DELETE | /api/admin/points-mall/items/:id | 删除积分商城商品 |
| GET | /api/admin/points-mall/orders | 积分兑换订单列表 |
| POST | /api/admin/points-mall/orders/:id/deliver | 发货 |
| GET | /api/admin/marketing-assets | 营销素材列表 |
| POST | /api/admin/marketing-assets | 创建营销素材 |
| PUT | /api/admin/marketing-assets/:id | 更新营销素材 |
| DELETE | /api/admin/marketing-assets/:id | 删除营销素材 |
| GET | /api/admin/marketing-logs | 营销操作日志 |

#### 汇总统计

- 表数量：13（10张已有 + 3张P1新增）
- 字段总数：约 160
- API数量：30


> **酒水适配**: 删除秒杀拼团、社群分销等不适合酒水批发的功能。保留满减满赠、优惠券。

---

## 第十部分：财务往来（整合原财务与往来中心，原财务管理改名）

**定位**: 收付款、应收应付、对账、费用。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 收款管理 | 🔴 P0 | 收款单、核销应收 | ~85 | 含在线收款专项，保留 ✅ |
| 2. 付款管理 | 🔴 P0 | 付款单、核销应付 | ~55 | 保留 |
| 3. 应收应付 | 🔴 P0 | 应收汇总、应付汇总 | ~50 | 保留 |
| 4. 银行账户管理 | 🟡 P1 | 多账户管理 | ~45 | 放P1 |
| 5. 资金日报月报 | 🟡 P1 | 资金收支报表 | ~35 | 放P1 |
| 6. 费用管理 | 🔴 P0 | 日常费用报销登记 | ~40 | 保留 |
| 7. 票据管理 | 🟡 P1 | 发票管理 | ~50 | 放P1 |
| 8. 对账中心 | 🔴 P0 | 客户对账、供应商对账 | ~60 | 保留，酒水批发对账是痛点 ✅ |
| 9. 财务报表 | 🟡 P1 | 利润表、资产负债 | ~60 | 放P1 |
| 10. 老板财务驾驶舱 | 🔴 P0 | 老板首页财务看板 | ~80 | 保留，老板需要看关键数据 |
| **合计** | | | **660** | 适配后保留 ~365 字段 |

> **整合说明**: 原"财务与往来中心"更名为一级目录"财务往来"，符合我们的命名习惯。

### 财务往来 · 字段与表结构详解

### 5.1 数据表定义

#### 5.1.1 receivable_account（应收账款表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 应收ID |
| receivable_no | VARCHAR(64) NOT NULL UNIQUE | 应收单号 |
| source_type | VARCHAR(32) NOT NULL | 来源类型：MINIAPP_ORDER/SALE_BILL |
| source_no | VARCHAR(64) NOT NULL | 来源单号 |
| store_id | BIGINT UNSIGNED NOT NULL | 门店ID |
| customer_id | BIGINT UNSIGNED DEFAULT NULL | 客户ID |
| customer_name | VARCHAR(64) DEFAULT NULL | 客户名称快照 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号快照 |
| receivable_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 应收金额 |
| received_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 已收金额 |
| unreceived_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 未收金额 |
| status | VARCHAR(32) NOT NULL DEFAULT 'UNPAID' | 状态：UNPAID/PARTIAL/PAID/CLOSED |
| last_payment_time | DATETIME DEFAULT NULL | 最近收款时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 5.1.2 payment_order（支付单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 支付单ID |
| pay_no | VARCHAR(64) NOT NULL UNIQUE | 支付单号 |
| source_type | VARCHAR(32) NOT NULL | 来源类型：MINIAPP_ORDER/SALE_BILL/COLLECTION_LINK |
| source_no | VARCHAR(64) NOT NULL | 来源单号 |
| channel | VARCHAR(32) NOT NULL DEFAULT 'WECHAT' | 支付渠道 |
| amount | DECIMAL(12,2) NOT NULL | 支付金额 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 支付状态：PENDING/SUCCESS/FAILED/CLOSED/REFUNDED |
| wx_prepay_id | VARCHAR(128) DEFAULT NULL | 微信预支付ID |
| wx_transaction_id | VARCHAR(128) DEFAULT NULL UNIQUE | 微信交易号 |
| callback_raw | JSON DEFAULT NULL | 回调原文 |
| paid_at | DATETIME DEFAULT NULL | 支付成功时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 5.1.3 refund_order（退款单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 退款单ID |
| refund_no | VARCHAR(64) NOT NULL UNIQUE | 退款单号 |
| pay_no | VARCHAR(64) NOT NULL | 支付单号 |
| source_type | VARCHAR(32) NOT NULL | 来源类型 |
| source_no | VARCHAR(64) NOT NULL | 来源单号 |
| amount | DECIMAL(12,2) NOT NULL | 退款金额 |
| reason | VARCHAR(255) DEFAULT NULL | 退款原因 |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/SUCCESS/FAILED |
| wx_refund_id | VARCHAR(128) DEFAULT NULL | 微信退款单号 |
| operator_id | BIGINT UNSIGNED DEFAULT NULL | 操作人 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 5.1.4 customer_statement（客户对账单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 对账单ID |
| statement_no | VARCHAR(64) NOT NULL UNIQUE | 对账单号 |
| customer_id | BIGINT UNSIGNED NOT NULL | 客户ID |
| customer_name | VARCHAR(64) NOT NULL | 客户名称快照 |
| customer_mobile | VARCHAR(20) DEFAULT NULL | 客户手机号快照 |
| statement_type | VARCHAR(32) NOT NULL DEFAULT 'MONTHLY' | 对账类型：MONTHLY/QUARTERLY/CUSTOM |
| start_date | DATE NOT NULL | 对账开始日期 |
| end_date | DATE NOT NULL | 对账结束日期 |
| opening_balance | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 期初余额 |
| total_sales | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 本期销售 |
| total_returns | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 本期退货 |
| total_payments | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 本期收款 |
| closing_balance | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 期末余额 |
| status | VARCHAR(32) NOT NULL DEFAULT 'DRAFT' | 状态：DRAFT/CONFIRMED/PAID |
| confirmed_at | DATETIME DEFAULT NULL | 确认时间 |
| operator_id | BIGINT UNSIGNED NOT NULL | 制单人 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 5.1.5 customer_payment（客户收款单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 客户收款单ID |
| receipt_no | VARCHAR(64) NOT NULL UNIQUE | 收款单号 |
| customer_id | BIGINT UNSIGNED NOT NULL | 客户ID |
| customer_name | VARCHAR(64) NOT NULL | 客户名称快照 |
| amount | DECIMAL(12,2) NOT NULL | 收款金额 |
| payment_method | VARCHAR(32) NOT NULL DEFAULT 'CASH' | 收款方式：CASH/BANK/WECHAT/ALIPAY/COLLECTION |
| source_type | VARCHAR(32) DEFAULT NULL | 来源类型：SALE_BILL/STATEMENT |
| source_no | VARCHAR(64) DEFAULT NULL | 来源单号 |
| voucher_no | VARCHAR(64) DEFAULT NULL | 凭证号 |
| payment_date | DATE NOT NULL | 收款日期 |
| operator_id | BIGINT UNSIGNED NOT NULL | 收款人 |
| status | VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' | 状态：COMPLETED/VOIDED |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### 5.1.6 sale_payment（销售收款单表）

*(已在销售管理模块中定义，此处为财务往来引用)*

#### 5.1.7 purchase_payment（采购付款单表）

*(已在采购管理模块中定义，此处为财务往来引用)*

#### 5.1.8 supplier_statement（供应商对账单表）

*(已在采购管理模块中定义，此处为财务往来引用)*

#### 5.1.9 supplier_statement_item（供应商对账明细表）

*(已在采购管理模块中定义，此处为财务往来引用)*

#### 5.1.10 customer_credit（客户授信额度表）

*(已在销售管理模块中定义，此处为财务往来引用)*

#### 5.1.11 collection_record（催收记录表）

*(已在销售管理模块中定义，此处为财务往来引用)*

### 5.2 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/payment/orders | 创建支付单 |
| POST | /api/payment/wx/callback | 微信支付回调 |
| POST | /api/payment/refunds | 创建退款 |
| GET | /api/payment/orders/:payNo | 支付单详情 |
| GET | /api/payment/orders | 支付单列表 |
| GET | /api/customer-payments | 客户收款单列表 |
| GET | /api/customer-payments/:receiptNo | 收款单详情 |
| POST | /api/customer-payments | 创建收款单 |
| POST | /api/customer-payments/:receiptNo/void | 作废收款单 |
| GET | /api/customer-statements | 客户对账单列表 |
| GET | /api/customer-statements/:statementNo | 对账单详情 |
| POST | /api/customer-statements | 创建对账单 |
| POST | /api/customer-statements/:statementNo/confirm | 确认对账单 |
| POST | /api/customer-statements/:statementNo/paid | 标记已结清 |
| GET | /api/purchase-payments | 采购付款单列表 |
| GET | /api/purchase-payments/:paymentNo | 付款单详情 |
| POST | /api/purchase-payments | 创建付款单 |
| POST | /api/purchase-payments/:paymentNo/approve | 审核付款单 |
| POST | /api/purchase-payments/:paymentNo/void | 作废付款单 |
| POST | /api/supplier-statements/generate | 生成供应商对账单 |
| GET | /api/supplier-statements | 供应商对账单列表 |
| GET | /api/supplier-statements/:statementNo | 对账单详情 |
| POST | /api/supplier-statements/:statementNo/confirm | 确认对账单 |
| POST | /api/supplier-statements/:statementNo/dispute | 争议对账单 |
| GET | /api/admin/payment-orders | 支付单列表(Admin) |
| GET | /api/admin/refund-orders | 退款单列表 |
| GET | /api/admin/receivable-payable | 应收应付报表 |
| GET | /api/admin/payment-analysis | 付款分析报表 |
| GET | /api/admin/profit | 利润报表 |
| GET | /api/store/receivables | 门店应收列表 |
| POST | /api/store/receivables/:receivableNo/payment | 门店应收收款 |
| GET | /api/store/collection-links | 门店收款链接 |
| GET | /api/store/payment-orders | 门店支付单 |
| GET | /api/store/refund-orders | 门店退款单 |
| GET | /api/admin/daily-sales-trend | 每日销售趋势 |
| POST | /api/admin/daily-settlements | 创建日结 |
| GET | /api/admin/daily-settlements | 日结列表 |
| GET | /api/admin/daily-settlements/:id | 日结详情 |
| GET | /api/credit/credits | 授信列表 |
| GET | /api/credit/credits/:customerId | 授信详情 |
| POST | /api/credit/credits/:customerId | 初始化授信 |
| GET | /api/credit/credits/:customerId/check | 检查授信 |
| POST | /api/credit/credits/:customerId/occupy | 占用额度 |
| POST | /api/credit/credits/:customerId/release | 释放额度 |
| PUT | /api/credit/credits/:customerId/limit | 调整额度 |
| GET | /api/credit/collections | 催收记录列表 |
| POST | /api/credit/collections | 创建催收记录 |
| GET | /api/credit/collections/overdue | 逾期客户 |
| POST | /api/credit/collections/auto-generate | 自动生成催收 |
| GET | /api/credit/collections/statistics | 催收统计 |
| GET | /api/credit/risk-customers | 风险客户 |

### 5.3 汇总统计

- 表数量：11（含跨模块引用）
- 字段总数：约 180
- API数量：52

---

## 第十一部分：数据报表（原经营分析中心）

**定位**: 经营分析、决策支持。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 经营总览 | 🔴 P0 | 今日/本月关键指标看板 | ~40 | 保留 |
| 2. 销售分析 | 🔴 P0 | 销售趋势、时段分析 | ~45 | 保留 |
| 3. 商品分析 | 🟡 P1 | 畅销/滞销、毛利分析 | ~45 | 保留P1 |
| 4. 客户分析 | 🟡 P1 | 客户贡献、复购分析 | ~35 | 保留P1 |
| 5. 库存分析 | 🟡 P1 | 周转率、库龄分析 | ~30 | 保留P1 |
| 6. 采购分析 | 🟡 P1 | 供应商贡献分析 | ~25 | 保留P1 |
| 7. 财务分析 | 🟡 P1 | 营收、利润分析 | ~30 | 保留P1 |
| 8. 员工绩效分析 | 🟡 P1 | 业务员业绩对比 | ~40 | 保留P1 |
| 9. 在线收款专项分析 | 🔴⭐ P0 | 收款金额、笔数、成功率 | ~50 | 核心差异化，保留 ✅ |
| 10. 自定义报表与导出 | 🟢 P2 | 用户自定义报表 | ~120 | 放P2 |
| **合计** | | | **560** | 适配后保留 ~340 字段 |

### 数据报表 · 字段与表结构详解

> **说明**: 数据报表板块为纯报表聚合层，不建独立业务表。所有报表数据从已有业务表实时聚合计算。
> 报表引擎使用 SQL 视图 + 缓存层，通过看板配置实现灵活展示。

#### 报表视图定义

##### 1. v_daily_sales_summary（销售日报视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| report_date | 计算字段 | 报表日期 |
| store_id | sale_bill | 门店ID |
| total_orders | COUNT(sale_bill.id) | 销售单数 |
| total_amount | SUM(sale_bill.receivable_amount) | 销售金额 |
| total_received | SUM(sale_bill.received_amount) | 已收金额 |
| total_unreceived | SUM(sale_bill.unreceived_amount) | 未收金额 |
| cash_orders | COUNT(CASE WHEN sale_type='CASH') | 现销单数 |
| credit_orders | COUNT(CASE WHEN sale_type='CREDIT') | 赊销单数 |

##### 2. v_daily_collection_analysis（在线收款分析视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| report_date | 计算字段 | 报表日期 |
| total_links | COUNT(collection_link.id) | 分享次数 |
| view_count | SUM(collection_link.view_count) | 查看次数 |
| paid_count | COUNT(CASE WHEN status='PAID') | 支付成功数 |
| paid_amount | SUM(CASE WHEN status='PAID' THEN amount) | 收款金额 |
| conversion_rate | 计算字段 | 转化率（支付/查看） |

##### 3. v_inventory_turnover（库存周转率视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| sku_id | inventory_ledger | SKU ID |
| period | 计算字段 | 统计周期 |
| total_out_qty | SUM(out_qty) | 出库总量 |
| avg_stock | AVG(physical_qty) | 平均库存 |
| turnover_rate | 计算字段 | 周转率 = 出库总量/平均库存 |

##### 4. v_customer_contribution（客户贡献分析视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| customer_id | sale_bill | 客户ID |
| period | 计算字段 | 统计周期 |
| total_amount | SUM(receivable_amount) | 采购总额 |
| order_count | COUNT(id) | 采购次数 |
| avg_order_amount | 计算字段 | 平均客单价 |
| last_order_date | MAX(created_at) | 最近采购日期 |

##### 5. v_supplier_contribution（供应商贡献分析视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| supplier_id | purchase_order | 供应商ID |
| period | 计算字段 | 统计周期 |
| total_amount | SUM(payable_amount) | 采购总额 |
| order_count | COUNT(id) | 采购次数 |
| return_amount | SUM(return_amount) | 退货金额 |

##### 6. v_profit_analysis（利润分析视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| report_date | 计算字段 | 报表日期 |
| sale_amount | sale_bill | 销售收入 |
| sale_cost | 计算字段 | 销售成本 = SUM(sale_bill_item.qty * 成本价) |
| gross_profit | 计算字段 | 毛利 = 销售收入 - 销售成本 |
| gross_margin_rate | 计算字段 | 毛利率 |
| expense_amount | expense | 费用合计 |
| net_profit | 计算字段 | 净利润 = 毛利 - 费用 |

##### 7. v_employee_performance（员工绩效视图）

| 字段名 | 来源 | 说明 |
|--------|------|------|
| operator_id | sale_bill | 业务员ID |
| period | 计算字段 | 统计周期 |
| total_amount | SUM(receivable_amount) | 销售总额 |
| order_count | COUNT(id) | 销售单数 |
| collection_amount | SUM(sale_payment.amount) | 回款金额 |
| collection_rate | 计算字段 | 回款率 |

##### 8. custom_report_template（自定义报表模板表）— P2新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 模板ID |
| name | VARCHAR(128) NOT NULL | 模板名称 |
| type | VARCHAR(32) NOT NULL | 报表类型：SALES/INVENTORY/FINANCE/CUSTOMER |
| config | JSON NOT NULL | 报表配置（指标、维度、筛选条件） |
| creator_id | BIGINT UNSIGNED NOT NULL | 创建人 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 9. custom_report_schedule（定时报表导出表）— P2新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 任务ID |
| template_id | BIGINT UNSIGNED NOT NULL | 模板ID |
| name | VARCHAR(128) NOT NULL | 任务名称 |
| cron_expression | VARCHAR(64) NOT NULL | 定时表达式 |
| export_format | VARCHAR(16) DEFAULT 'EXCEL' | 导出格式：EXCEL/PDF |
| recipients | JSON DEFAULT NULL | 接收人列表 |
| last_run_at | DATETIME DEFAULT NULL | 上次执行时间 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/PAUSED |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/sales-daily | 销售日报 |
| GET | /api/reports/sales-trend | 销售趋势 |
| GET | /api/reports/collection-analysis | 在线收款分析 |
| GET | /api/reports/inventory-turnover | 库存周转率 |
| GET | /api/reports/inventory-aging | 库龄分析 |
| GET | /api/reports/customer-contribution | 客户贡献分析 |
| GET | /api/reports/supplier-contribution | 供应商贡献分析 |
| GET | /api/reports/profit-analysis | 利润分析 |
| GET | /api/reports/employee-performance | 员工绩效 |
| GET | /api/reports/overview | 经营总览 |
| GET | /api/reports/export | 导出报表 |
| GET | /api/reports/custom-templates | 自定义报表模板 |
| POST | /api/reports/custom-templates | 创建自定义模板 |
| PUT | /api/reports/custom-templates/:id | 更新自定义模板 |
| DELETE | /api/reports/custom-templates/:id | 删除自定义模板 |
| GET | /api/reports/schedules | 定时导出任务列表 |
| POST | /api/reports/schedules | 创建定时导出任务 |
| PUT | /api/reports/schedules/:id | 更新定时导出任务 |
| DELETE | /api/reports/schedules/:id | 删除定时导出任务 |

#### 汇总统计

- 核心视图：7
- 数据表：2（仅P2）
- 字段总数：约 180（含视图计算字段）
- API数量：19


---

## 第十二部分：系统设置（原门店、组织与权限 + 系统管理）

**定位**: 门店管理、组织架构、员工管理、角色权限、系统配置。包含原"门店、组织与权限"和原"系统管理"两个板块。

| 二级模块 | 优先级 | 说明 | 字段数 | 适配调整 |
|---------|--------|------|--------:|----------|
| 1. 门店管理 | 🔴 P0 | 门店档案、地址电话 | ~40 | 保留 |
| 2. 组织架构 | 🟡 P1 | 多级组织架构 | ~40 | 连锁需要，放P1 |
| 3. 员工管理 | 🔴 P0 | 员工档案、账号 | ~55 | 保留 |
| 4. 角色权限 | 🔴 P0 | 角色创建、菜单/数据权限 | ~75 | **核心**，我们之前缺失 ✅ |
| 5. 多端登录 | 🟡 P1 | 同一账号多端登录 | ~30 | 放P1 |
| 6. 操作日志审计 | 🔴 P0 | 操作记录留痕 | ~25 | 保留 |
| 7. 数据隔离 | 🟡 P1 | 租户数据隔离 | ~35 | 我们已经规划 tenant_id，保留 |
| 8. 系统参数配置 | 🟡 P1 | 系统参数设置 | ~30 | 保留 |
| 9. 多店调拨与共享 | 🟢 P2 | 跨店库存共享 | ~40 | 连锁需要，放P2 |
| 10. 总部-分店报表权限 | 🟢 P2 | 报表权限矩阵 | 50 | 放P2 |
| **合计** | | | **470** | 适配后保留 ~300 字段 |

### 系统设置 · 字段与表结构详解

#### 数据表定义

##### 1. store（门店表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 门店ID |
| store_code | VARCHAR(64) NOT NULL UNIQUE | 门店编码 |
| name | VARCHAR(128) NOT NULL | 门店名称 |
| short_name | VARCHAR(64) DEFAULT NULL | 简称 |
| type | VARCHAR(32) NOT NULL DEFAULT 'STORE' | 类型：SUPPLIER/DISTRIBUTOR/STORE |
| parent_id | BIGINT UNSIGNED DEFAULT NULL | 上级门店ID |
| province | VARCHAR(64) DEFAULT NULL | 省 |
| city | VARCHAR(64) DEFAULT NULL | 市 |
| district | VARCHAR(64) DEFAULT NULL | 区 |
| address | VARCHAR(255) DEFAULT NULL | 详细地址 |
| contact_name | VARCHAR(64) DEFAULT NULL | 联系人 |
| contact_mobile | VARCHAR(20) DEFAULT NULL | 联系电话 |
| business_license | VARCHAR(128) DEFAULT NULL | 营业执照号 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/INACTIVE |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 2. sys_user（系统用户表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 用户ID |
| username | VARCHAR(64) NOT NULL UNIQUE | 用户名 |
| password_hash | VARCHAR(255) NOT NULL | 密码哈希 |
| real_name | VARCHAR(64) NOT NULL | 真实姓名 |
| mobile | VARCHAR(20) DEFAULT NULL | 手机号 |
| email | VARCHAR(128) DEFAULT NULL | 邮箱 |
| avatar | VARCHAR(512) DEFAULT NULL | 头像 |
| store_id | BIGINT UNSIGNED DEFAULT NULL | 所属门店 |
| department_id | BIGINT UNSIGNED DEFAULT NULL | 所属部门 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/DISABLED/LOCKED |
| last_login_at | DATETIME DEFAULT NULL | 最后登录时间 |
| last_login_ip | VARCHAR(64) DEFAULT NULL | 最后登录IP |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 3. sys_role（系统角色表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 角色ID |
| role_name | VARCHAR(50) NOT NULL UNIQUE | 角色名称 |
| role_code | VARCHAR(50) NOT NULL UNIQUE | 角色编码 |
| description | VARCHAR(200) DEFAULT NULL | 角色描述 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/DISABLED |
| permissions | JSON DEFAULT NULL | 权限列表 |
| data_scope | VARCHAR(32) NOT NULL DEFAULT 'SELF' | 数据范围：ALL/DEPARTMENT/STORE/SELF |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 4. sys_user_role（用户角色关联表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 关联ID |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| role_id | BIGINT UNSIGNED NOT NULL | 角色ID |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 5. sys_permission（系统权限表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 权限ID |
| permission_code | VARCHAR(128) NOT NULL UNIQUE | 权限编码 |
| permission_name | VARCHAR(128) NOT NULL | 权限名称 |
| parent_id | BIGINT UNSIGNED DEFAULT NULL | 父权限ID |
| type | VARCHAR(32) NOT NULL DEFAULT 'MENU' | 类型：MENU/BUTTON/API |
| path | VARCHAR(255) DEFAULT NULL | 前端路由路径 |
| icon | VARCHAR(64) DEFAULT NULL | 图标 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 6. sys_role_permission（角色权限关联表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 关联ID |
| role_id | BIGINT UNSIGNED NOT NULL | 角色ID |
| permission_id | BIGINT UNSIGNED NOT NULL | 权限ID |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 7. sys_config（系统配置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 配置ID |
| config_key | VARCHAR(128) NOT NULL UNIQUE | 配置键 |
| config_value | TEXT DEFAULT NULL | 配置值 |
| config_type | VARCHAR(32) NOT NULL DEFAULT 'STRING' | 配置类型：STRING/NUMBER/JSON/BOOLEAN |
| description | VARCHAR(255) DEFAULT NULL | 配置说明 |
| editable | TINYINT NOT NULL DEFAULT 1 | 是否可编辑 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 8. operation_log（操作日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| user_id | BIGINT UNSIGNED NOT NULL | 操作人ID |
| username | VARCHAR(64) NOT NULL | 操作人用户名 |
| store_id | BIGINT UNSIGNED DEFAULT NULL | 门店ID |
| module | VARCHAR(64) NOT NULL | 操作模块 |
| action | VARCHAR(64) NOT NULL | 操作类型：CREATE/UPDATE/DELETE/LOGIN/EXPORT |
| target_type | VARCHAR(64) DEFAULT NULL | 目标类型 |
| target_id | VARCHAR(64) DEFAULT NULL | 目标ID |
| request_method | VARCHAR(10) DEFAULT NULL | 请求方法 |
| request_url | VARCHAR(255) DEFAULT NULL | 请求URL |
| request_params | JSON DEFAULT NULL | 请求参数 |
| response_status | INT DEFAULT NULL | 响应状态码 |
| ip | VARCHAR(64) DEFAULT NULL | IP地址 |
| user_agent | VARCHAR(512) DEFAULT NULL | 用户代理 |
| duration_ms | INT DEFAULT NULL | 请求耗时 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 9. tenant（租户表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 租户ID |
| tenant_code | VARCHAR(64) NOT NULL UNIQUE | 租户编码 |
| name | VARCHAR(128) NOT NULL | 租户名称 |
| contact_name | VARCHAR(64) DEFAULT NULL | 联系人 |
| contact_mobile | VARCHAR(20) DEFAULT NULL | 联系电话 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/EXPIRED/SUSPENDED |
| expire_at | DATETIME DEFAULT NULL | 到期时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 10. subscription_plan（订阅套餐表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 套餐ID |
| plan_code | VARCHAR(64) NOT NULL UNIQUE | 套餐编码 |
| name | VARCHAR(128) NOT NULL | 套餐名称 |
| description | VARCHAR(500) DEFAULT NULL | 套餐描述 |
| price | DECIMAL(12,2) NOT NULL | 价格 |
| duration_days | INT NOT NULL | 有效期（天） |
| max_stores | INT NOT NULL DEFAULT 1 | 最大门店数 |
| max_users | INT NOT NULL DEFAULT 10 | 最大用户数 |
| features | JSON DEFAULT NULL | 功能列表 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 11. subscription（订阅记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 订阅ID |
| tenant_id | BIGINT UNSIGNED NOT NULL | 租户ID |
| plan_id | BIGINT UNSIGNED NOT NULL | 套餐ID |
| start_date | DATE NOT NULL | 开始日期 |
| end_date | DATE NOT NULL | 结束日期 |
| amount | DECIMAL(12,2) NOT NULL | 实付金额 |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | 状态：ACTIVE/EXPIRED/CANCELLED |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 12. tenant_module_access（租户模块权限表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 权限ID |
| tenant_id | BIGINT UNSIGNED NOT NULL | 租户ID |
| module_code | VARCHAR(64) NOT NULL | 模块编码 |
| access_level | VARCHAR(32) NOT NULL DEFAULT 'READ' | 权限级别：READ/WRITE/ADMIN |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 13. tenant_admin（租户管理员表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 关联ID |
| tenant_id | BIGINT UNSIGNED NOT NULL | 租户ID |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| is_super_admin | TINYINT NOT NULL DEFAULT 0 | 是否超级管理员 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 14. subscription_operation_log（订阅操作日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 日志ID |
| tenant_id | BIGINT UNSIGNED NOT NULL | 租户ID |
| operator_id | BIGINT UNSIGNED NOT NULL | 操作人 |
| action | VARCHAR(64) NOT NULL | 操作类型 |
| detail | JSON DEFAULT NULL | 操作详情 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 15. sys_department（部门表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 部门ID |
| parent_id | BIGINT UNSIGNED DEFAULT NULL | 父部门ID |
| name | VARCHAR(64) NOT NULL | 部门名称 |
| store_id | BIGINT UNSIGNED DEFAULT NULL | 所属门店 |
| sort_order | INT NOT NULL DEFAULT 0 | 排序 |
| status | TINYINT NOT NULL DEFAULT 1 | 状态 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 16. user_session（用户会话表）— P1新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 会话ID |
| user_id | BIGINT UNSIGNED NOT NULL | 用户ID |
| token | VARCHAR(512) NOT NULL | 会话令牌 |
| device_type | VARCHAR(32) DEFAULT NULL | 设备类型：WEB/MINIAPP/IOS/ANDROID |
| device_info | VARCHAR(255) DEFAULT NULL | 设备信息 |
| ip | VARCHAR(64) DEFAULT NULL | IP地址 |
| expires_at | DATETIME NOT NULL | 过期时间 |
| last_activity_at | DATETIME DEFAULT NULL | 最后活跃时间 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 17. transfer_order（调拨单表）— P2新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 调拨单ID |
| transfer_no | VARCHAR(64) NOT NULL UNIQUE | 调拨单号 |
| from_store_id | BIGINT UNSIGNED NOT NULL | 调出门店ID |
| to_store_id | BIGINT UNSIGNED NOT NULL | 调入门店ID |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | 状态：PENDING/APPROVED/SHIPPING/RECEIVED/COMPLETED/CANCELLED |
| goods_amount | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | 商品金额 |
| operator_id | BIGINT UNSIGNED NOT NULL | 制单人 |
| remark | VARCHAR(255) DEFAULT NULL | 备注 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

##### 18. transfer_order_item（调拨单明细表）— P2新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 明细ID |
| transfer_no | VARCHAR(64) NOT NULL | 调拨单号 |
| sku_id | BIGINT UNSIGNED NOT NULL | SKU ID |
| sku_name | VARCHAR(128) NOT NULL | SKU名称快照 |
| box_qty | INT NOT NULL DEFAULT 0 | 箱数 |
| bottle_qty | INT NOT NULL DEFAULT 0 | 瓶数 |
| total_bottle_qty | INT NOT NULL | 合计瓶数 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

##### 19. report_permission_matrix（报表权限矩阵表）— P2新增

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | 权限ID |
| role_id | BIGINT UNSIGNED NOT NULL | 角色ID |
| report_code | VARCHAR(64) NOT NULL | 报表编码 |
| store_scope | VARCHAR(32) NOT NULL DEFAULT 'SELF' | 门店范围：SELF/CHILDREN/ALL |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

#### API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/stores | 门店列表 |
| POST | /api/admin/stores | 创建门店 |
| GET | /api/admin/stores/:id | 门店详情 |
| PUT | /api/admin/stores/:id | 更新门店 |
| DELETE | /api/admin/stores/:id | 删除门店 |
| GET | /api/admin/users | 用户列表 |
| POST | /api/admin/users | 创建用户 |
| GET | /api/admin/users/:id | 用户详情 |
| PUT | /api/admin/users/:id | 更新用户 |
| DELETE | /api/admin/users/:id | 删除用户 |
| POST | /api/admin/users/:id/reset-password | 重置密码 |
| GET | /api/admin/roles | 角色列表 |
| POST | /api/admin/roles | 创建角色 |
| PUT | /api/admin/roles/:id | 更新角色 |
| DELETE | /api/admin/roles/:id | 删除角色 |
| GET | /api/admin/permissions | 权限列表 |
| POST | /api/admin/permissions | 创建权限 |
| PUT | /api/admin/permissions/:id | 更新权限 |
| DELETE | /api/admin/permissions/:id | 删除权限 |
| GET | /api/admin/roles/:id/permissions | 角色权限列表 |
| PUT | /api/admin/roles/:id/permissions | 更新角色权限 |
| GET | /api/admin/configs | 系统配置列表 |
| PUT | /api/admin/configs | 更新系统配置 |
| GET | /api/admin/operation-logs | 操作日志列表 |
| GET | /api/admin/tenants | 租户列表 |
| POST | /api/admin/tenants | 创建租户 |
| PUT | /api/admin/tenants/:id | 更新租户 |
| GET | /api/admin/subscription-plans | 套餐列表 |
| POST | /api/admin/subscription-plans | 创建套餐 |
| PUT | /api/admin/subscription-plans/:id | 更新套餐 |
| GET | /api/admin/subscriptions | 订阅记录列表 |
| POST | /api/admin/subscriptions | 创建订阅 |
| GET | /api/admin/departments | 部门列表 |
| POST | /api/admin/departments | 创建部门 |
| PUT | /api/admin/departments/:id | 更新部门 |
| DELETE | /api/admin/departments/:id | 删除部门 |
| GET | /api/admin/sessions | 在线会话列表 |
| DELETE | /api/admin/sessions/:id | 强制下线 |
| GET | /api/admin/transfer-orders | 调拨单列表 |
| POST | /api/admin/transfer-orders | 创建调拨单 |
| GET | /api/admin/transfer-orders/:no | 调拨单详情 |
| PUT | /api/admin/transfer-orders/:no/status | 更新调拨状态 |
| GET | /api/admin/report-permissions | 报表权限矩阵 |
| PUT | /api/admin/report-permissions | 更新报表权限 |

#### 汇总统计

- 表数量：19（14张已有 + 3张P1新增 + 2张P2新增）
- 字段总数：约 220
- API数量：41

---


---

## 第十三部分：核心数据库表总清单（适配后）

| 一级目录 | 原表数 | 适配后表数 |
|---------|-------:|----------:|
| 商品中心 | 18 | 16 |
| 采购管理 | 14 | 14 |
| 库存管理 | 18 | 18 |
| 销售管理 | 19 | 19 |
| 订单管理 | 10 | 10 |
| 即时零售 | 29 | 29 |
| 客户管理 | 34 | 28 (整合后) |
| 营销中心 | 22 | 18 (删减后) |
| 财务往来 | 28 | 24 |
| 数据报表 | 15 | 15 |
| 门店管理 | 30 | 26 |
| **合计** | **237** | **217** |

删减了 20 张不适合酒水行业或远期的表（套装、秒杀拼团、社群营销等），新增 2 张（批量调价表、报价推送表）。

---

## 第十四部分：规模统计（适配后）

### 总体统计

| 项目 | 原全行业模板 | 酒水适配版 |
|------|-------------:|-----------:|
| 一级目录 | 11 | **12**（保持我们原有结构） |
| 二级模块 | 104 | 108 |
| 三级菜单 | 752 | ~740 |
| 总字段数 | ~5880 | **~4140** |
| 数据库表 | 237 | **217** |

### P0 字段统计（基础版 MVP）

| 一级目录 | P0 模块数 | P0 字段数 |
|---------|----------:|----------:|
| 商品中心 | 8 | ~320 |
| 采购管理 | 5 | ~200 |
| 库存管理 | 8 | ~310 |
| 销售管理 | 7 | ~400 |
| 订单管理 | 5 | ~180 |
| 即时零售 | 15 | ~680 |
| 客户管理 | 4 | ~200 |
| 营销中心 | 0 | 0 |
| 财务往来 | 6 | ~220 |
| 数据报表 | 2 | ~80 |
| 系统设置 | 6 | ~260 |
| **合计** | **66** | **~2850** |

### 优先级分布

| 优先级 | 模块数 | 字段数 |
|--------|-------:|-------:|
| 🔴 P0（基础版） | 66 | ~2850 |
| 🟡 P1（进阶版） | 28 | ~830 |
| 🟢 P2（连锁版） | 14 | ~460 |
| **合计** | 108 | **~4140** |

### 四大差异化抓手（更新）

1. **单据分享与在线收款闭环 ⭐⭐**（销售管理）
   - 分享收款链接 → 微信支付 → 状态自动同步

2. **小程序B端批发下单 + 即时零售 ⭐⭐**（即时零售）
   - 小程序C端零售 + B端批发客户自助采购 + 60秒接单工作台 + 实时库存原子扣减防超卖

3. **三端数据闭环 + 角色权限矩阵 ⭐⭐**（全系统）
   - 供应商→二批→门店三级渠道闭环 + 价格分层隔离 + 商业机密保护 + 8种角色权限

4. **商品详情全链路同步 ⭐⭐**（三端联动 · 新增）
   - 上游发布商品详情，名下所有下游自动同步，无需逐级重复录入，冲突可控

---

## 第十五部分：酒水行业适配说明

### 删除/延后的内容（不适合酒水批发）

1. **套装与组合品** → 🟢 P2（礼盒需要但不是必须）
2. **秒杀拼团** → 🟢 P2（不适合批发，门店零售也不需要）
3. **社群营销/分销** → 🟢 P2（酒水行业不适用裂变分销）
4. **商品审核工作流** → 🟢 P2（中小经销商不需要）
5. **自定义报表** → 🟢 P2（老板不需要自定义）

### 保留强化的内容（酒水行业必须）

1. **箱/瓶双单位** ✅ → 酒水基本包装单位
2. **酒精度/产地** 字段 ✅ → 商品必备属性
3. **采购退货（临期）** ✅ → 临期品必须退给供应商
4. **批次追溯** 🟡 P1 → 白酒需要批次
5. **保质期管理** 🟡 P1 → 啤酒饮料需要
6. **单据分享与在线收款** 🔴 P0 ✅ → 解决批发欠款痛点
7. **供应商对账/客户对账** 🔴 P0 ✅ → 酒水行业对账频繁

### 结构调整

| 调整 | 说明 |
|------|------|
| 一级目录保持 12 个 | 我们原结构不变 |
| 一级目录名统一 4 个字 | 工作台→工作总台，财务管理→财务往来，营销推广→营销中心，系统管理→系统设置 |
| 客户与会员整合到客户管理 | 完成 |
| 财务与往来整合为财务往来 | 原财务管理改名，完成 |
| 全渠道订单中心整合到订单管理 | 保留结构，内容完善，完成 |
| 门店管理保留在系统设置下 | 不独立为一级目录，完成 |

---

## 第十六部分：下一步开发优先级建议

| P0 优先级 | 模块 | 字段数 | 说明 |
|---------|------|-------:|------|
| 🔴 P0-1 | 商品中心全模块 | 320 | 基础数据必须先做 |
| 🔴 P0-2 | 采购管理核心 | 200 | 采购流程闭环 |
| 🔴 P0-3 | 库存管理核心 | 250 | 库存账闭环 |
| 🔴 P0-4 | 销售管理 + 分享收款 | 400 | **核心差异化，必须MVP带出去** |
| 🔴 P0-5 | 系统设置核心 | 260 | 门店管理、员工管理、角色权限 |
| 🔴 P0-6 | 财务往来核心 | 220 | 应收应付对账 |
| 🔴 P0-7 | 客户管理核心 | 200 | B+C客户统一 |
| 🔴 P0-8 | 即时零售核心 | 280 | 做了即时零售才能接外卖流量 |
| 🔴 P0-9 | 订单管理核心 | 180 | 全渠道订单聚合 |
| 🔴 P0-10 | 数据报表核心 | 80 | 经营看板 |
| **P0 合计** | | **2390** | |

> **结论**: 基础版 MVP 完成后，系统可以支撑酒水饮料经销商"采购→库存→销售→收款→对账"全流程闭环，加上即时零售流量入口和分享收款差异化。

---

## 第十六部分：三端数据闭环（供应商→二批→门店）

**定位**: 上游供应商、二级批发商、零售门店三级渠道的供货、价格、库存、订单、对账全链路打通，同时严格隔离各层级商业机密。

**核心原则**: 交易双方互相可见本次成交价格，跨层级完全隐藏。各商户私有经营数据（销售、库存、毛利、客户）永久隔离。

### 三端角色定义

| 角色 | 系统端 | 身份说明 |
|------|--------|---------|
| 上游供应商 | 供应商端 | 品牌方/总代理，向下游二批供货 |
| 二级批发商（二批） | 管理后台 | 从供应商拿货，向零售门店分销 |
| 零售门店 | 门店终端 + 小程序 | 从二批进货，零售给C端消费者 |

---

### 16.1 价格可见性规则（核心）

| 交易关系 | 可见价格 | 不可见 |
|---------|---------|--------|
| 供应商 ↔ 二批 | 双方互看【供应商出厂供货价】 | 零售门店看不到出厂价 |
| 二批 ↔ 零售门店 | 双方互看【二批给门店的批发供货价】 | 供应商看不到二批供货价 |
| 门店 ↔ C端消费者 | 消费者看【零售价】 | 供应商、二批均看不到门店零售价 |
| 跨层级查询 | — | 系统拦截：门店查厂家底价、供应商查二批供货价、供应商查门店零售价，全部拒绝 |

---

### 16.2 商品中心 - 价格分层同步

**实现方式**: 同一商品 SPU/SKU，价格字段按角色分层存储和定向同步。

| 价格层级 | 设置方 | 可见方 | 存储位置 |
|---------|--------|--------|---------|
| 出厂供货价 | 供应商 | 供应商 + 对应二批 | 供应商商品表，定向同步到二批 |
| 二级批发价 | 二批 | 二批 + 对应门店 | 二批商品表，定向同步到门店 |
| 门店零售价 | 门店 | 仅门店自身 | 门店本地，不上传不共享 |

**商品同步规则**:
- 基础公开字段（名称、规格、条码、图片）全链路同步
- 价格字段按角色定向同步，不广播
- 价格变更仅推送交易对方，不会通知第三方

---

### 16.2a 商品详情同步（三端联动）⭐⭐

**定位**: 上游发布商品详情（主图、详情图、规格参数、商品描述），名下所有下游渠道自动同步，无需逐级手动录入。

**核心价值**: 经销/二批发布一次商品详情，名下所有终端店即时同步，解决"同一商品各级重复录入图片和详情"的痛点。

#### 同步层级

| 发布方 | 同步范围 | 同步内容 |
|--------|---------|---------|
| 品牌方/供应商 | 名下所有二批 | 商品基础信息（名称/规格/条码/图片/详情图/商品描述） |
| 二批（经销商） | 名下所有终端门店 | 商品基础信息 + 二批自定义的营销文案 |
| 终端门店 | 本店小程序 | 继承二批商品详情，可叠加本店零售价和促销标签 |

#### 同步规则

| 字段类型 | 同步方式 | 下游可修改 |
|---------|---------|:---:|
| 商品名称、条码、规格 | 全链路强制同步 | ✗ 不可修改 |
| 商品主图、轮播图 | 全链路同步 | ✓ 可追加本店图片 |
| 商品详情图（富文本） | 全链路同步 | ✓ 可追加营销内容 |
| 商品参数（酒精度、产地等） | 全链路强制同步 | ✗ 不可修改 |
| 品类分类 | 全链路同步 | ✓ 可追加本店分类标签 |
| 各层级价格 | 定向同步（仅交易双方） | ✓ 各自设定 |
| 库存数量 | 定向同步（仅下单可见） | ✓ 各自管理 |

#### 同步触发机制

| 触发场景 | 操作 |
|---------|------|
| 上游发布新商品 | 自动推送至名下所有下游商户，下游收到通知后可一键上架 |
| 上游更新商品详情 | 自动推送更新，下游可选择"立即同步"或"保留本地版本" |
| 上游下架商品 | 推送下架通知，下游可选择"同步下架"或"保留本地（不补货）" |
| 下游拒绝同步 | 该商品在下游保持独立，不再接收该商品的上游更新 |

#### 同步控制

- **同步开关**: 下游可设置"自动同步商品详情"全局开关，默认开启
- **逐商品控制**: 下游可对单个商品设置"锁定本地版本"（不再接收上游更新）
- **冲突处理**: 下游已修改且上游更新的字段 → 提示冲突，由下游选择保留哪个版本
- **同步日志**: 每次同步记录操作时间、操作人、同步内容摘要

> **与价格同步的区别**：价格同步是定向的（仅交易双方），商品详情同步是全链路向下的（供应商→名下二批→名下终端店），不做跨层级隐藏。

---

### 16.3 库存中心 - 多级库存可见性

| 库存层级 | 可见方 | 不可见方 |
|---------|--------|---------|
| 供应商完整库存、成本台账 | 供应商私有 | 二批、门店不可见 |
| 供应商可下单库存数量 | 供应商 + 对应二批 | 门店不可见 |
| 二批中转库存、采购成本 | 二批私有 | 供应商、门店不可见 |
| 二批可下单库存数量 + 门店批发价 | 二批 + 对应门店 | 供应商不可见 |
| 门店完整库存、损耗、临期明细 | 门店私有 | 供应商、二批不可见 |
| 门店零售销售数据 | 门店私有 | 供应商、二批不可见 |

**库存同步规则**:
- 下单必要信息（可用库存、双边成交批发价）仅交易双方互通
- 完整库存台账、库存成本永久隔离
- AI补货运算在门店本地完成，仅生成采购申请单，不上传销量/库存明细

---

### 16.4 订单中心 - 多级订单协同

**订单分为两类，数据流严格拆分**:

| 订单类型 | 数据流 | 价格可见性 |
|---------|--------|-----------|
| ① 流通采购单 | 门店→二批→供应商 | 仅交易双方互通，展示二者专属成交价格 |
| ② 门店零售单 | 门店本地 | 本地私有，不向上游任何层级同步 |

**门店下单（向二批采购）**:
- 线上发起采购，订单自动展示【二批给门店的批发价】
- 采购单据仅门店与对应二批互相可见
- 单据内只包含双方成交批发价，无厂家底价、门店零售价

**二批订单处理**:
- 接收门店采购单，可查看双方约定门店批发价
- 汇总门店订单向上游供应商下单，展示【厂家给二批的出厂价】
- 无法查看门店零售价、门店零售流水

**供应商订单处理**:
- 接收二批采购单，可见双方约定出厂供货价
- 无法查看二批卖给门店的二级批发价
- 出库单据仅同步货品追溯信息，不携带下游成交价格

---

### 16.5 财务往来 - 多级对账

| 对账关系 | 可见方 | 不可见方 |
|---------|--------|---------|
| 门店 ↔ 二批对账 | 门店 + 二批（展示门店采购批发价、欠款） | 供应商无法查看 |
| 二批 ↔ 供应商对账 | 二批 + 供应商（展示出厂供货价、应付货款） | 门店无法查看 |
| 门店零售应收欠款 | 仅门店自身 | 供应商、二批不可见 |

---

### 16.6 追溯码 - 全链路追货不追价

- 追溯码记录：供应商→二批→门店的货品流转主体
- 所有追溯记录不附带任何层级成交价格
- 消费者扫码仅展示货源渠道名称，无成本/供货价等敏感信息
- 窜货预警仅推送对应货品所属上游，不含商户定价/经营数据

---

### 16.7 权限分层管控

| 角色 | 可见 | 不可见 |
|------|------|--------|
| 供应商 | 自有商品、自有库存、与二批的采购订单（出厂价）、脱敏品类采购汇总 | 二批拿货成本、二批卖门店价、门店库存、门店销售、门店客户 |
| 二批 | 厂家给自己的出厂价、自有库存、门店向自己采购订单（门店批发价）、门店应付货款 | 门店零售价、门店零售流水、厂家内部成本、其他二批数据 |
| 门店 | 二批给自己的采购批发价、本店完整进销存、收银、客户、本店采购单据 | 厂家出厂底价、二批中间成本、其他门店经营数据 |
| 平台管理员 | 默认脱敏所有商户价格与经营机密 | 完整数据需商户主动授权 |

---

### 16.8 底层中间件支撑

| 中间件 | 功能 |
|--------|------|
| 分字段定向同步 | 仅将「交易双方成交价格」定向推送给下单方，不广播不跨层级 |
| 离线兼容 | 门店断网可独立开单，联网仅同步采购单据（含双边批发价），零售数据本地留存 |
| 越权拦截引擎 | 自动拦截跨层级价格查询（门店查厂家底价→拒绝、供应商查二批供货价→拒绝） |
| 数据分层存储 | 流通采购单据云端隔离存储；商户私有经营数据本地加密存储 |

---

### 16.9 商业闭环总结

```
满足下单刚需：
  采购交易的两方，互相可见二者之间的专属供货价，下单、核算、对账无阻碍

杜绝机密泄露：
  跨层级看不到中间价、成本、利润、终端零售数据
  - 门店只能看二批给它的价，看不到厂家底价
  - 二批能看厂家给它的价，但厂家看不到二批卖给门店的价
  - 供应商永远看不到门店终端零售价和零售流水

业务闭环：
  订单、库存、追溯、对账完整打通形成渠道闭环
  同时各商户的差价、毛利、终端经营数据完全隔离
```

---

## 第十七部分：平台总后台（SaaS 运营方超级管理端）

**定位**: 独立于商家端的前端项目，运营方（我们）管理所有租户、套餐、订阅、平台经营数据。域名 `saas.onepan.cn`。

**原则**: 平台管理员默认脱敏所有商户价格与经营机密，完整数据需商户主动授权。

### 二级模块总览

| 二级模块 | 优先级 | 说明 | 字段数 |
|---------|--------|------|--------:|
| 1. 租户管理 | 🔴 P0 | 入驻审核、开通/停用/到期、租户列表 | ~55 |
| 2. 套餐管理 | 🔴 P0 | 套餐定义、功能开关、定价配置 | ~45 |
| 3. 订阅管理 | 🔴 P0 | 租户订阅记录、续费、升级/降级 | ~40 |
| 4. 平台经营看板 | 🔴 P0 | 总租户数、活跃租户、收入统计 | ~35 |
| 5. 平台配置 | 🔴 P0 | 全局参数、公告管理、系统维护模式 | ~30 |
| 6. 操作日志 | 🟡 P1 | 平台管理员操作日志 | ~20 |
| 7. 平台消息 | 🟡 P1 | 全局公告推送、到期提醒 | ~25 |
| **合计** | | | **~250** |

---

### 1. 租户管理

> 优先级：🔴 P0 | 定位：所有入驻商户的全生命周期管理

**三级菜单**: 租户列表 / 入驻审核 / 租户详情

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 租户列表 | 租户名称、联系人、手机号、套餐、到期时间、状态（正常/欠费/停用/试用） | 支持搜索、筛选、批量操作 |
| 入驻审核 | 申请时间、公司信息、资质文件、审核状态、审核意见 | 商户注册后需平台审核通过才可开通 |
| 租户详情 | 基本信息、订阅历史、员工数、门店数、最近登录时间 | 完整租户档案 |

**操作权限**:
- 开通：创建租户 + 初始化数据库（tenant_id 隔离）
- 停用：冻结租户，所有端登录拒绝
- 续费：手动延长到期时间
- 删除：软删除，数据保留 N 天后清理

---

### 2. 套餐管理

> 优先级：🔴 P0 | 定位：定义 SaaS 套餐的功能范围和定价

**三级菜单**: 套餐列表 / 新建套餐 / 功能开关配置

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 套餐列表 | 套餐名称、价格、租户数、状态 | 基础版/进阶版/连锁版 |
| 新建套餐 | 套餐名称、价格（待定）、功能模块勾选、有效期 | 可灵活组合功能模块 |
| 功能开关配置 | 12 个一级模块的启用/禁用开关 | 按套餐粒度控制功能可见性 |

**功能开关示例**:
```
基础版: 工作总台 + 销售管理 + 采购管理 + 库存管理 + 客户管理 + 商品中心 + 系统设置
进阶版: 基础版 + 财务往来 + 数据报表 + 订单管理
连锁版: 进阶版 + 即时零售 + 营销中心 + 三端数据闭环
```

---

### 3. 订阅管理

> 优先级：🔴 P0 | 定位：租户订阅记录、续费、升降级

**三级菜单**: 订阅记录 / 续费管理 / 升级/降级

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 订阅记录 | 租户、套餐、开始时间、到期时间、金额、支付状态 | 每个租户的订阅历史 |
| 续费管理 | 续费套餐、续费时长、金额 | 手动续费或自动续费开关 |
| 升级/降级 | 当前套餐 → 目标套餐、差价、生效时间 | 套餐变更，功能开关自动调整 |

---

### 4. 平台经营看板

> 优先级：🔴 P0 | 定位：运营方视角的全局数据

**三级菜单**: 核心指标 / 租户趋势 / 收入统计

| 三级菜单 | 关键指标 | 说明 |
|---------|---------|------|
| 核心指标 | 总租户数、活跃租户数、今日新增、试用中、到期预警 | 一目了然的经营大盘 |
| 租户趋势 | 新增租户曲线、活跃租户曲线、流失率 | 按日/周/月维度 |
| 收入统计 | 总营收、本月营收、各套餐收入占比 | 脱敏汇总数据 |

---

### 5. 平台配置

> 优先级：🔴 P0 | 定位：运营方的全局参数管理

**三级菜单**: 全局参数 / 公告管理 / 维护模式

| 三级菜单 | 关键字段 | 说明 |
|---------|---------|------|
| 全局参数 | 试用期天数、到期提前提醒天数、默认套餐 | 系统级配置 |
| 公告管理 | 公告标题、内容、生效范围（全部/按套餐）、置顶 | 全平台公告推送 |
| 维护模式 | 维护开关、维护提示文案、白名单 IP | 系统升级时启用 |

---

### 6. 操作日志（P1）

> 平台管理员的操作记录：登录、租户操作、套餐变更、配置修改等。

### 7. 平台消息（P1）

> 全局公告推送、租户到期提醒、续费提醒等消息管理。

---

### 技术实现

| 项目 | 说明 |
|------|------|
| 项目名 | `saas-admin`（平台总后台前端项目） |
| 技术栈 | Vue 3 + Vite + Element Plus（与 admin-web 一致） |
| 部署域名 | `saas.onepan.cn` |
| 后端 API | 复用现有后端，新增 `platform.routes.ts`（平台管理专用路由） |
| 数据隔离 | 平台管理员跨租户查看，但默认脱敏价格和经营数据 |
| 权限 | 独立的平台管理员角色，不属于任何租户 |

---

## 第十八部分：模块式开发排期（V4.4 基于实际完成度）

**V4.4 更新说明**: 新增平台总后台（saas-admin），作为独立前端项目。后端胖路由拆分已完成（admin.routes.ts 2847→83行），多租户隔离代码已合并但迁移脚本待补。

**开发原则**: 逐模块推进，上一个模块全部完善后再启动下一个。
**验收标准**: 每个模块完成后，可独立演示和验收。

### 当前完成度总览

| 端 | 完成度 | 说明 |
|----|:---:|------|
| 后端 API | 端点齐全 | 胖路由拆分已完成（admin.routes.ts 2847→83行），迁移脚本待补 |
| 商家移动端 (merchant-mobile) | 100% | 35个视图页面，含采购/销售/库存/客户/对账/设置 |
| 门店终端 (store-terminal) | 100% | 11个视图页面，含收银/订单/库存/报表 |
| 管理后台 (admin-web) | 55% | 26个完整视图 + 24个视图待补齐 |
| 平台总后台 (saas-admin) | 0% | 全新项目，待从零搭建 |

### 管理后台待补齐视图（21个占位 + 3个新增）

| 优先级 | 一级目录 | 视图 | 状态 |
|:---:|------|------|:---:|
| 🔴 P0 | 商品中心 | ProductCategories（商品分类管理） | ⏳ 占位 |
| 🔴 P0 | 采购管理 | PurchaseReturns（采购退货） | ⏳ 占位 |
| 🔴 P0 | 采购管理 | PurchasePayments（采购付款） | ⏳ 占位 |
| 🔴 P0 | 库存管理 | InventoryCheck（库存盘点） | ⏳ 占位 |
| 🔴 P0 | 库存管理 | InventoryTransfer（库存调拨） | ⏳ 占位 |
| 🔴 P0 | 库存管理 | **InventoryBatchPrice（批量价格调整）** ⭐ | 🆕 新增 |
| 🔴 P0 | 库存管理 | **InventoryPriceQuote（一键报价推送）** ⭐ | 🆕 新增 |
| 🔴 P0 | 系统设置 | SystemRoles（角色权限管理） | ⏳ 占位 |
| 🟡 P1 | 库存管理 | InventoryBatch（批次追溯） | ⏳ 占位 |
| 🟡 P1 | 财务往来 | FinanceCollection（收款链接管理） | ⏳ 占位 |
| 🟡 P1 | 财务往来 | FinanceProfit（经营利润） | ⏳ 占位 |
| 🟡 P1 | 数据报表 | ReportsProducts（商品排行） | ⏳ 占位 |
| 🟡 P1 | 数据报表 | ReportsEmployees（员工业绩） | ⏳ 占位 |
| 🟡 P1 | 数据报表 | ReportsStores（门店对比） | ⏳ 占位 |
| 🟡 P1 | 营销中心 | MarketingPromotion（促销活动） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailConfig（小程序配置） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailShelf（商品货架） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailOrders（小程序订单） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailPayment（在线支付） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailDelivery（配送管理） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailReport（零售报表） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailPlatform（平台对接） | ⏳ 占位 |
| 🟡 P1 | 即时零售 | InstantRetailOrderBoard（60秒接单） | ⏳ 占位 |

### 平台总后台待开发（saas-admin · 全新项目）

| 优先级 | 模块 | 视图 | 状态 |
|:---:|------|------|:---:|
| 🔴 P0 | 租户管理 | TenantList（租户列表/审核/详情） | 🆕 待开发 |
| 🔴 P0 | 套餐管理 | PlanList（套餐定义/功能开关） | 🆕 待开发 |
| 🔴 P0 | 订阅管理 | SubscriptionList（订阅记录/续费/升降级） | 🆕 待开发 |
| 🔴 P0 | 平台看板 | PlatformDashboard（经营指标/趋势/收入） | 🆕 待开发 |
| 🔴 P0 | 平台配置 | PlatformConfig（全局参数/公告/维护模式） | 🆕 待开发 |

### 补齐排期

| 阶段 | 内容 | 负责人 | 工时 | 依赖 |
|:---:|------|--------|:---:|------|
| **M0-00** | 阿坚胖路由继续拆分（12个文件） | 阿坚 | 8天 | 无 |
| **M0-01~07** | 多租户隔离（迁移脚本补全 + 验证） | 阿坚 | 5天 | M0-00 |
| **M0-08~11** | 权限与安全（RBAC + 越权拦截 + 同步中间件） | 阿坚 | 10天 | M0-01~07 |
| **NEW** | 批量调价API + 一键报价推送API | 阿坚 | 3天 | M0-08~11 |
| **P0** | 墨 P0 安全修复（LoginView + router） | 墨 | 1天 | 无 |
| **M0-FE** | 墨配合前端权限对接 + PC端统一切换 | 墨 | 2天 | M0-08~11 |
| **PLAT-API** | 阿坚 平台总后台后端 API（platform.routes.ts） | 阿坚 | 3天 | M0-01~07 |
| **G1** | 墨 P0缺口补齐（8个视图） | 墨 | 22天 | M0-FE |
| **G2** | 墨 P1缺口补齐（7个视图） | 墨 | 12天 | G1 |
| **PLAT-FE** | 墨 平台总后台前端（saas-admin 5个P0页面） | 墨 | 15天 | PLAT-API |
| **G3** | 阿澈 即时零售（8个视图） | 阿澈 | 22天 | M0-FE |
| **G4** | 阿澈 营销中心 | 阿澈 | 8天 | G3 |
| **G5** | 苏然 全局验收回归 | 苏然 | 5天 | 全部 |

| 里程碑 | 内容 | 累计工时 | 验收标准 | 状态 |
|--------|------|:---:|---------|:---:|
| M0 · 胖路由 | 12个文件拆分 + 分层模板 | 8天 | 所有路由 ≤500行 | 🔴 |
| M1 · 多租户 | 迁移脚本补全 + 隔离验证 | 13天 | 租户A数据租户B不可见 | 🔴 |
| M2 · 权限安全 | RBAC + 越权拦截 + 同步 | 23天 | 越权返回403，价格跨层隐藏 | 🔴 |
| M3 · 底层完成 | 新增API + 安全修复 + PC统一 | 29天 | 底层架构全部就绪 | ⏳ |
| M4 · 平台总后台 | 后端API + 前端5页面 | 44天 | 租户管理/套餐/订阅/看板/配置可用 | ⏳ |
| M5 · 前端补齐 | G1~G4 全部视图 | 112天 | 管理后台 + 即时零售 + 营销中心完整 | ⏳ |
| M6 · 全局收尾 | 细节打磨 + 全端验收 | 117天 | 全端功能完整 | ⏳ |
| **总工期** | | **~117天** | | |

### 已有完整视图（26个 · 不做重复工作）

> 以下视图已完整实现，仅需细节打磨（字段对齐、校验完善、交互优化），不需要重新开发。

| 一级目录 | 已完整视图 | 数量 |
|------|------|:---:|
| 工作总台 | Dashboard | 1 |
| 销售管理 | SalesOrderCreate, SaleBills, SaleReturns, Collection | 4 |
| 订单管理 | Orders, OrderBoard, OrderTimeout | 3 |
| 采购管理 | PurchaseOrders, PurchaseInStocks, Suppliers | 3 |
| 库存管理 | Inventory, InventoryAlerts | 2 |
| 客户管理 | Customers, Credit | 2 |
| 商品中心 | Products, Prices | 2 |
| 财务往来 | Payments, CustomerStatements | 2 |
| 数据报表 | Reports | 1 |
| 营销中心 | Marketing, Aftersale | 2 |
| 系统设置 | Employees, Stores, AuditLog, System | 4 |
| **合计** | | **26** |

---

**文件位置**: `/workspace/liquor-inventory-system/docs/product-spec-v6-adapted.md`
