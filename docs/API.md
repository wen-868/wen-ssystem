# 智享酒业进销存系统 API 接口文档

## 概述

- **基础URL**: `/api`
- **认证方式**: Bearer Token（通过 `Authorization: Bearer <token>` 请求头传递）
- **返回格式**:

```json
{
  "code": "0",
  "msg": "成功",
  "data": { ... },
  "traceId": "uuid-v4",
  "apiCost": 1
}
```

- **错误格式**:

```json
{
  "code": "400" | "401" | "403" | "404" | "500",
  "msg": "错误描述",
  "traceId": "uuid-v4",
  "apiCost": 1
}
```

- **分页格式**: 列表接口统一返回 `{ total, page, pageSize, records }`
- **业务编号前缀**: CG(采购), XS(销售), DD(订单), ZF(退货), DZ(对账), SK(收款), MD(门店), SPU(商品), SKU(规格), PP(付款), SS(供应商对账), DB(调拨), PD(盘点)

---

## 目录

1. [健康检查](#健康检查)
2. [认证接口](#认证接口)
3. [管理后台接口](#管理后台接口)
   - [员工管理](#员工管理)
   - [客户管理](#客户管理)
   - [门店管理](#门店管理)
   - [商品管理](#商品管理)
   - [销售单管理](#销售单管理)
   - [日结管理](#日结管理)
   - [销售退货管理](#销售退货管理)
   - [客户对账单](#客户对账单)
   - [客户付款记录](#客户付款记录)
   - [小程序订单管理](#小程序订单管理)
   - [库存管理](#库存管理)
   - [收款链接](#收款链接)
   - [付款订单](#付款订单)
   - [退款订单](#退款订单)
   - [数据看板](#数据看板)
   - [供应商管理](#供应商管理)
   - [采购单管理](#采购单管理)
   - [采购入库管理](#采购入库管理)
   - [采购退货管理](#采购退货管理)
   - [采购付款管理](#采购付款管理)
   - [供应商对账](#供应商对账)
   - [价格管理](#价格管理)
   - [信用额度管理](#信用额度管理)
   - [营销管理](#营销管理)
   - [追溯管理](#追溯管理)
   - [库存批次管理](#库存批次管理)
   - [门店管控](#门店管控)
   - [报表中心](#报表中心)
   - [预警管理](#预警管理)
   - [售后管理](#售后管理)
   - [角色权限管理](#角色权限管理)
   - [通知管理](#通知管理)
   - [调拨管理](#调拨管理)
   - [盘点管理](#盘点管理)
   - [订单超时管理](#订单超时管理)
   - [审计日志](#审计日志)
   - [数据导出](#数据导出)
   - [系统配置](#系统配置)
4. [门店终端接口](#门店终端接口)
5. [小程序接口](#小程序接口)
   - [微信认证](#微信认证)
   - [商品浏览](#商品浏览)
   - [购物车](#购物车)
   - [小程序订单](#小程序订单)
   - [小程序售后](#小程序售后)
   - [小程序营销](#小程序营销)
   - [小程序追溯](#小程序追溯)
   - [小程序通知](#小程序通知)
6. [支付接口](#支付接口)
7. [公开接口](#公开接口)
8. [即时零售接口](#即时零售接口)

---

## 健康检查

### GET /health
- **描述**: 服务健康检查
- **认证**: 无需认证
- **响应**:

| 字段 | 类型 | 说明 |
|------|------|------|
| service | string | 服务名称 `zhixiang-backend` |

---

## 认证接口

### POST /api/admin/auth/login
- **描述**: 管理员/门店登录
- **认证**: 无需认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

- **响应**:

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | JWT令牌 |
| user.id | number | 用户ID |
| user.username | string | 用户名 |
| user.realName | string | 真实姓名 |
| user.storeId | number | 关联门店ID |
| user.roles | string[] | 角色编码列表 |

### GET /api/admin/auth/me
- **描述**: 获取当前登录用户信息
- **认证**: 需要认证
- **响应**: 当前用户完整信息

### POST /api/miniapp/wechat/auth/login
- **描述**: 微信小程序登录（通过微信code换取openid并创建/更新用户）
- **认证**: 无需认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 微信登录code |

- **响应**:

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | JWT令牌(7天有效) |
| userInfo.id | number | 用户ID |
| userInfo.nickname | string | 昵称 |
| userInfo.avatarUrl | string | 头像URL |
| userInfo.phone | string | 手机号 |

### POST /api/miniapp/wechat/auth/decrypt-phone
- **描述**: 解密微信手机号
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| encryptedData | string | 是 | 微信加密数据 |
| iv | string | 是 | 加密向量 |

- **响应**:

| 字段 | 类型 | 说明 |
|------|------|------|
| phone | string | 解密后的手机号 |

### PUT /api/miniapp/wechat/auth/profile
- **描述**: 更新微信用户资料
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 否 | 昵称 |
| avatarUrl | string | 否 | 头像URL |

### GET /api/miniapp/wechat/auth/profile
- **描述**: 获取当前微信用户信息（含绑定关系）
- **认证**: 需要认证
- **响应**: 用户信息 + bindings(绑定关系列表)

### POST /api/miniapp/wechat/auth/bind
- **描述**: 绑定系统账号
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 系统用户名 |
| password | string | 是 | 系统密码 |
| bindingType | string | 是 | 绑定类型: ADMIN/MERCHANT/CONSUMER |

### POST /api/miniapp/wechat/auth/unbind
- **描述**: 解除绑定系统账号
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| systemUserId | number | 是 | 系统用户ID |

---

## 管理后台接口

### 员工管理

#### GET /api/admin/staff
- **描述**: 获取员工列表
- **认证**: 需要认证
- **响应**: `{ total, records: [{ staffId, username, realName, storeId, status }] }`

#### POST /api/admin/staff
- **描述**: 创建员工
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| realName | string | 是 | 真实姓名 |
| mobile | string | 否 | 手机号 |
| roleId | string | 否 | 角色ID |
| storeId | number | 否 | 关联门店ID |
| status | number | 否 | 状态，默认1 |
| password | string | 否 | 密码，默认123456 |

#### PUT /api/admin/staff/:staffId
- **描述**: 更新员工信息
- **认证**: 需要认证
- **请求体**: username, realName, mobile, roleId, storeId, status（均可选）

#### DELETE /api/admin/staff/:id
- **描述**: 停用员工
- **认证**: 需要认证
- **路径参数**: id - 员工ID

---

### 客户管理

#### GET /api/admin/members
- **描述**: 获取客户列表（分页+搜索）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword(姓名/手机号)
- **响应**: `{ total, page, pageSize, records: [{ memberId, name, mobile, customerType, points, levelCode, status, staffId, staffName }] }`

#### POST /api/admin/members
- **描述**: 创建客户
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 客户名称 |
| mobile | string | 是 | 手机号 |
| customerType | string | 否 | 客户类型: RETAIL/WHOLESALE，默认RETAIL |
| staffId | number | 否 | 负责员工ID |

#### GET /api/admin/members/:memberId
- **描述**: 获取客户详情
- **认证**: 需要认证

#### PUT /api/admin/members/:memberId
- **描述**: 编辑客户信息
- **认证**: 需要认证
- **请求体**: name, mobile, address, customerType, levelCode, settlementType, remark（均可选）

#### DELETE /api/admin/members/:memberId
- **描述**: 停用客户
- **认证**: 需要认证

#### GET /api/admin/members/:memberId/assign
- **描述**: 分配客户给员工
- **认证**: 需要认证
- **请求体**: { staffId: number }

#### GET /api/admin/members/:memberId/price-history
- **描述**: 查询客户某SKU的历史价格
- **认证**: 需要认证
- **Query参数**: skuId

#### GET /api/admin/members/stats
- **描述**: 客户统计信息
- **认证**: 需要认证

#### GET /api/admin/members/sale-bills
- **描述**: 查询客户的销售单
- **认证**: 需要认证
- **Query参数**: memberId, page, pageSize

#### GET /api/admin/members/payments
- **描述**: 查询客户的付款记录
- **认证**: 需要认证
- **Query参数**: memberId, page, pageSize

#### GET /api/admin/members/statements
- **描述**: 查询客户的对账单
- **认证**: 需要认证
- **Query参数**: memberId, page, pageSize

#### GET /api/admin/members/purchase-stats
- **描述**: 查询客户的采购统计
- **认证**: 需要认证
- **Query参数**: memberId

---

### 门店管理

#### GET /api/admin/system/stores
- **描述**: 获取门店列表（分页+搜索）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword

#### POST /api/admin/system/stores
- **描述**: 创建门店
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 门店名称 |
| address | string | 是 | 地址 |
| lng | number | 否 | 经度 |
| lat | number | 否 | 纬度 |
| contact | string | 否 | 联系人 |
| phone | string | 否 | 电话 |
| deliveryRadius | number | 否 | 配送半径(km)，默认3 |

#### GET /api/admin/system/stores/:id
- **描述**: 获取门店详情
- **认证**: 需要认证

#### PUT /api/admin/system/stores/:id
- **描述**: 更新门店基本信息
- **认证**: 需要认证
- **请求体**: name, address, contact, phone, deliveryRadius, businessStatus（均可选）

#### PATCH /api/admin/system/stores/:id
- **描述**: 部分更新门店信息
- **认证**: 需要认证
- **请求体**: name, address, phone, status, longitude, latitude（均可选）

#### POST /api/admin/system/stores/:id/fetch-wx-info
- **描述**: 拉取微信小程序商户信息
- **认证**: 需要认证

---

### 商品管理

#### GET /api/admin/products
- **描述**: 获取商品列表（分页+搜索）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword(商品名/SKU编码/条码)

#### POST /api/admin/products
- **描述**: 创建商品（SPU + SKU + 价格）
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 商品名称 |
| categoryId | number | 是 | 分类ID |
| mainImage | string | 否 | 主图 |
| saleChannels | string[] | 否 | 销售渠道，默认["MINIAPP","STORE"] |
| skus | array | 是 | SKU列表 |
| skus[].skuName | string | 是 | 规格名 |
| skus[].barcode | string | 否 | 条码 |
| skus[].boxRatio | number | 否 | 箱规，默认1 |
| skus[].temperature | string | 否 | 储存温度: NORMAL/CHILLED |
| skus[].traceEnabled | boolean | 否 | 是否启用追溯 |
| skus[].warningThreshold | number | 否 | 库存预警阈值 |
| skus[].costPrice | number | 否 | 成本价 |
| skus[].retailPrice | number | 是 | 零售价 |
| skus[].wholesalePrice | number | 否 | 批发价 |
| skus[].miniappPrice | number | 否 | 小程序价 |
| skus[].storePrice | number | 否 | 门店价 |

#### PUT /api/admin/products/:spuId
- **描述**: 编辑商品基本信息
- **认证**: 需要认证
- **请求体**: name, barcode, category, brand, unit, boxRatio, specs, status（均可选）

#### PATCH /api/admin/products/:spuId/status
- **描述**: 更新商品状态
- **认证**: 需要认证
- **请求体**: { status: "DRAFT"|"ON_SALE"|"OFF_SALE" }

#### DELETE /api/admin/products/:spuId
- **描述**: 停用商品（状态变更为OFF_SALE）
- **认证**: 需要认证

#### GET /api/admin/products/:skuId/price-logs
- **描述**: 获取SKU价格变更日志
- **认证**: 需要认证

#### PUT /api/admin/products/:skuId/price
- **描述**: 更新SKU价格（自动记录价格变更日志）
- **认证**: 需要认证
- **请求体**: costPrice, retailPrice, wholesalePrice, miniappPrice, storePrice（均可选）

---

### 销售单管理

#### GET /api/admin/sale-bills
- **描述**: 获取销售单列表（分页+筛选）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, status(收款状态), dateStart, dateEnd

#### GET /api/admin/sale-bills/export.csv
- **描述**: 导出销售单CSV
- **认证**: 需要认证
- **Query参数**: keyword, status, dateStart, dateEnd

---

### 日结管理

#### POST /api/admin/daily-settle
- **描述**: 创建日结（按日期汇总当日销售额、收款、退款）
- **认证**: 需要认证
- **请求体**: { settleDate: string }

#### GET /api/admin/daily-settle
- **描述**: 获取日结历史列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, dateStart, dateEnd

#### GET /api/admin/daily-settle/:id
- **描述**: 获取日结详情
- **认证**: 需要认证

---

### 销售退货管理

#### POST /api/admin/sale-returns
- **描述**: 新建销售退货单
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceBillNo | string | 否 | 原销售单号 |
| storeId | number | 是 | 门店ID |
| customerId | number | 否 | 客户ID |
| customerName | string | 否 | 客户名称 |
| customerMobile | string | 否 | 客户手机 |
| discountAmount | number | 否 | 折扣金额 |
| refundMethod | string | 否 | 退款方式 |
| remark | string | 否 | 备注 |
| items | array | 是 | 退货明细列表 |

#### GET /api/admin/sale-returns
- **描述**: 获取退货单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status, dateStart, dateEnd

#### GET /api/admin/sale-returns/:id
- **描述**: 获取退货单详情
- **认证**: 需要认证

---

### 客户对账单

#### GET /api/admin/customer-statements
- **描述**: 获取客户对账单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, customerId, status

#### GET /api/admin/customer-statements/:statementId
- **描述**: 获取对账单详情（含销售单、退货单、收款记录）
- **认证**: 需要认证

#### POST /api/admin/customer-statements/generate
- **描述**: 生成客户对账单
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| customerId | number | 是 | 客户ID |
| statementType | string | 否 | 对账类型，默认MONTHLY |
| startDate | string | 是 | 起始日期 |
| endDate | string | 是 | 结束日期 |
| remark | string | 否 | 备注 |

---

### 客户付款记录

#### GET /api/admin/customer-payments
- **描述**: 获取客户付款记录列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, customerId, paymentMethod, dateStart, dateEnd

#### POST /api/admin/customer-payments
- **描述**: 登记客户付款（自动更新关联销售单的已收金额和收款状态）
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| customerId | number | 是 | 客户ID |
| amount | number | 是 | 付款金额 |
| paymentMethod | string | 否 | 付款方式，默认CASH |
| sourceType | string | 否 | 来源类型，如SALE_BILL |
| sourceNo | string | 否 | 来源单号 |
| voucherNo | string | 否 | 凭证号 |
| paymentDate | string | 是 | 付款日期 |
| remark | string | 否 | 备注 |

---

### 小程序订单管理

#### GET /api/admin/orders
- **描述**: 获取小程序订单列表（分页+筛选）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, status, dateStart, dateEnd

#### GET /api/admin/orders/export.csv
- **描述**: 导出订单CSV
- **认证**: 需要认证
- **Query参数**: keyword, status, dateStart, dateEnd

#### GET /api/admin/orders/:orderNo
- **描述**: 获取订单详情
- **认证**: 需要认证

---

### 库存管理

#### GET /api/admin/inventory/logs
- **描述**: 获取库存变动流水
- **认证**: 需要认证
- **Query参数**: page, pageSize

#### GET /api/admin/inventory/balances
- **描述**: 获取库存余额
- **认证**: 需要认证
- **Query参数**: storeId, skuId, page, pageSize

#### GET /api/admin/inventory/alerts
- **描述**: 获取库存预警列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

---

### 收款链接

#### GET /api/admin/collection-links
- **描述**: 获取收款链接列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

---

### 付款订单

#### GET /api/admin/payment-orders
- **描述**: 获取付款订单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

---

### 退款订单

#### GET /api/admin/refund-orders
- **描述**: 获取退款订单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

---

### 数据看板

#### GET /api/admin/reports/dashboard
- **描述**: 管理后台数据概览（当日销售额、订单数、待收款、库存预警等）
- **认证**: 需要认证

#### GET /api/admin/dashboard/overview
- **描述**: 看板概览数据
- **认证**: 需要认证

#### GET /api/admin/dashboard/sales-trend
- **描述**: 销售趋势
- **认证**: 需要认证
- **Query参数**: days

#### GET /api/admin/dashboard/category-pie
- **描述**: 品类销售占比
- **认证**: 需要认证

#### GET /api/admin/dashboard/top-products
- **描述**: 热销商品排行
- **认证**: 需要认证
- **Query参数**: limit

#### GET /api/admin/dashboard/top-customers
- **描述**: 客户消费排行
- **认证**: 需要认证
- **Query参数**: limit

#### GET /api/admin/dashboard/recent-alerts
- **描述**: 最近预警
- **认证**: 需要认证
- **Query参数**: limit

---

### 供应商管理

#### GET /api/admin/suppliers
- **描述**: 获取供应商列表（分页+搜索）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, supplyType

#### POST /api/admin/suppliers
- **描述**: 创建供应商
- **认证**: 需要认证
- **请求体**: name, contactPerson, phone, supplyType, address, bankAccount, bankName, taxNo, remark

#### GET /api/admin/suppliers/:id
- **描述**: 获取供应商详情
- **认证**: 需要认证

#### PUT /api/admin/suppliers/:id
- **描述**: 更新供应商信息
- **认证**: 需要认证

#### DELETE /api/admin/suppliers/:id
- **描述**: 停用供应商
- **认证**: 需要认证

#### GET /api/admin/suppliers/:id/purchase-orders
- **描述**: 获取供应商的采购单
- **认证**: 需要认证
- **Query参数**: page, pageSize, status

#### GET /api/admin/suppliers/:id/payments
- **描述**: 获取供应商的付款记录
- **认证**: 需要认证
- **Query参数**: page, pageSize

#### GET /api/admin/suppliers/:id/products
- **描述**: 获取供应商的供货商品
- **认证**: 需要认证

#### GET /api/admin/suppliers/:id/stats
- **描述**: 获取供应商统计信息
- **认证**: 需要认证

---

### 采购单管理

#### GET /api/admin/purchase-orders
- **描述**: 获取采购单列表（分页+筛选）
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, status, supplierId, dateStart, dateEnd

#### POST /api/admin/purchase-orders
- **描述**: 创建采购单
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| supplierId | number | 是 | 供应商ID |
| expectedDate | string | 否 | 预计到货日期 |
| remark | string | 否 | 备注 |
| items | array | 是 | 采购明细列表 |
| items[].skuId | number | 是 | SKU ID |
| items[].skuName | string | 是 | SKU名称 |
| items[].quantity | number | 是 | 数量 |
| items[].unitPrice | number | 是 | 单价 |

#### GET /api/admin/purchase-orders/:id
- **描述**: 获取采购单详情（含明细）
- **认证**: 需要认证

#### PUT /api/admin/purchase-orders/:id
- **描述**: 更新采购单（仅DRAFT状态）
- **认证**: 需要认证

#### DELETE /api/admin/purchase-orders/:id
- **描述**: 删除采购单（仅DRAFT状态）
- **认证**: 需要认证

#### POST /api/admin/purchase-orders/:id/confirm
- **描述**: 审核通过采购单
- **认证**: 需要认证

#### POST /api/admin/purchase-orders/:id/in-stock
- **描述**: 采购入库
- **认证**: 需要认证
- **请求体**: { items: [{ itemId, actualQty }] }

---

### 采购入库管理

#### GET /api/admin/purchase-instocks
- **描述**: 获取采购入库列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

#### GET /api/admin/purchase-instocks/:id
- **描述**: 获取入库单详情
- **认证**: 需要认证

---

### 采购退货管理

#### POST /api/admin/purchase-returns
- **描述**: 创建采购退货单
- **认证**: 需要认证

#### GET /api/admin/purchase-returns
- **描述**: 获取采购退货列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

---

### 采购付款管理

#### POST /api/admin/purchase-payments
- **描述**: 创建采购付款单
- **认证**: 需要认证
- **请求体**: purchaseOrderId, supplierId, paymentAmount, paymentMethod, bankAccount, remark

#### GET /api/admin/purchase-payments
- **描述**: 获取付款单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, supplierId, status

#### GET /api/admin/purchase-payments/statistics
- **描述**: 付款统计（本月已付总额、待审核数、待付款数）
- **认证**: 需要认证

#### GET /api/admin/purchase-payments/:id
- **描述**: 获取付款单详情
- **认证**: 需要认证

#### PUT /api/admin/purchase-payments/:id
- **描述**: 更新付款单（仅PENDING状态）
- **认证**: 需要认证

#### POST /api/admin/purchase-payments/:id/approve
- **描述**: 审核付款单
- **认证**: 需要认证

#### POST /api/admin/purchase-payments/:id/pay
- **描述**: 确认付款（自动更新采购单已付金额）
- **认证**: 需要认证

#### POST /api/admin/purchase-payments/:id/cancel
- **描述**: 取消付款单
- **认证**: 需要认证

---

### 供应商对账

#### POST /api/admin/purchase-payments/supplier-statements/generate
- **描述**: 生成供应商对账单
- **认证**: 需要认证
- **请求体**: supplierId, periodStart, periodEnd, remark

#### GET /api/admin/purchase-payments/supplier-statements
- **描述**: 获取供应商对账单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, supplierId, status

#### GET /api/admin/purchase-payments/supplier-statements/:id
- **描述**: 获取对账单详情（含明细）
- **认证**: 需要认证

#### POST /api/admin/purchase-payments/supplier-statements/:id/confirm
- **描述**: 确认对账单
- **认证**: 需要认证

#### POST /api/admin/purchase-payments/supplier-statements/:id/dispute
- **描述**: 标记对账单争议
- **认证**: 需要认证
- **请求体**: remark

---

### 价格管理

#### GET /api/admin/prices/levels
- **描述**: 获取价格等级列表
- **认证**: 需要认证

#### POST /api/admin/prices/levels
- **描述**: 创建价格等级
- **认证**: 需要认证
- **请求体**: levelName, levelCode, discount, description

#### GET /api/admin/prices/levels/:id
- **描述**: 获取价格等级详情
- **认证**: 需要认证

#### PUT /api/admin/prices/levels/:id
- **描述**: 更新价格等级
- **认证**: 需要认证

#### DELETE /api/admin/prices/levels/:id
- **描述**: 删除价格等级
- **认证**: 需要认证

#### GET /api/admin/prices/skus/:skuId/prices
- **描述**: 获取SKU在各等级的价格
- **认证**: 需要认证

#### POST /api/admin/prices/skus/:skuId/prices/batch-set
- **描述**: 批量设置SKU价格
- **认证**: 需要认证
- **请求体**: { prices: [{ levelId, price }] }

#### PUT /api/admin/prices/prices/:id
- **描述**: 更新价格记录
- **认证**: 需要认证

#### DELETE /api/admin/prices/prices/:id
- **描述**: 删除价格记录
- **认证**: 需要认证

#### GET /api/admin/prices/best-price
- **描述**: 查询最优价格
- **认证**: 需要认证
- **Query参数**: skuId, customerId

#### GET /api/admin/prices/customer-bindings
- **描述**: 获取客户价格等级绑定列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, customerId, status

#### POST /api/admin/prices/customer-bindings/apply
- **描述**: 客户申请价格等级
- **认证**: 需要认证
- **请求体**: customerId, levelId, reason

#### POST /api/admin/prices/customer-bindings/:id/approve
- **描述**: 审批通过价格等级申请
- **认证**: 需要认证

#### POST /api/admin/prices/customer-bindings/:id/reject
- **描述**: 审批拒绝价格等级申请
- **认证**: 需要认证

#### DELETE /api/admin/prices/customer-bindings/:id
- **描述**: 取消价格等级绑定
- **认证**: 需要认证

#### GET /api/admin/prices/change-logs
- **描述**: 价格变更日志
- **认证**: 需要认证
- **Query参数**: page, pageSize, skuId

---

### 信用额度管理

#### GET /api/admin/credits
- **描述**: 获取信用额度列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, customerId, status

#### GET /api/admin/credits/:id
- **描述**: 获取信用额度详情
- **认证**: 需要认证

#### POST /api/admin/credits/init
- **描述**: 初始化客户信用额度
- **认证**: 需要认证
- **请求体**: customerId, creditLimit, paymentTerm, remark

#### POST /api/admin/credits/:id/adjust-limit
- **描述**: 调整信用额度
- **认证**: 需要认证
- **请求体**: newLimit, reason

#### POST /api/admin/credits/:id/adjust-term
- **描述**: 调整账期
- **认证**: 需要认证
- **请求体**: newTerm, reason

#### GET /api/admin/credits/:id/check
- **描述**: 检查信用额度（可用额度、已用额度、是否超额）
- **认证**: 需要认证

#### POST /api/admin/credits/:id/occupy
- **描述**: 占用信用额度（下单时调用，使用FOR UPDATE行锁）
- **认证**: 需要认证
- **请求体**: amount, orderNo

#### POST /api/admin/credits/:id/release
- **描述**: 释放信用额度（取消/退款时调用）
- **认证**: 需要认证
- **请求体**: amount, orderNo

#### POST /api/admin/credits/:id/freeze
- **描述**: 冻结信用额度
- **认证**: 需要认证
- **请求体**: reason

#### POST /api/admin/credits/:id/unfreeze
- **描述**: 解冻信用额度
- **认证**: 需要认证

#### GET /api/admin/credits/:id/logs
- **描述**: 信用额度变动日志
- **认证**: 需要认证

#### GET /api/admin/credits/collections
- **描述**: 获取催收记录列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, customerId, status

#### POST /api/admin/credits/collections
- **描述**: 创建催收记录
- **认证**: 需要认证
- **请求体**: customerId, creditId, amount, method, remark

#### PUT /api/admin/credits/collections/:id
- **描述**: 更新催收记录
- **认证**: 需要认证

#### GET /api/admin/credits/collections/overdue
- **描述**: 获取逾期客户列表
- **认证**: 需要认证

#### POST /api/admin/credits/collections/batch-remind
- **描述**: 批量催收提醒
- **认证**: 需要认证
- **请求体**: { customerIds: number[] }

#### GET /api/admin/credits/collections/statistics
- **描述**: 催收统计
- **认证**: 需要认证

---

### 营销管理

#### 优惠券模板管理

##### POST /api/admin/marketing/coupons/templates
- **描述**: 创建优惠券模板
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 优惠券名称 |
| type | string | 是 | 类型: FIXED/PERCENT/SHIPPING/FREE_GIFT |
| value | number | 是 | 面值/折扣 |
| minAmount | number | 否 | 最低消费金额，默认0 |
| maxDiscount | number | 否 | 最高折扣金额 |
| applicableScope | string | 否 | 适用范围: ALL/CATEGORY/BRAND/SKU |
| applicableIds | number[] | 否 | 适用ID列表 |
| totalCount | number | 否 | 发放总量 |
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| description | string | 否 | 描述 |

##### GET /api/admin/marketing/coupons/templates
- **描述**: 获取优惠券模板列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status, type, keyword

##### GET /api/admin/marketing/coupons/templates/:id
- **描述**: 获取优惠券模板详情
- **认证**: 需要认证

##### PUT /api/admin/marketing/coupons/templates/:id
- **描述**: 更新优惠券模板
- **认证**: 需要认证

##### DELETE /api/admin/marketing/coupons/templates/:id
- **描述**: 删除优惠券模板（仅DRAFT状态可删）
- **认证**: 需要认证

##### POST /api/admin/marketing/coupons/templates/:id/activate
- **描述**: 激活优惠券模板
- **认证**: 需要认证

##### POST /api/admin/marketing/coupons/templates/:id/pause
- **描述**: 暂停优惠券模板
- **认证**: 需要认证

##### GET /api/admin/marketing/coupons/users
- **描述**: 用户优惠券列表（分页+筛选）
- **认证**: 需要认证
- **Query参数**: page, pageSize, status, userId, templateId

##### GET /api/admin/marketing/coupons/statistics
- **描述**: 优惠券统计
- **认证**: 需要认证

#### 满减活动管理

##### POST /api/admin/marketing/full-reductions
- **描述**: 创建满减活动
- **认证**: 需要认证

##### GET /api/admin/marketing/full-reductions
- **描述**: 获取满减活动列表
- **认证**: 需要认证

##### GET /api/admin/marketing/full-reductions/:id
- **描述**: 获取满减活动详情
- **认证**: 需要认证

##### PUT /api/admin/marketing/full-reductions/:id
- **描述**: 更新满减活动
- **认证**: 需要认证

##### DELETE /api/admin/marketing/full-reductions/:id
- **描述**: 删除满减活动
- **认证**: 需要认证

##### POST /api/admin/marketing/full-reductions/:id/activate
- **描述**: 激活满减活动
- **认证**: 需要认证

##### POST /api/admin/marketing/full-reductions/:id/pause
- **描述**: 暂停满减活动
- **认证**: 需要认证

#### 秒杀活动管理

##### POST /api/admin/marketing/flash-sales
- **描述**: 创建秒杀活动
- **认证**: 需要认证

##### GET /api/admin/marketing/flash-sales
- **描述**: 获取秒杀活动列表
- **认证**: 需要认证

##### GET /api/admin/marketing/flash-sales/:id
- **描述**: 获取秒杀活动详情
- **认证**: 需要认证

##### PUT /api/admin/marketing/flash-sales/:id
- **描述**: 更新秒杀活动
- **认证**: 需要认证

##### DELETE /api/admin/marketing/flash-sales/:id
- **描述**: 删除秒杀活动
- **认证**: 需要认证

##### POST /api/admin/marketing/flash-sales/:id/activate
- **描述**: 激活秒杀活动
- **认证**: 需要认证

##### POST /api/admin/marketing/flash-sales/:id/pause
- **描述**: 暂停秒杀活动
- **认证**: 需要认证

##### GET /api/admin/marketing/flash-sales/:id/statistics
- **描述**: 秒杀活动统计
- **认证**: 需要认证

#### 团购活动管理

##### POST /api/admin/marketing/group-buys
- **描述**: 创建团购活动
- **认证**: 需要认证

##### GET /api/admin/marketing/group-buys
- **描述**: 获取团购活动列表
- **认证**: 需要认证

##### GET /api/admin/marketing/group-buys/:id
- **描述**: 获取团购活动详情
- **认证**: 需要认证

##### PUT /api/admin/marketing/group-buys/:id
- **描述**: 更新团购活动
- **认证**: 需要认证

##### DELETE /api/admin/marketing/group-buys/:id
- **描述**: 删除团购活动
- **认证**: 需要认证

##### POST /api/admin/marketing/group-buys/:id/activate
- **描述**: 激活团购活动
- **认证**: 需要认证

##### POST /api/admin/marketing/group-buys/:id/pause
- **描述**: 暂停团购活动
- **认证**: 需要认证

##### GET /api/admin/marketing/group-buys/:id/teams
- **描述**: 获取团购活动团队列表
- **认证**: 需要认证

#### 叠加规则管理

##### POST /api/admin/marketing/stack-rules
- **描述**: 创建促销叠加规则
- **认证**: 需要认证

##### GET /api/admin/marketing/stack-rules
- **描述**: 获取叠加规则列表
- **认证**: 需要认证

##### GET /api/admin/marketing/stack-rules/:id
- **描述**: 获取叠加规则详情
- **认证**: 需要认证

##### PUT /api/admin/marketing/stack-rules/:id
- **描述**: 更新叠加规则
- **认证**: 需要认证

##### DELETE /api/admin/marketing/stack-rules/:id
- **描述**: 删除叠加规则
- **认证**: 需要认证

#### 试算接口

##### POST /api/admin/marketing/calculate
- **描述**: 促销价格试算（计算优惠券、满减、秒杀等叠加后的最终价格）
- **认证**: 需要认证
- **请求体**: { items: [{ skuId, quantity, price }], coupons: [], customerId }

---

### 追溯管理

#### 追溯配置

##### POST /api/admin/trace/configs
- **描述**: 创建追溯配置
- **认证**: 需要认证

##### GET /api/admin/trace/configs
- **描述**: 获取追溯配置列表
- **认证**: 需要认证

##### GET /api/admin/trace/configs/:id
- **描述**: 获取追溯配置详情
- **认证**: 需要认证

##### PUT /api/admin/trace/configs/:id
- **描述**: 更新追溯配置
- **认证**: 需要认证

##### DELETE /api/admin/trace/configs/:id
- **描述**: 删除追溯配置
- **认证**: 需要认证

##### POST /api/admin/trace/configs/check
- **描述**: 检查追溯配置有效性
- **认证**: 需要认证

#### 追溯码管理

##### POST /api/admin/trace/codes/generate
- **描述**: 生成追溯码
- **认证**: 需要认证

##### GET /api/admin/trace/codes
- **描述**: 获取追溯码列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, batchNo, status

##### GET /api/admin/trace/codes/:id
- **描述**: 获取追溯码详情
- **认证**: 需要认证

##### GET /api/admin/trace/codes/:id/status
- **描述**: 获取追溯码状态
- **认证**: 需要认证

##### GET /api/admin/trace/codes/statistics
- **描述**: 追溯码统计
- **认证**: 需要认证

#### 追溯查询

##### GET /api/admin/trace/query/:traceCode
- **描述**: 根据追溯码查询商品信息
- **认证**: 需要认证

##### POST /api/admin/trace/verify
- **描述**: 验证追溯码真伪
- **认证**: 需要认证

#### 召回管理

##### POST /api/admin/trace/recalls
- **描述**: 创建召回记录
- **认证**: 需要认证

##### GET /api/admin/trace/recalls
- **描述**: 获取召回记录列表
- **认证**: 需要认证

##### GET /api/admin/trace/recalls/:id
- **描述**: 获取召回记录详情
- **认证**: 需要认证

##### PUT /api/admin/trace/recalls/:id
- **描述**: 更新召回记录
- **认证**: 需要认证

##### DELETE /api/admin/trace/recalls/:id
- **描述**: 删除召回记录
- **认证**: 需要认证

##### POST /api/admin/trace/recalls/:id/execute
- **描述**: 执行召回
- **认证**: 需要认证

##### POST /api/admin/trace/recalls/:id/complete
- **描述**: 完成召回
- **认证**: 需要认证

---

### 库存批次管理

#### GET /api/admin/inventory-batch
- **描述**: 获取库存批次列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, storeId, skuId, batchNo

#### GET /api/admin/inventory-batch/:id
- **描述**: 获取批次详情
- **认证**: 需要认证

#### POST /api/admin/inventory-batch
- **描述**: 创建库存批次
- **认证**: 需要认证

#### PUT /api/admin/inventory-batch/:id
- **描述**: 更新库存批次
- **认证**: 需要认证

#### DELETE /api/admin/inventory-batch/:id
- **描述**: 删除库存批次
- **认证**: 需要认证

#### 效期预警

##### GET /api/admin/inventory-batch/expiry-alerts
- **描述**: 获取效期预警列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

##### POST /api/admin/inventory-batch/expiry-alerts/:id/handle
- **描述**: 处理效期预警
- **认证**: 需要认证

##### GET /api/admin/inventory-batch/expiry-alerts/statistics
- **描述**: 效期预警统计
- **认证**: 需要认证

---

### 门店管控

#### GET /api/admin/store-control/configs
- **描述**: 获取门店管控配置列表
- **认证**: 需要认证

#### GET /api/admin/store-control/configs/:id
- **描述**: 获取管控配置详情
- **认证**: 需要认证

#### PUT /api/admin/store-control/configs/:id
- **描述**: 更新管控配置
- **认证**: 需要认证

#### POST /api/admin/store-control/:storeId/open
- **描述**: 开启门店
- **认证**: 需要认证

#### POST /api/admin/store-control/:storeId/close
- **描述**: 关闭门店
- **认证**: 需要认证

#### POST /api/admin/store-control/:storeId/suspend
- **描述**: 暂停门店
- **认证**: 需要认证

#### POST /api/admin/store-control/:storeId/resume
- **描述**: 恢复门店
- **认证**: 需要认证

#### GET /api/admin/store-control/logs
- **描述**: 获取管控操作日志
- **认证**: 需要认证

---

### 报表中心

#### 销售报表

##### GET /api/admin/reports/sales-daily
- **描述**: 每日销售报表
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/sales-ranking
- **描述**: 销售排行
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd, type(product/customer)

##### GET /api/admin/reports/sales-trend
- **描述**: 销售趋势
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/customer-contribution
- **描述**: 客户贡献度分析
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

#### 采购报表

##### GET /api/admin/reports/purchase-summary
- **描述**: 采购汇总
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/supplier-ranking
- **描述**: 供应商采购排行
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

#### 库存报表

##### GET /api/admin/reports/inventory-summary
- **描述**: 库存汇总
- **认证**: 需要认证

##### GET /api/admin/reports/inventory-turnover
- **描述**: 库存周转率
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/inventory-age
- **描述**: 库存库龄分析
- **认证**: 需要认证

#### 财务报表

##### GET /api/admin/reports/receivable-payable
- **描述**: 应收应付报表
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/payment-analysis
- **描述**: 付款分析
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/profit
- **描述**: 利润报表
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

##### GET /api/admin/reports/business-overview
- **描述**: 经营概况
- **认证**: 需要认证
- **Query参数**: dateStart, dateEnd

---

### 预警管理

#### GET /api/admin/alerts
- **描述**: 获取预警列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, type, status

#### GET /api/admin/alerts/count
- **描述**: 获取预警数量
- **认证**: 需要认证

#### POST /api/admin/alerts/:id/handle
- **描述**: 处理预警
- **认证**: 需要认证

#### GET /api/admin/alerts/rules
- **描述**: 获取预警规则列表
- **认证**: 需要认证

#### PUT /api/admin/alerts/rules/:id
- **描述**: 更新预警规则
- **认证**: 需要认证

#### POST /api/admin/alerts/check
- **描述**: 手动触发预警检查
- **认证**: 需要认证

---

### 售后管理（管理端）

#### GET /api/admin/aftersales
- **描述**: 获取售后申请列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status, type

#### GET /api/admin/aftersales/:id
- **描述**: 获取售后申请详情
- **认证**: 需要认证

#### POST /api/admin/aftersales/:id/approve
- **描述**: 审批通过售后申请
- **认证**: 需要认证

#### POST /api/admin/aftersales/:id/reject
- **描述**: 审批拒绝售后申请
- **认证**: 需要认证

#### POST /api/admin/aftersales/:id/confirm-receipt
- **描述**: 确认收货（退货场景）
- **认证**: 需要认证

#### POST /api/admin/aftersales/:id/inspect
- **描述**: 验货
- **认证**: 需要认证

#### POST /api/admin/aftersales/:id/complete
- **描述**: 完成售后（退款/换货）
- **认证**: 需要认证

#### GET /api/admin/aftersales/statistics
- **描述**: 售后统计
- **认证**: 需要认证

---

### 角色权限管理

#### GET /api/admin/roles
- **描述**: 获取角色列表
- **认证**: 需要认证

#### POST /api/admin/roles
- **描述**: 创建角色
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| roleName | string | 是 | 角色名称 |
| roleCode | string | 是 | 角色编码 |
| description | string | 否 | 描述 |
| permissions | string[] | 否 | 权限列表，默认[] |
| dataScope | string | 否 | 数据范围: ALL/DEPARTMENT/STORE/SELF，默认SELF |

#### GET /api/admin/roles/:id
- **描述**: 获取角色详情
- **认证**: 需要认证

#### PUT /api/admin/roles/:id
- **描述**: 更新角色
- **认证**: 需要认证
- **请求体**: roleName, description, permissions, dataScope, status（均可选）

#### DELETE /api/admin/roles/:id
- **描述**: 删除角色（SUPER_ADMIN不可删）
- **认证**: 需要认证

#### GET /api/admin/roles/users/:userId/roles
- **描述**: 获取用户角色列表
- **认证**: 需要认证

#### PUT /api/admin/roles/users/:userId/roles
- **描述**: 设置用户角色（替换式）
- **认证**: 需要认证
- **请求体**: { roleIds: number[] }

---

### 通知管理（管理端）

#### GET /api/admin/notifications
- **描述**: 获取通知列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, type, isRead

#### GET /api/admin/notifications/unread-count
- **描述**: 获取未读通知数量
- **认证**: 需要认证

#### PUT /api/admin/notifications/:id/read
- **描述**: 标记通知已读
- **认证**: 需要认证

#### POST /api/admin/notifications/read-all
- **描述**: 全部标记已读
- **认证**: 需要认证

#### POST /api/admin/notifications/send
- **描述**: 手动发送通知
- **认证**: 需要认证
- **请求体**: recipientId, recipientType, title, content, type, relatedId, relatedType

---

### 调拨管理（管理端）

#### POST /api/admin/transfers
- **描述**: 创建调拨单
- **认证**: 需要认证
- **请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fromStoreId | number | 是 | 调出门店ID |
| toStoreId | number | 是 | 调入门店ID |
| expectedDate | string | 否 | 预计到达日期 |
| remark | string | 否 | 备注 |
| items | array | 是 | 调拨明细 |
| items[].skuId | number | 是 | SKU ID |
| items[].skuName | string | 是 | SKU名称 |
| items[].quantity | number | 是 | 数量 |
| items[].unitPrice | number | 是 | 单价 |

#### GET /api/admin/transfers
- **描述**: 获取调拨单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status, storeId, dateStart, dateEnd

#### GET /api/admin/transfers/statistics
- **描述**: 调拨统计
- **认证**: 需要认证

#### GET /api/admin/transfers/:id
- **描述**: 获取调拨单详情（含明细）
- **认证**: 需要认证

#### PUT /api/admin/transfers/:id
- **描述**: 更新调拨单（仅DRAFT状态）
- **认证**: 需要认证

#### POST /api/admin/transfers/:id/submit
- **描述**: 提交审核
- **认证**: 需要认证

#### POST /api/admin/transfers/:id/approve
- **描述**: 审核通过
- **认证**: 需要认证

#### POST /api/admin/transfers/:id/reject
- **描述**: 审核拒绝（退回DRAFT）
- **认证**: 需要认证

#### POST /api/admin/transfers/:id/cancel
- **描述**: 取消调拨单
- **认证**: 需要认证

#### POST /api/admin/transfers/:id/ship
- **描述**: 发货出库（扣减调出门店库存，状态变为在途）
- **认证**: 需要认证

---

### 盘点管理（管理端）

#### POST /api/admin/stock-checks
- **描述**: 创建盘点单
- **认证**: 需要认证
- **请求体**: { storeId: number, remark: string }

#### GET /api/admin/stock-checks
- **描述**: 获取盘点单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, storeId, status

#### GET /api/admin/stock-checks/statistics
- **描述**: 盘点统计（本月盘点数、差异数、差异金额）
- **认证**: 需要认证

#### GET /api/admin/stock-checks/:id
- **描述**: 获取盘点单详情（含明细）
- **认证**: 需要认证

#### PUT /api/admin/stock-checks/:id
- **描述**: 更新盘点单（仅DRAFT状态）
- **认证**: 需要认证

#### POST /api/admin/stock-checks/:id/start
- **描述**: 开始盘点（自动生成明细，状态变为CHECKING）
- **认证**: 需要认证

#### POST /api/admin/stock-checks/:id/complete
- **描述**: 完成盘点（计算差异汇总）
- **认证**: 需要认证

#### POST /api/admin/stock-checks/:id/cancel
- **描述**: 取消盘点
- **认证**: 需要认证

#### POST /api/admin/stock-checks/:id/handle-diff
- **描述**: 处理差异（根据实际数量调整库存）
- **认证**: 需要认证
- **请求体**: { itemId: number }

---

### 订单超时管理

#### GET /api/admin/order-timeout/configs
- **描述**: 获取订单超时配置列表
- **认证**: 需要认证

#### POST /api/admin/order-timeout/configs
- **描述**: 新增超时配置
- **认证**: 需要认证
- **请求体**: orderType(SALE/PURCHASE/TRANSFER), timeoutType, timeoutMinutes, action, enabled, description

#### PUT /api/admin/order-timeout/configs/:id
- **描述**: 更新超时配置
- **认证**: 需要认证

#### DELETE /api/admin/order-timeout/configs/:id
- **描述**: 删除超时配置
- **认证**: 需要认证

#### GET /api/admin/order-timeout/logs
- **描述**: 获取超时处理日志（分页+筛选）
- **认证**: 需要认证
- **Query参数**: page, pageSize, result, dateStart, dateEnd

#### GET /api/admin/order-timeout/statistics
- **描述**: 超时处理统计（今日/本周/本月处理数量）
- **认证**: 需要认证

---

### 审计日志

#### GET /api/admin/audit-logs
- **描述**: 获取审计日志列表（分页+筛选）
- **认证**: 需要认证
- **Query参数**: page, pageSize, userId, action, resourceType, dateStart, dateEnd

#### GET /api/admin/audit-logs/statistics
- **描述**: 审计日志统计（今日/本周/本月数量、操作分布、用户分布）
- **认证**: 需要认证

---

### 数据导出

#### GET /api/admin/export/customers
- **描述**: 导出客户列表CSV
- **认证**: 需要认证
- **Query参数**: keyword

#### GET /api/admin/export/suppliers
- **描述**: 导出供应商列表CSV
- **认证**: 需要认证
- **Query参数**: keyword, supplyType

#### GET /api/admin/export/products
- **描述**: 导出商品列表CSV
- **认证**: 需要认证
- **Query参数**: keyword

#### GET /api/admin/export/inventory
- **描述**: 导出库存明细CSV
- **认证**: 需要认证
- **Query参数**: storeId, keyword

#### GET /api/admin/export/purchase-orders
- **描述**: 导出采购单CSV
- **认证**: 需要认证
- **Query参数**: keyword, status

#### GET /api/admin/export/payments
- **描述**: 导出付款记录CSV
- **认证**: 需要认证
- **Query参数**: status

#### GET /api/admin/export/audit-logs
- **描述**: 导出审计日志CSV
- **认证**: 需要认证
- **Query参数**: action, resourceType, dateStart, dateEnd

---

### 系统配置

#### GET /api/admin/sys-config
- **描述**: 获取所有系统配置（按分组返回）
- **认证**: 需要认证

#### GET /api/admin/sys-config/:group
- **描述**: 获取指定分组配置
- **认证**: 需要认证

#### PUT /api/admin/sys-config/batch
- **描述**: 批量更新配置
- **认证**: 需要认证
- **请求体**: `[{ config_key, config_value }]`

#### POST /api/admin/sys-config
- **描述**: 新增配置项
- **认证**: 需要认证
- **请求体**: config_key, config_value, config_group, description

---

## 门店终端接口

### 认证

#### POST /api/store/auth/login
- **描述**: 门店登录
- **认证**: 无需认证
- **请求体**: { username, password }

#### GET /api/store/auth/me
- **描述**: 获取当前门店用户信息
- **认证**: 需要认证

### 门店信息

#### GET /api/store/info
- **描述**: 获取门店基本信息
- **认证**: 需要认证

### 商品

#### GET /api/store/products
- **描述**: 获取门店商品列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, categoryId

### 客户

#### GET /api/store/members
- **描述**: 获取门店客户列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword

### 库存

#### GET /api/store/inventory
- **描述**: 获取门店库存
- **认证**: 需要认证
- **Query参数**: skuId, keyword, page, pageSize

### 订单管理

#### GET /api/store/orders
- **描述**: 获取门店订单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status, keyword, dateStart, dateEnd

#### POST /api/store/orders/:orderNo/accept
- **描述**: 接单
- **认证**: 需要认证

#### POST /api/store/orders/:orderNo/start-delivery
- **描述**: 开始配送
- **认证**: 需要认证

#### POST /api/store/orders/:orderNo/complete-delivery
- **描述**: 完成配送
- **认证**: 需要认证

#### POST /api/store/orders/:orderNo/reject
- **描述**: 拒单
- **认证**: 需要认证

#### POST /api/store/orders/:orderNo/cancel
- **描述**: 取消订单
- **认证**: 需要认证

#### GET /api/store/orders/:orderNo
- **描述**: 获取订单详情
- **认证**: 需要认证

### 销售单

#### GET /api/store/sale-bills
- **描述**: 获取销售单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, status, dateStart, dateEnd

#### POST /api/store/sale-bills
- **描述**: 创建销售单
- **认证**: 需要认证
- **请求体**: { customerId, items: [{ skuId, skuName, quantity, unitPrice, subtotal }], discountAmount, remark }

#### GET /api/store/sale-bills/:billNo
- **描述**: 获取销售单详情
- **认证**: 需要认证

#### POST /api/store/sale-bills/:billNo/collection-link
- **描述**: 生成收款链接
- **认证**: 需要认证

#### POST /api/store/sale-bills/:billNo/offline-payment
- **描述**: 线下收款
- **认证**: 需要认证
- **请求体**: { paymentMethod, amount }

### 库存操作

#### POST /api/store/inventory/adjust
- **描述**: 库存调整
- **认证**: 需要认证
- **请求体**: { skuId, changeQty, reason }

#### GET /api/store/inventory/logs
- **描述**: 获取库存变动日志
- **认证**: 需要认证
- **Query参数**: page, pageSize

### 收款/退款

#### GET /api/store/collection-links
- **描述**: 获取门店收款链接列表
- **认证**: 需要认证

#### GET /api/store/payment-orders
- **描述**: 获取门店付款订单列表
- **认证**: 需要认证

#### GET /api/store/refund-orders
- **描述**: 获取门店退款订单列表
- **认证**: 需要认证

### 挂单管理

#### POST /api/store/hold-orders
- **描述**: 创建挂单
- **认证**: 需要认证

#### GET /api/store/hold-orders
- **描述**: 获取挂单列表
- **认证**: 需要认证

#### POST /api/store/hold-orders/:id/restore
- **描述**: 恢复挂单
- **认证**: 需要认证

#### DELETE /api/store/hold-orders/:id
- **描述**: 删除挂单
- **认证**: 需要认证

### 门店看板

#### GET /api/store/dashboard
- **描述**: 门店看板数据
- **认证**: 需要认证

#### GET /api/store/daily-sales
- **描述**: 门店当日销售数据
- **认证**: 需要认证

#### GET /api/store/inventory/alerts
- **描述**: 门店库存预警
- **认证**: 需要认证

### 应收管理

#### GET /api/store/receivables
- **描述**: 获取应收款列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

#### POST /api/store/receivables/payment
- **描述**: 登记收款
- **认证**: 需要认证
- **请求体**: { customerId, amount, paymentMethod, remark }

### 门店管控

#### GET /api/store/control/status
- **描述**: 获取当前门店管控状态
- **认证**: 需要认证

#### GET /api/store/control/my-logs
- **描述**: 获取当前门店管控操作日志
- **认证**: 需要认证

### 调拨（门店端）

#### POST /api/store/transfers/:id/receive
- **描述**: 调拨收货入库
- **认证**: 需要认证
- **请求体**: { items: [{ itemId, receivedQty }] }

#### GET /api/store/transfers/in-transit
- **描述**: 当前门店在途调拨单（作为调入方）
- **认证**: 需要认证

#### GET /api/store/transfers/my-shipments
- **描述**: 当前门店已发货调拨单（作为调出方）
- **认证**: 需要认证

### 盘点（门店端）

#### GET /api/store/stock-checks/my
- **描述**: 当前门店的盘点单列表
- **认证**: 需要认证

#### GET /api/store/stock-checks/:id
- **描述**: 盘点单详情（含明细）
- **认证**: 需要认证

#### PUT /api/store/stock-checks/:id/items/:itemId
- **描述**: 录入实盘数量
- **认证**: 需要认证
- **请求体**: { actualQty: number }

#### POST /api/store/stock-checks/:id/submit
- **描述**: 提交盘点（门店端完成录入）
- **认证**: 需要认证

---

## 小程序接口

### 微信认证

> 路由前缀: `/api/miniapp/wechat`（详见上方认证接口章节）

### 商品浏览

#### GET /api/miniapp/products
- **描述**: 获取小程序商品列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, keyword, categoryId

### 购物车

> 路由前缀: `/api/miniapp/cart`，所有接口均需要认证

#### GET /api/miniapp/cart
- **描述**: 获取购物车列表
- **认证**: 需要认证

#### POST /api/miniapp/cart
- **描述**: 添加商品到购物车
- **认证**: 需要认证
- **请求体**: { skuId, quantity }

#### PUT /api/miniapp/cart/:id
- **描述**: 更新购物车商品数量
- **认证**: 需要认证
- **请求体**: { quantity }

#### DELETE /api/miniapp/cart/:id
- **描述**: 删除购物车商品
- **认证**: 需要认证

#### DELETE /api/miniapp/cart/clear
- **描述**: 清空购物车
- **认证**: 需要认证

#### GET /api/miniapp/cart/count
- **描述**: 获取购物车商品数量
- **认证**: 需要认证

#### GET /api/miniapp/cart/checkout/preview
- **描述**: 结算预览（计算价格、优惠、运费等）
- **认证**: 需要认证
- **Query参数**: itemIds(购物车项ID，逗号分隔)

#### POST /api/miniapp/cart/checkout/create
- **描述**: 创建订单（从购物车结算）
- **认证**: 需要认证
- **请求体**: { itemIds, address, couponId, remark, paymentMethod }

### 小程序订单

#### POST /api/miniapp/orders
- **描述**: 创建订单
- **认证**: 需要认证
- **请求体**: { items, address, couponId, remark, paymentMethod }

#### GET /api/miniapp/orders
- **描述**: 获取订单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status

#### GET /api/miniapp/orders/:orderNo
- **描述**: 获取订单详情
- **认证**: 需要认证

#### POST /api/miniapp/orders/:orderNo/confirm-receipt
- **描述**: 确认收货
- **认证**: 需要认证

#### GET /api/miniapp/statements
- **描述**: 获取对账单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

#### GET /api/miniapp/statements/:id
- **描述**: 获取对账单详情
- **认证**: 需要认证

### 小程序售后

#### POST /api/miniapp/aftersales
- **描述**: 创建售后申请
- **认证**: 需要认证
- **请求体**: orderNo, type(REFUND/EXCHANGE/REFUND_AND_RETURN), reason, items, amount

#### GET /api/miniapp/aftersales/mine
- **描述**: 我的售后列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status

#### GET /api/miniapp/aftersales/:id
- **描述**: 售后详情
- **认证**: 需要认证

#### POST /api/miniapp/aftersales/:id/cancel
- **描述**: 取消售后
- **认证**: 需要认证

#### POST /api/miniapp/aftersales/:id/return-logistics
- **描述**: 填写退货物流信息
- **认证**: 需要认证
- **请求体**: { logisticsCompany, trackingNo }

#### POST /api/miniapp/aftersales/:id/rate
- **描述**: 评价售后处理
- **认证**: 需要认证
- **请求体**: { rating, comment }

### 小程序营销

#### GET /api/miniapp/marketing/coupons/available
- **描述**: 获取可领取的优惠券列表
- **认证**: 需要认证

#### POST /api/miniapp/marketing/coupons/:templateId/claim
- **描述**: 领取优惠券
- **认证**: 需要认证

#### GET /api/miniapp/marketing/coupons/mine
- **描述**: 我的优惠券列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, status

#### GET /api/miniapp/marketing/flash-sale/active
- **描述**: 获取进行中的秒杀活动
- **认证**: 需要认证

#### POST /api/miniapp/marketing/flash-sale/:id/buy
- **描述**: 秒杀购买
- **认证**: 需要认证

#### GET /api/miniapp/marketing/group-buy/active
- **描述**: 获取进行中的团购活动
- **认证**: 需要认证

#### POST /api/miniapp/marketing/group-buy/:id/create-team
- **描述**: 创建团购团队
- **认证**: 需要认证

#### GET /api/miniapp/marketing/group-buy/teams/:teamId
- **描述**: 获取团购团队详情
- **认证**: 需要认证

#### POST /api/miniapp/marketing/group-buy/:id/join
- **描述**: 加入团购团队
- **认证**: 需要认证

### 小程序追溯

#### GET /api/miniapp/trace/c/query/:traceCode
- **描述**: 消费者追溯查询
- **认证**: 无需认证

#### POST /api/miniapp/trace/c/verify
- **描述**: 消费者验证追溯码真伪
- **认证**: 无需认证

### 小程序通知

#### GET /api/miniapp/notifications
- **描述**: 我的通知列表
- **认证**: 需要认证
- **Query参数**: page, pageSize

#### GET /api/miniapp/notifications/unread-count
- **描述**: 未读通知数量
- **认证**: 需要认证

#### PUT /api/miniapp/notifications/:id/read
- **描述**: 标记通知已读
- **认证**: 需要认证

#### POST /api/miniapp/notifications/read-all
- **描述**: 全部标记已读
- **认证**: 需要认证

---

## 支付接口

### POST /api/pay/orders
- **描述**: 创建支付订单
- **认证**: 需要认证
- **请求体**: { orderNo, amount, channel, openid }

### POST /api/pay/wx/callback
- **描述**: 微信支付回调通知
- **认证**: 无需认证（微信服务器回调）

### POST /api/pay/refunds
- **描述**: 创建退款
- **认证**: 需要认证
- **请求体**: { paymentNo, refundAmount, reason }

---

## 公开接口

### GET /api/share/collections/:token
- **描述**: 查看收款链接（公开页面，无需登录）
- **认证**: 无需认证
- **路径参数**: token - 收款链接token

### POST /api/share/collections/:token/pay
- **描述**: 通过收款链接支付
- **认证**: 无需认证
- **路径参数**: token - 收款链接token
- **请求体**: { paymentMethod, payerName, payerPhone }

---

## 即时零售接口

### Webhook回调

#### POST /api/instant-retail/webhook/jd
- **描述**: 京东到家回调
- **认证**: 无需认证（平台回调）

#### POST /api/instant-retail/webhook/meituan
- **描述**: 美团回调
- **认证**: 无需认证（平台回调）

#### POST /api/instant-retail/webhook/eleme
- **描述**: 饿了么回调
- **认证**: 无需认证（平台回调）

### 即时零售管理（管理端）

#### GET /api/instant-retail/admin/platforms
- **描述**: 获取已接入平台列表
- **认证**: 需要认证

#### GET /api/instant-retail/admin/configs
- **描述**: 获取平台配置列表
- **认证**: 需要认证

#### POST /api/instant-retail/admin/configs
- **描述**: 创建平台配置
- **认证**: 需要认证

#### GET /api/instant-retail/admin/configs/:id
- **描述**: 获取平台配置详情
- **认证**: 需要认证

#### PUT /api/instant-retail/admin/configs/:id
- **描述**: 更新平台配置
- **认证**: 需要认证

#### DELETE /api/instant-retail/admin/configs/:id
- **描述**: 删除平台配置
- **认证**: 需要认证

#### POST /api/instant-retail/admin/configs/:id/test
- **描述**: 测试平台配置连通性
- **认证**: 需要认证

#### POST /api/instant-retail/admin/sync-orders
- **描述**: 同步平台订单
- **认证**: 需要认证

#### POST /api/instant-retail/admin/sync-products
- **描述**: 同步商品到平台
- **认证**: 需要认证

#### DELETE /api/instant-retail/admin/configs/:id
- **描述**: 删除平台配置
- **认证**: 需要认证

### 即时零售（门店端）

#### GET /api/instant-retail/store/orders
- **描述**: 获取即时零售订单列表
- **认证**: 需要认证
- **Query参数**: page, pageSize, platform, status

#### GET /api/instant-retail/store/orders/:id
- **描述**: 获取即时零售订单详情
- **认证**: 需要认证

#### POST /api/instant-retail/store/orders/:id/confirm
- **描述**: 确认即时零售订单
- **认证**: 需要认证

#### POST /api/instant-retail/store/orders/:id/start-delivery
- **描述**: 开始配送
- **认证**: 需要认证

#### POST /api/instant-retail/store/orders/:id/complete-delivery
- **描述**: 完成配送
- **认证**: 需要认证

#### POST /api/instant-retail/store/orders/:id/cancel
- **描述**: 取消即时零售订单
- **认证**: 需要认证

---

## 附录：API统计

| 模块 | API数量 |
|------|---------|
| 健康检查 | 1 |
| 认证（管理端+微信） | 7 |
| 员工管理 | 4 |
| 客户管理 | 12 |
| 门店管理 | 6 |
| 商品管理 | 7 |
| 销售单管理 | 2 |
| 日结管理 | 3 |
| 销售退货管理 | 3 |
| 客户对账单 | 3 |
| 客户付款记录 | 2 |
| 小程序订单管理 | 3 |
| 库存管理 | 3 |
| 收款链接 | 1 |
| 付款订单 | 1 |
| 退款订单 | 1 |
| 数据看板 | 7 |
| 供应商管理 | 8 |
| 采购单管理 | 7 |
| 采购入库管理 | 2 |
| 采购退货管理 | 2 |
| 采购付款管理 | 7 |
| 供应商对账 | 5 |
| 价格管理 | 14 |
| 信用额度管理 | 16 |
| 营销管理（优惠券） | 9 |
| 营销管理（满减） | 7 |
| 营销管理（秒杀） | 9 |
| 营销管理（团购） | 8 |
| 营销管理（叠加规则） | 5 |
| 营销管理（试算） | 1 |
| 追溯管理（配置） | 6 |
| 追溯管理（追溯码） | 5 |
| 追溯管理（查询/验证） | 2 |
| 追溯管理（召回） | 7 |
| 库存批次管理 | 5 |
| 效期预警 | 3 |
| 门店管控 | 8 |
| 报表中心（销售） | 4 |
| 报表中心（采购） | 2 |
| 报表中心（库存） | 3 |
| 报表中心（财务） | 4 |
| 预警管理 | 5 |
| 售后管理（管理端） | 8 |
| 角色权限管理 | 7 |
| 通知管理（管理端） | 5 |
| 通知管理（小程序） | 4 |
| 调拨管理（管理端） | 10 |
| 调拨管理（门店端） | 3 |
| 盘点管理（管理端） | 9 |
| 盘点管理（门店端） | 4 |
| 订单超时管理 | 5 |
| 审计日志 | 2 |
| 数据导出 | 7 |
| 系统配置 | 4 |
| 门店终端 | 28 |
| 小程序（商品/订单） | 8 |
| 小程序（购物车） | 8 |
| 小程序（售后） | 6 |
| 小程序（营销） | 9 |
| 小程序（追溯） | 2 |
| 支付接口 | 3 |
| 公开接口 | 2 |
| 即时零售（Webhook） | 3 |
| 即时零售（管理端） | 11 |
| 即时零售（门店端） | 6 |
| **合计** | **~290** |
