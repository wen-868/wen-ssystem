# 智享营销系统 - 表单字段开发手册 V1.0

> **用途：** 每个开发任务对应的表单字段清单，同事拿到即可直接开发。
> **关联文档：** 产品功能规划V3.0、任务分配单V2.0、开发工作安排V1.0

---

## 一、字段类型规范

| 前端类型 | Element Plus 组件 | 说明 |
|---------|------------------|------|
| text | `<el-input>` | 普通文本输入 |
| longtext | `<el-input type="textarea">` | 长文本 |
| number | `<el-input-number>` | 整数 |
| decimal | `<el-input-number :precision="3">` | 小数（3位精度） |
| money | `<el-input-number :precision="2">` | 金额（2位精度） |
| percent | `<el-input-number :precision="2">` + `%` | 百分比 |
| date | `<el-date-picker type="date">` | 日期 |
| datetime | `<el-date-picker type="datetime">` | 日期时间 |
| select | `<el-select>` | 单选下拉 |
| multi-select | `<el-select multiple>` | 多选下拉 |
| search-select | `<el-select filterable remote>` | 搜索选择 |
| radio | `<el-radio-group>` | 单选按钮 |
| checkbox | `<el-checkbox-group>` | 多选框 |
| toggle | `<el-switch>` | 开关 |
| upload | `<el-upload>` | 文件上传 |
| image | `<el-upload>` + 图片预览 | 图片上传 |
| barcode | `<el-input>` + 扫码按钮 | 条码输入 |
| signature | 手写签名组件 | 签名 |
| richtext | 富文本编辑器 | 富文本 |
| formula | 只读展示 | 公式计算字段 |

---

## 二、工作台模块

### 2.1 工作台首页（P0-11）

**页面：** `admin-web/src/views/DashboardView.vue`

**数据卡片区域（4个卡片）：**

| 字段 | 类型 | 数据来源 | 说明 |
|------|------|---------|------|
| 今日营业额 | money | `SELECT SUM(total_amount) FROM sale_bill WHERE DATE(created_at)=CURDATE()` | 蓝渐变卡片 |
| 今日订单数 | number | `SELECT COUNT(*) FROM sale_bill WHERE DATE(created_at)=CURDATE()` | 绿渐变卡片 |
| 本月营业额 | money | `SELECT SUM(total_amount) FROM sale_bill WHERE MONTH(created_at)=MONTH(CURDATE())` | 紫渐变卡片 |
| 本月毛利 | money | `SELECT SUM(total_amount - cost_amount) FROM sale_bill WHERE MONTH(created_at)=MONTH(CURDATE())` | 橙渐变卡片 |

**待办事项列表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 待审批单据 | number | `approval_record` 表中 status=PENDING 的数量 |
| 待出库订单 | number | `sale_bill` 中 status=APPROVED 未出库数量 |
| 待收款订单 | number | `sale_bill` 中 collection_status=UNPAID 数量 |
| 库存预警 | number | `inventory_balance` 中 available_qty <= warning_threshold 数量 |

**快捷入口按钮（8个）：**

| 按钮 | 跳转路由 | 图标 |
|------|---------|------|
| 快速开单 | `/sale/create` | Plus |
| 采购入库 | `/purchase/in-stock` | Box |
| 客户管理 | `/customer/list` | User |
| 商品查询 | `/product/list` | Search |
| 库存盘点 | `/inventory/check` | Clipboard |
| 收款记账 | `/finance/collection` | Money |
| 数据报表 | `/report/sales` | Chart |
| 系统设置 | `/system/config` | Setting |

---

## 三、销售管理模块

### 3.1 收银台界面（P0-03）

**页面：** `admin-web/src/views/CashierView.vue`

**左侧 - 商品搜索区：**

| 字段 | 类型 | 必填 | 校验 | 说明 |
|------|------|------|------|------|
| 商品搜索 | search-select | 否 | -- | 按名称/编码/条码模糊搜索，支持扫码枪输入 |
| 商品分类筛选 | select | 否 | -- | 一级分类下拉 |

**中间 - 购物车列表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 商品名称 | text | 自动 | 显示商品名+规格 |
| 单位 | select | 是 | 大单位/小单位切换 |
| 数量 | decimal | 是 | 精度3位，支持键盘快捷键 |
| 单价 | money | 是 | 自动带出默认售价，可修改 |
| 小计 | formula | 自动 | = 数量 × 单价 |
| 删除按钮 | -- | -- | 移除该行 |

**右侧 - 结算区：**

| 字段 | 类型 | 必填 | 校验 | 说明 |
|------|------|------|------|------|
| 客户选择 | search-select | 是 | fk(客户表) | 散客/会员搜索选择 |
| 销售员 | search-select | 否 | fk(员工表) | 默认当前登录人 |
| 商品金额合计 | formula | 自动 | -- | = SUM(小计) |
| 整单折扣 | percent | 否 | range[0,100] | 百分比折扣 |
| 抹零金额 | money | 否 | -- | 手动输入抹零 |
| 应收金额 | formula | 自动 | -- | = 商品金额 × (1-折扣) - 抹零 |
| 支付方式 | radio | 是 | -- | CASH/WECHAT/ALIPAY/BANK/CREDIT |
| 实收金额 | money | 是 | -- | 现金时必填 |
| 找零金额 | formula | 自动 | -- | = 实收 - 应收 |
| 备注 | text | 否 | -- | 订单备注 |
| 提交按钮 | -- | -- | -- | 创建销售单 |

### 3.2 PC端销售开单（P0-04）

**页面：** `admin-web/src/views/SaleOrderCreateView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 客户 | search-select | 是 | fk(客户表) | -- | 名称/电话/编码模糊搜索 |
| 销售类型 | radio | 是 | -- | CASH | CASH=现销/CREDIT=赊销 |
| 应收截止日期 | date | 条件 | -- | +30天 | CREDIT时必填 |
| 销售员 | search-select | 否 | fk(员工表) | 当前用户 | -- |
| 交货方式 | select | 否 | -- | SELF | SELF=自提/DELIVERY=配送/EXPRESS=快递 |
| 交货日期 | date | 否 | -- | 今天 | -- |
| 备注 | longtext | 否 | -- | -- | -- |

**商品明细区（动态表格）：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 商品 | search-select | 是 | fk(商品表) | -- | 名称/编码/条码搜索 |
| 单位 | select | 是 | enum(商品多单位) | 默认单位 | 可切换大/小单位 |
| 数量 | decimal | 是 | range[0.001,999999] | 1 | 精度3位 |
| 单价 | money | 是 | range[0,999999.99] | 自动落价 | 改价需权限 |
| 折扣率 | percent | 否 | range[0,100] | 0 | 行级折扣 |
| 折后单价 | formula | 自动 | -- | -- | = 单价 × (1-折扣率) |
| 税率 | select | 是 | enum{0,6,9,13} | 商品默认 | 增值税率 |
| 税额 | formula | 自动 | -- | -- | = 折后单价×数量×税率/(1+税率) |
| 小计金额 | formula | 自动 | -- | -- | = 折后单价 × 数量 |

**金额汇总区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 含税合计 | formula | = SUM(小计金额) |
| 不含税合计 | formula | = 含税合计 - 税额合计 |
| 税额合计 | formula | = SUM(税额) |
| 整单折扣 | percent | 整单折扣率 |
| 优惠金额 | money | 手动输入优惠 |
| 抹零金额 | money | 手动输入抹零 |
| 应收金额 | formula | = 含税合计 × (1-整单折扣) - 优惠 - 抹零 |

### 3.3 订单状态泳道看板（P0-13）

**页面：** `admin-web/src/views/OrderKanbanView.vue`

**筛选区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 日期范围 | date-range | 下单日期筛选 |
| 客户 | search-select | 客户筛选 |
| 销售员 | search-select | 销售员筛选 |
| 订单类型 | select | 全部/现销/赊销 |

**看板列（9列）：**

| 状态列 | 颜色 | 可执行操作 |
|--------|------|-----------|
| 草稿 | 灰色 | 编辑/提交审批/删除 |
| 待审 | 橙色 | 审批通过/驳回 |
| 已审 | 蓝色 | 生成出库单 |
| 待发货 | 紫色 | 确认发货 |
| 已发货 | 青色 | 查看物流 |
| 待签收 | 黄色 | -- |
| 已签收 | 绿色 | 确认回款 |
| 待回款 | 红色 | 登记收款 |
| 已完结 | 深绿 | -- |

---

## 四、订单管理模块

### 4.1 订单列表页（P0-18）

**页面：** `admin-web/src/views/OrderListView.vue`

**筛选区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 订单号 | text | 精确/模糊搜索 |
| 客户 | search-select | 客户筛选 |
| 订单状态 | multi-select | 多选：草稿/待审/已审/待发货/已发货/待签收/已签收/待回款/已完结/已关闭 |
| 销售类型 | select | 全部/现销/赊销 |
| 日期范围 | date-range | 下单日期 |
| 销售员 | search-select | 销售员筛选 |
| 金额范围 | money-range | 最小金额-最大金额 |

**列表字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 订单号 | text | 系统自动生成 |
| 客户名称 | text | -- |
| 订单金额 | money | -- |
| 订单状态 | tag | 不同颜色标签 |
| 销售类型 | tag | 现销/赊销 |
| 销售员 | text | -- |
| 下单时间 | datetime | -- |
| 操作 | button-group | 查看/编辑/审核/发货/关闭 |

**批量操作：**

| 操作 | 说明 |
|------|------|
| 批量审核 | 选中草稿订单批量提交审批 |
| 批量发货 | 选中已审订单批量生成出库单 |
| 批量关闭 | 选中草稿/待审订单批量关闭 |
| 导出Excel | 导出选中订单 |

### 4.2 订单详情页（P0-18）

**页面：** `admin-web/src/views/OrderDetailView.vue`

**基础信息区（只读）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 订单号 | text | -- |
| 客户 | text | -- |
| 销售类型 | text | -- |
| 订单状态 | tag | -- |
| 销售员 | text | -- |
| 下单时间 | datetime | -- |
| 应收截止日期 | date | 赊销时显示 |
| 备注 | text | -- |

**商品明细区（只读表格）：**

同 3.2 商品明细区

**状态流转区：**

| 操作按钮 | 显示条件 | 说明 |
|---------|---------|------|
| 提交审批 | 草稿状态 | 提交审批流程 |
| 审批通过 | 待审状态 + 有审批权限 | -- |
| 审批驳回 | 待审状态 + 有审批权限 | 需填写驳回原因 |
| 生成出库单 | 已审状态 | 跳转出库单创建 |
| 确认发货 | 待发货状态 | 填写物流信息 |
| 确认签收 | 已发货状态 | -- |
| 登记收款 | 待回款/已签收状态 | 跳转收款页面 |
| 改单 | 非已完结/已关闭 | 需填写改单原因 |
| 关闭订单 | 草稿/待审/已审 | 需填写关闭原因 |

**操作日志区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 操作时间 | datetime | -- |
| 操作人 | text | -- |
| 操作类型 | text | 创建/提交/审批/发货/签收/收款/改单/关闭 |
| 操作内容 | text | 详细描述 |

---

## 五、采购管理模块

### 5.1 采购订单（已有，ASSIGNMENT.md A102）

**页面：** `admin-web/src/views/PurchaseOrderCreateView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 供应商 | search-select | 是 | fk(供应商表) | -- | 名称/编码搜索 |
| 入库门店 | select | 是 | fk(门店表) | 当前门店 | -- |
| 预计到货日 | date | 否 | -- | +7天 | -- |
| 备注 | longtext | 否 | -- | -- | -- |

**商品明细区（动态表格）：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 商品 | search-select | 是 | fk(商品表) | -- | 名称/编码/条码搜索 |
| 单位 | select | 是 | enum(商品多单位) | 默认单位 | -- |
| 数量 | decimal | 是 | range[0.001,999999] | 1 | 精度3位 |
| 单价 | money | 是 | range[0,999999.99] | 上次采购价 | -- |
| 税率 | select | 是 | enum{0,6,9,13} | 供应商默认 | -- |
| 税额 | formula | 自动 | -- | -- | = 单价×数量×税率/(1+税率) |
| 小计 | formula | 自动 | -- | -- | = 单价 × 数量 |

**金额汇总区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 商品金额 | formula | = SUM(小计) |
| 税额 | formula | = SUM(税额) |
| 应付金额 | formula | = 商品金额 + 税额 |
| 优惠金额 | money | 手动输入 |
| 未付金额 | formula | = 应付金额 - 已付金额 |

### 5.2 采购入库单

**页面：** `admin-web/src/views/PurchaseInStockCreateView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 入库单号 | text | 自动 | -- | CGRK{YYMMDD}{4位} | 系统自动生成 |
| 关联采购单 | search-select | 否 | fk(采购订单) | -- | 按采购单入库时选择 |
| 供应商 | search-select | 条件 | fk(供应商表) | 自动带出 | 直接入库时必填 |
| 入库门店 | select | 是 | fk(门店表) | 当前门店 | -- |
| 入库日期 | date | 是 | -- | 今天 | -- |
| 备注 | longtext | 否 | -- | -- | -- |

**商品明细区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 商品 | search-select | 是 | fk(商品表) | -- | -- |
| 单位 | select | 是 | enum(商品多单位) | 默认单位 | -- |
| 采购数量 | decimal | 条件 | -- | 自动带出 | 按采购单入库时显示 |
| 实际入库数量 | decimal | 是 | range[0,999999] | -- | 可修改 |
| 单价 | money | 是 | -- | 自动带出 | -- |
| 批次号 | text | 否 | -- | -- | -- |
| 生产日期 | date | 否 | -- | -- | -- |
| 有效期至 | date | 否 | -- | -- | -- |
| 小计 | formula | 自动 | -- | -- | = 实际入库数量 × 单价 |

### 5.3 采购退货单

**页面：** `admin-web/src/views/PurchaseReturnCreateView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 退货单号 | text | 自动 | -- | CGTH{YYMMDD}{4位} | 系统自动生成 |
| 供应商 | search-select | 是 | fk(供应商表) | -- | -- |
| 退货日期 | date | 是 | -- | 今天 | -- |
| 退货原因 | select | 是 | -- | -- | 质量问题/错发/多送/其他 |
| 备注 | longtext | 否 | -- | -- | -- |

**商品明细区：**

| 字段 | 类型 | 必填 | 校验 | 说明 |
|------|------|------|------|------|
| 商品 | search-select | 是 | fk(商品表) | -- |
| 单位 | select | 是 | enum(商品多单位) | -- |
| 退货数量 | decimal | 是 | range[0,库存] | 不能超过可用库存 |
| 单价 | money | 是 | -- | 自动带出采购价 |
| 小计 | formula | 自动 | -- | = 数量 × 单价 |

### 5.4 采购付款单

**页面：** `admin-web/src/views/PurchasePaymentCreateView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 付款单号 | text | 自动 | -- | CGFK{YYMMDD}{4位} | 系统自动生成 |
| 供应商 | search-select | 是 | fk(供应商表) | -- | -- |
| 付款日期 | date | 是 | -- | 今天 | -- |
| 付款方式 | select | 是 | -- | BANK | BANK/WECHAT/ALIPAY/CASH |
| 付款金额 | money | 是 | range[0,未付金额] | -- | 不能超过未付金额 |
| 关联采购单 | search-select | 否 | fk(采购订单) | -- | 按单付款时选择 |
| 银行账户 | text | 条件 | -- | 自动带出 | 银行转账时必填 |
| 备注 | longtext | 否 | -- | -- | -- |

---

## 六、库存管理模块

### 6.1 库存查询

**页面：** `admin-web/src/views/InventoryQueryView.vue`

**筛选区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 商品 | search-select | 名称/编码/条码搜索 |
| 门店 | select | 多门店时筛选 |
| 库存状态 | select | 全部/充足/预警/缺货 |
| 分类 | select | 商品分类筛选 |

**列表字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 商品编码 | text | -- |
| 商品名称 | text | -- |
| 规格 | text | -- |
| 门店 | text | -- |
| 物理库存 | number | -- |
| 锁定库存 | number | 被订单锁定 |
| 可用库存 | number | 物理-锁定 |
| 预警阈值 | number | -- |
| 库存状态 | tag | 充足(绿)/预警(黄)/缺货(红) |

### 6.2 库存盘点单

**页面：** `admin-web/src/views/InventoryCheckView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 盘点单号 | text | 自动 | -- | PD{YYMMDD}{4位} | 系统自动生成 |
| 盘点门店 | select | 是 | fk(门店表) | 当前门店 | -- |
| 盘点日期 | date | 是 | -- | 今天 | -- |
| 盘点类型 | select | 是 | -- | FULL | FULL=全盘/PARTIAL=抽盘 |
| 备注 | longtext | 否 | -- | -- | -- |

**商品明细区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 商品 | search-select | 是 | fk(商品表) | -- | -- |
| 系统库存 | number | 自动 | -- | -- | 自动带出当前库存 |
| 盘点数量 | number | 是 | range[0,999999] | -- | 实际盘点数量 |
| 差异数量 | formula | 自动 | -- | -- | = 盘点数量 - 系统库存 |
| 差异金额 | formula | 自动 | -- | -- | = 差异数量 × 成本价 |
| 差异原因 | select | 条件 | -- | -- | 差异≠0时必填 |

### 6.3 库存调拨单

**页面：** `admin-web/src/views/InventoryTransferView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 调拨单号 | text | 自动 | -- | DB{YYMMDD}{4位} | 系统自动生成 |
| 调出门店 | select | 是 | fk(门店表) | -- | -- |
| 调入门店 | select | 是 | fk(门店表) | -- | 不能同调出门店 |
| 调拨日期 | date | 是 | -- | 今天 | -- |
| 备注 | longtext | 否 | -- | -- | -- |

**商品明细区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 商品 | search-select | 是 | fk(商品表) | -- | -- |
| 单位 | select | 是 | enum(商品多单位) | 默认单位 | -- |
| 调拨数量 | decimal | 是 | range[0,可用库存] | -- | 不能超过调出门店可用库存 |
| 调出批次 | select | 否 | fk(库存批次) | -- | 批次管理商品必填 |

---

## 七、客户管理模块

### 7.1 客户列表（P0-16）

**页面：** `admin-web/src/views/CustomerListView.vue`

**筛选区：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 客户名称/手机 | text | 模糊搜索 |
| 客户类型 | select | 全部/批发/零售/餐饮/企业 |
| 结算方式 | select | 全部/现结/月结/季结 |
| 归属销售员 | search-select | 销售员筛选 |
| 会员等级 | select | 全部/普通/银卡/金卡/钻石 |
| 欠款状态 | select | 全部/有欠款/无欠款 |

**列表字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 客户编码 | text | -- |
| 客户名称 | text | -- |
| 联系人 | text | -- |
| 手机号 | text | -- |
| 客户类型 | tag | -- |
| 结算方式 | text | -- |
| 信用额度 | money | -- |
| 已用额度 | money | -- |
| 可用额度 | money | -- |
| 归属销售员 | text | -- |
| 会员等级 | tag | -- |
| 操作 | button-group | 查看/编辑/停用 |

### 7.2 客户新增/编辑（P0-16）

**页面：** `admin-web/src/views/CustomerFormView.vue`

**基础信息Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 客户名称 | text | 是 | length[2,128] | -- | -- |
| 客户编码 | text | 是 | unique | 自动生成 | 可修改 |
| 客户类型 | select | 是 | -- | WHOLESALE | WHOLESALE/RETAIL/RESTAURANT/ENTERPRISE |
| 联系人 | text | 是 | length[2,64] | -- | -- |
| 手机号 | text | 是 | regex(手机号) | -- | -- |
| 电话 | text | 否 | -- | -- | 固话 |
| 省/市/区 | cascader | 否 | -- | -- | 省市区三级联动 |
| 详细地址 | longtext | 否 | length[0,255] | -- | -- |
| 经度 | decimal | 否 | -- | -- | 地图定位 |
| 纬度 | decimal | 否 | -- | -- | 地图定位 |
| 备注 | longtext | 否 | length[0,500] | -- | -- |

**财务信息Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 结算方式 | select | 是 | -- | CASH | CASH/MONTHLY/QUARTERLY |
| 结算日 | number | 条件 | range[1,31] | 1 | 月结/季结时必填 |
| 信用额度 | money | 否 | range[0,99999999] | 0 | 赊销额度 |
| 账期天数 | number | 否 | range[0,365] | 30 | -- |
| 税率 | select | 是 | enum{0,6,9,13} | 13 | 默认税率 |
| 开户银行 | text | 否 | -- | -- | -- |
| 银行账号 | text | 否 | -- | -- | -- |
| 开户名 | text | 否 | -- | -- | -- |

**价格策略Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 价格等级 | select | 否 | -- | -- | 关联价格等级 |
| 专属折扣 | percent | 否 | range[0,100] | 0 | 客户专属折扣率 |

**归属信息Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 归属销售员 | search-select | 否 | fk(员工表) | -- | -- |
| 归属门店 | select | 否 | fk(门店表) | 当前门店 | -- |
| 会员等级 | select | 否 | -- | NORMAL | NORMAL/SILVER/GOLD/DIAMOND |
| 会员积分 | number | 自动 | -- | 0 | 自动累计 |

### 7.3 客户详情页（P0-16）

**页面：** `admin-web/src/views/CustomerDetailView.vue`

**7个Tab：**

| Tab | 内容 |
|-----|------|
| 基础信息 | 客户所有字段展示 |
| 销售单 | 该客户的销售单列表 |
| 应收欠款 | 应收账款明细 |
| 收款记录 | 收款历史 |
| 专属价格 | 客户专属商品价格 |
| 跟进记录 | 拜访/跟进记录 |
| 分享与付款 | 分享链接和在线付款记录 |

---

## 八、商品中心模块

### 8.1 商品新增/编辑（P0-05/P0-06）

**页面：** `admin-web/src/views/ProductFormView.vue`

**基础信息Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 商品名称 | text | 是 | length[2,128] | -- | -- |
| 商品编码 | text | 是 | unique | 自动生成 | 可修改 |
| 条形码 | barcode | 否 | -- | -- | 支持扫码输入 |
| 分类 | cascader | 是 | fk(商品分类) | -- | 多级分类 |
| 品牌 | select | 否 | fk(品牌表) | -- | -- |
| 单位 | select | 是 | -- | 瓶 | 主单位 |
| 大单位 | select | 否 | -- | 箱 | 如箱 |
| 换算比例 | decimal | 条件 | range[0,9999] | 1 | 大单位=？小单位 |
| 状态 | toggle | 是 | -- | true | 上架/下架 |
| 图片 | image | 否 | -- | -- | 最多5张 |
| 备注 | longtext | 否 | -- | -- | -- |

**酒水属性Tab（新增）：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 酒精度 | decimal | 否 | range[0,100] | -- | 如 52.0 |
| 产地 | text | 否 | length[0,128] | -- | 如 贵州茅台镇 |
| 香型 | select | 否 | -- | -- | 酱香/浓香/清香/米香/其他 |
| 净含量 | text | 否 | -- | -- | 如 500ml |
| 保质期 | number | 否 | range[0,9999] | 0 | 单位：月，0=无保质期 |
| 存储条件 | text | 否 | -- | -- | 如 阴凉干燥处 |

**价格信息Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 成本价 | money | 是 | range[0,999999.99] | 0 | 仅管理员可见 |
| 零售价 | money | 是 | range[0,999999.99] | 0 | 统一零售价 |
| 批发价 | money | 否 | range[0,999999.99] | 0 | -- |
| 门店价 | money | 否 | range[0,999999.99] | 0 | 线下门店售价 |
| 小程序价 | money | 否 | range[0,999999.99] | 0 | 客户自助下单价 |

**库存信息Tab：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 预警阈值 | number | 否 | range[0,999999] | 10 | 低库存预警线 |
| 安全库存 | number | 否 | range[0,999999] | 0 | -- |
| 默认门店 | select | 否 | fk(门店表) | 当前门店 | -- |

---

## 九、财务管理模块

### 9.1 客户对账单（A107）

**页面：** `admin-web/src/views/CustomerStatementView.vue`

**生成对账单：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 客户 | search-select | 是 | fk(客户表) | -- | -- |
| 开始日期 | date | 是 | -- | 上月1日 | -- |
| 结束日期 | date | 是 | -- | 上月末日 | -- |
| 对账单号 | text | 自动 | -- | KHDZ{YYMMDD}{4位} | 自动生成 |

**对账单详情：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 期初余额 | money | 上期期末余额 |
| 本期销售 | money | 期间销售单合计 |
| 本期退货 | money | 期间退货单合计 |
| 本期收款 | money | 期间收款合计 |
| 期末余额 | money | = 期初 + 销售 - 退货 - 收款 |

**明细流水：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 日期 | datetime | -- |
| 单据类型 | text | 销售单/退货单/收款 |
| 单据号 | text | -- |
| 增加金额 | money | 销售 |
| 减少金额 | money | 退货/收款 |
| 余额 | money | 逐行累计 |

### 9.2 客户收款单（A108）

**页面：** `admin-web/src/views/CustomerPaymentView.vue`

**基础信息区：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 收款单号 | text | 自动 | -- | KHSK{YYMMDD}{4位} | 自动生成 |
| 客户 | search-select | 是 | fk(客户表) | -- | -- |
| 收款日期 | date | 是 | -- | 今天 | -- |
| 收款方式 | select | 是 | -- | CASH | CASH/WECHAT/ALIPAY/BANK |
| 收款金额 | money | 是 | range[0,999999.99] | -- | -- |
| 关联销售单 | search-select | 否 | fk(销售单) | -- | 按单收款时选择 |
| 关联对账单 | search-select | 否 | fk(对账单) | -- | 按对账单收款时选择 |
| 凭证号 | text | 否 | -- | -- | 银行转账流水号 |
| 备注 | longtext | 否 | -- | -- | -- |

---

## 十、审批流程模块（P0-12）

### 10.1 审批规则配置

**页面：** `admin-web/src/views/ApprovalRuleConfigView.vue`

**触发规则：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 规则名称 | text | 是 | length[2,64] | -- | -- |
| 适用单据 | select | 是 | -- | SALE | SALE/PURCHASE/RETURN |
| 触发条件 | select | 是 | -- | AMOUNT | AMOUNT/DISCOUNT/CUSTOMER_TYPE |
| 金额阈值 | money | 条件 | range[0,99999999] | -- | 触发条件=AMOUNT时必填 |
| 折扣阈值 | percent | 条件 | range[0,100] | -- | 触发条件=DISCOUNT时必填 |
| 客户类型 | multi-select | 条件 | -- | -- | 触发条件=CUSTOMER_TYPE时必填 |
| 启用状态 | toggle | 是 | -- | true | -- |

**审批人配置：**

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 审批层级 | number | 是 | range[1,5] | 1 | 第几级审批 |
| 审批人 | search-select | 是 | fk(员工表) | -- | -- |
| 金额上限 | money | 否 | range[0,99999999] | 99999999 | 该审批人可审批的最大金额 |
| 审批方式 | select | 是 | -- | ANY | ANY=任一/ALL=全部 |

### 10.2 审批操作

**审批弹窗：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 审批意见 | radio | 是 | 同意/驳回/转交/加签 |
| 审批备注 | longtext | 否 | -- |
| 转交人 | search-select | 条件 | 意见=转交时必填 |
| 加签人 | search-select | 条件 | 意见=加签时必填 |

---

## 十一、系统管理模块

### 11.1 门店管理

**页面：** `admin-web/src/views/StoreFormView.vue`

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 门店编码 | text | 是 | unique | 自动生成 | -- |
| 门店名称 | text | 是 | length[2,128] | -- | -- |
| 联系人 | text | 是 | length[2,64] | -- | -- |
| 联系电话 | text | 是 | regex(电话) | -- | -- |
| 省/市/区 | cascader | 否 | -- | -- | -- |
| 详细地址 | longtext | 否 | length[0,255] | -- | -- |
| 经度 | decimal | 否 | -- | -- | 地图定位 |
| 纬度 | decimal | 否 | -- | -- | 地图定位 |
| 配送半径 | number | 否 | range[0,100] | 5 | 单位：公里 |
| 营业状态 | toggle | 是 | -- | true | 营业/休息 |
| 配送开关 | toggle | 是 | -- | true | 开启/关闭配送 |
| 自提开关 | toggle | 是 | -- | true | 开启/关闭自提 |
| 自动开门时间 | time | 否 | -- | 08:00 | -- |
| 自动关门时间 | time | 否 | -- | 22:00 | -- |
| 日订单上限 | number | 否 | range[0,9999] | 0 | 0=无限制 |
| 日金额上限 | money | 否 | range[0,99999999] | 0 | 0=无限制 |

### 11.2 角色权限

**页面：** `admin-web/src/views/RoleFormView.vue`

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 角色编码 | text | 是 | unique | -- | 如 ADMIN/MANAGER/SALES |
| 角色名称 | text | 是 | length[2,64] | -- | 如 管理员/店长/销售员 |
| 描述 | longtext | 否 | -- | -- | -- |
| 数据权限 | select | 是 | -- | ALL | ALL/DEPARTMENT/STORE/SELF |
| 权限树 | tree | 是 | -- | -- | 菜单+按钮权限勾选 |

### 11.3 系统配置

**页面：** `admin-web/src/views/SystemConfigView.vue`

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 公司名称 | text | 是 | length[2,128] | -- | -- |
| 公司地址 | longtext | 否 | -- | -- | -- |
| 公司电话 | text | 否 | -- | -- | -- |
| 默认税率 | select | 是 | enum{0,6,9,13} | 13 | -- |
| 货币符号 | text | 是 | -- | ¥ | -- |
| 单号前缀 | text | 是 | -- | -- | 销售单/采购单等前缀 |
| 库存预警阈值 | number | 否 | range[0,999] | 10 | 全局默认 |
| 授信天数 | number | 否 | range[0,365] | 30 | 默认赊销账期 |
| 抹零方式 | select | 是 | -- | NONE | NONE/角/分/元 |

---

## 十二、手机端表单

### 12.1 快速开单（merchant-mobile）

**页面：** `merchant-mobile/src/views/CreateSaleView.vue`

| 字段 | 类型 | 必填 | 校验 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| 客户 | search-select | 是 | fk(客户表) | 散客 | 搜索会员/新增散客 |
| 销售类型 | radio | 是 | -- | CASH | CASH/CREDIT |
| 应收截止日期 | date | 条件 | -- | +30天 | CREDIT时必填 |
| 商品搜索 | search-select | 是 | fk(商品表) | -- | 扫码/搜索 |
| 单位 | select | 是 | -- | 默认 | 箱/瓶切换 |
| 数量 | decimal | 是 | range[0.001,999999] | 1 | -- |
| 单价 | money | 是 | -- | 自动 | -- |
| 折扣 | percent | 否 | -- | 0 | -- |
| 抹零 | money | 否 | -- | 0 | -- |
| 应收金额 | formula | 自动 | -- | -- | -- |
| 支付方式 | radio | 是 | -- | CASH | CASH/WECHAT/ALIPAY |
| 备注 | text | 否 | -- | -- | -- |

### 12.2 手机端首页工作台

**页面：** `merchant-mobile/src/views/HomeView.vue`

| 字段 | 类型 | 数据来源 | 说明 |
|------|------|---------|------|
| 门店名称 | text | 当前登录信息 | 顶部显示 |
| 操作员 | text | 当前登录信息 | -- |
| 日期 | text | 系统日期 | -- |
| 今日营业额 | money | dashboard API | 蓝色渐变卡片 |
| 今日订单 | number | dashboard API | -- |
| 本月营业额 | money | dashboard API | -- |
| 本月毛利 | money | dashboard API | -- |
| 待配送 | number | 订单统计API | 红色计数 |
| 待取货 | number | 订单统计API | 橙色计数 |
| 待收款 | number | 订单统计API | 黄色计数 |
| 已完成 | number | 订单统计API | 绿色计数 |

---

## 附录：数据库字段映射速查

### 销售单表 sale_bill

| 前端字段 | 数据库字段 | 类型 | 说明 |
|---------|-----------|------|------|
| 订单号 | bill_no | varchar(64) | 主键 |
| 客户ID | customer_id | bigint | fk(member) |
| 销售类型 | sale_type | varchar(16) | CASH/CREDIT |
| 订单状态 | status | varchar(32) | 9态 |
| 收款状态 | collection_status | varchar(32) | UNPAID/PARTIAL/PAID |
| 销售员ID | salesman_id | bigint | fk(sys_user) |
| 门店ID | store_id | bigint | fk(store) |
| 商品金额 | goods_amount | decimal(12,2) | -- |
| 税额 | tax_amount | decimal(12,2) | -- |
| 优惠金额 | discount_amount | decimal(12,2) | -- |
| 抹零金额 | wipe_amount | decimal(12,2) | -- |
| 应收金额 | total_amount | decimal(12,2) | -- |
| 实收金额 | received_amount | decimal(12,2) | -- |
| 未收金额 | unreceived_amount | decimal(12,2) | -- |
| 应收截止日期 | due_date | date | -- |
| 备注 | remark | varchar(255) | -- |
| 创建人 | created_by | bigint | -- |
| 创建时间 | created_at | datetime | -- |

### 审批记录表 approval_record

| 前端字段 | 数据库字段 | 类型 | 说明 |
|---------|-----------|------|------|
| 记录ID | id | bigint | 主键 |
| 业务单号 | biz_no | varchar(64) | 关联单据 |
| 业务类型 | biz_type | varchar(32) | SALE/PURCHASE/RETURN |
| 审批层级 | level | int | 第几级 |
| 审批人ID | approver_id | bigint | fk(sys_user) |
| 审批状态 | status | varchar(16) | PENDING/APPROVED/REJECTED |
| 审批意见 | opinion | varchar(16) | AGREE/REJECT/TRANSFER/ADDSIGN |
| 审批备注 | remark | varchar(255) | -- |
| 创建时间 | created_at | datetime | -- |
| 审批时间 | approved_at | datetime | -- |

---

> **文档版本：** V1.0
> **更新日期：** 2026-06-23
> **更新人：** 凌舟
> **下次更新：** 当新增模块或字段变更时
