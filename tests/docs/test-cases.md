
# 智享全链管理系统 - 功能测试用例集

> 版本: v1.0 · 生效日期: 2026/06/17

---

## 测试用例模板说明

- **ID**: 唯一标识，格式 `TC-模块缩写-序号`
- **模块**: 业务模块名称
- **用例名称**: 测试用例简要描述
- **前置条件**: 执行测试前需满足的条件
- **测试步骤**: 详细步骤
- **预期结果**: 预期行为
- **优先级**: P0/P1/P2
- **测试方法**: 手工/自动

---

## 模块 1: 认证与鉴权 (Auth)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-AUTH-001 | 管理员正确登录 | 1. POST `/api/admin/auth/login` body `{"username":"admin","password":"admin123"} | HTTP 200，返回 `code=0`，`data.token` 非空 | P0 |
| TC-AUTH-002 | 错误密码登录 | 1. POST `/api/admin/auth/login` body `{"username":"admin","password":"wrongpass"}` | HTTP 401，返回 `code=401`，`message` 包含"账号或密码错误" | P0 |
| TC-AUTH-003 | 空密码登录 | 1. POST `/api/admin/auth/login` body `{"username":"admin","password":""}` | HTTP 400/401，返回错误 | P1 |
| TC-AUTH-004 | 未提供 body 的请求 | 1. POST `/api/admin/auth/login` 无 body | HTTP 400 或 Zod validation 错误 | P2 |
| TC-AUTH-005 | 无 Token 访问受限接口 | 1. GET `/api/admin/products` 无 `Authorization` 头 | HTTP 401，返回 `code=401`，`message="未登录"` | P0 |
| TC-AUTH-006 | Token 格式错误 | 1. GET `/api/admin/products` header `Authorization: Bearer invalid-token` | HTTP 401，返回 `code=401`，`message="登录已失效"` | P1 |
| TC-AUTH-007 | 伪造 Token（未用正确 secret） | 1. 用非正确 secret 签发的 token 调用 `/api/admin/products` | HTTP 401，拒绝访问 | P1 |
| TC-AUTH-008 | 过期 Token | 1. 使用过期 JWT 调用 `/api/admin/products` | HTTP 401 | P2 |
| TC-AUTH-009 | Token 大小写正确 | 1. POST 登录获取 token 2. 使用 token 调用接口 | code=0，正常访问 | P2 |
| TC-AUTH-010 | 门店 Token 与后台 Token 不互通 | 1. 获取后台 admin token 2. 使用 admin token 调用 `/api/store/orders` | 不允许，返回 401 或拒绝 | P1 |

## 模块 2: 商品管理 (Products)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-PROD-001 | 查询商品列表 | 1. GET `/api/admin/products?page=1&pageSize=10` | HTTP 200，`code=0`，返回 `total` 和 `records` 数组 | P0 |
| TC-PROD-002 | 商品列表空搜索 | 1. GET `/api/admin/products?keyword=__not_exists__` | code=0，records 空数组 | P2 |
| TC-PROD-003 | 分页参数正确性 | 1. GET `/api/admin/products?page=1&pageSize=5` | records.length <= 5，total 正确 | P1 |
| TC-PROD-004 | 创建商品 | 1. POST `/api/admin/products` body `{"name":"测试商品","categoryId":1,"saleChannels":["MINIAPP","STORE"],"skus":[{"skuName":"测试SKU","barcode":"TEST001","boxRatio":1,"temperature":"NORMAL","traceEnabled":false,"warningThreshold":10,"costPrice":50,"retailPrice":99}]}` | code=0，返回 `id` 和 `spuCode` | P0 |
| TC-PROD-005 | 商品创建重复 SKU name | 1. POST 同上 body 两次 | 第二次返回错误或相同 SKU | P2 |
| TC-PROD-006 | 创建商品缺少必填字段 | 1. POST 缺少 `name` field | HTTP 400，返回 validation error | P1 |
| TC-PROD-007 | 商品价格字段类型验证 | 1. POST 商品 body 中 price=非数字 | HTTP 400 | P2 |
| TC-PROD-008 | 商品价格调整 | 1. 首先 POST `/api/admin/products` 创建 SKU 2. 取 `skuId` 3. PUT `/api/admin/products/:skuId/price` body `{"retailPrice":129}` | code=0，价格变更成功 | P1 |
| TC-PROD-009 | 商品列表字段验证 | 1. GET 商品列表 2. 检查每条记录有 `spuId` `skuId` `name` `retailPrice` | 字段完整 | P1 |

## 模块 3: 门店管理 (Stores)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-STORE-001 | 查询门店列表 | 1. GET `/api/admin/system/stores?page=1&pageSize=10` | HTTP 200，code=0，records 包含门店数据 | P0 |
| TC-STORE-002 | 创建新门店 | 1. POST `/api/admin/system/stores` body `{"name":"TestStore","address":"TestAddr","deliveryRadius":3}` | code=0，返回 `id` `storeCode` `name` | P0 |
| TC-STORE-003 | 门店搜索 | 1. GET `/api/admin/system/stores?keyword=Test` | 返回包含关键字的记录 | P2 |
| TC-STORE-004 | 创建门店缺少必填字段 | 1. POST `/api/admin/system/stores` body 缺少 name | HTTP 400 或 validation error | P2 |

## 模块 4: 订单管理 (Orders)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-ORDER-001 | 查询订单列表 | 1. GET `/api/admin/orders?page=1&pageSize=10` | code=0，records 是订单数组 | P0 |
| TC-ORDER-002 | 订单详情 | 1. GET `/api/admin/orders/:orderNo` | code=0，返回 `orderNo` `orderStatus` `items` | P0 |
| TC-ORDER-003 | 订单不存在 | 1. GET `/api/admin/orders/__not_exists_order_no__` | HTTP 404，code=404 | P1 |
| TC-ORDER-004 | 订单筛选 - 状态 | 1. GET `/api/admin/orders?status=PENDING_PAYMENT` | 结果只包含此状态订单 | P1 |
| TC-ORDER-005 | 订单筛选 - 关键字 | 1. GET `/api/admin/orders?keyword=139` | 返回包含该关键字的订单 | P1 |
| TC-ORDER-006 | 订单导出 CSV | 1. GET `/api/admin/orders/export.csv` | HTTP 200，返回 CSV content，头部 `content-type: text/csv` | P1 |
| TC-ORDER-007 | 订单分页 | 1. GET `/api/admin/orders?page=1&pageSize=5` | total 正确，records 不多于 5 | P1 |
| TC-ORDER-008 | 小程序下单 | 1. POST `/api/miniapp/orders` body `{"storeId":1,"fulfillmentType":"PICKUP","items":[{"skuId":1,"qty":1}]}` | code=0，返回 `orderNo` | P0 |
| TC-ORDER-009 | 小程序下单 qty/quantity 兼容 | 1. POST `/api/miniapp/orders` body 用 `quantity` 字段 | code=0，返回 `orderNo` | P1 |
| TC-ORDER-010 | 小程序订单列表 | 1. GET `/api/miniapp/orders` | code=0，records 正确 | P1 |

## 模块 5: 销售单 (Sale Bills)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-BILL-001 | 创建销售单 | 1. POST `/api/store/sale-bills` body `{"storeId":1,"items":[{"skuId":1,"totalBottleQty":2,"unitPrice":100}]}` | code=0，返回 `billNo` | P0 |
| TC-BILL-002 | 销售单列表 | 1. GET `/api/store/sale-bills` | code=0，records 是数组 | P0 |
| TC-BILL-003 | 销售单详情 | 1. 先创建 2. GET `/api/store/sale-bills/:billNo` | code=0，返回 `billNo` `items` 等 | P0 |
| TC-BILL-004 | 销售单 offline-payment | 1. 创建销售单 2. POST `/api/store/sale-bills/:billNo/offline-payment` body `{"amount":100,"paymentMethod":"CASH"}` | code=0，收款成功 | P0 |
| TC-BILL-005 | 销售单创建分享收款链接 | 1. 创建销售单 2. POST `/api/store/sale-bills/:billNo/collection-link` body `{"shareChannel":"LINK","amount":100}` | code=0，返回 `linkNo` `shareUrl` | P0 |
| TC-BILL-006 | 销售单金额正确（零售/批发/门店价） | 1. 不同 customerType 验证 priceType | customerType 影响了价格计算 | P1 |
| TC-BILL-007 | 销售单重复创建 | 1. 两次 POST 相同 body | 返回两个 billNo，互不干扰 | P2 |
| TC-BILL-008 | 销售单支付金额超过未收金额 | 1. 创建 bill 2. 离线收款 amount 大于未收 | HTTP 400 或错误 | P1 |

## 模块 6: 库存管理 (Inventory)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-INV-001 | 后台库存总览 | 1. GET `/api/admin/inventory/balances` | code=0，返回 records 数组（含 storeId/skuId/physicalQty/availableQty） | P0 |
| TC-INV-002 | 后台库存流水 | 1. GET `/api/admin/inventory/logs?page=1&pageSize=10` | code=0，records 数组（含 logNo/skuName/changeQty/beforeQty/afterQty） | P0 |
| TC-INV-003 | 后台库存预警 | 1. GET `/api/admin/inventory/alerts` | code=0，返回 records 数组（availableQty <= 5） | P0 |
| TC-INV-004 | 门店库存查询 | 1. GET `/api/store/inventory?storeId=1` | code=0，records 数组 | P0 |
| TC-INV-005 | 门店库存调整 | 1. POST `/api/store/inventory/adjust` body `{"skuId":1,"stockType":"OFFLINE","change":10,"remark":"测试调整"}` | code=0 | P1 |
| TC-INV-006 | 调整后库存流水记录 | 1. POST 调整 2. GET `/api/store/inventory/logs` | 新增了一条 logNo 记录 | P1 |
| TC-INV-007 | availableQty 可用性 | 1. GET 库存总览 2. 验证 availableQty 正确计算 | 所有 SKU 都有 availableQty 字段 | P1 |
| TC-INV-008 | 库存预警阈值逻辑 | 1. GET `/api/admin/inventory/alerts` 2. 验证每条记录的 availableQty <= 5 | 所有记录 availableQty <=5 | P1 |

## 模块 7: 客户管理 (Members)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-MEM-001 | 客户列表 | 1. GET `/api/admin/members` | code=0，records 数组 | P0 |
| TC-MEM-002 | 新增客户 | 1. POST `/api/admin/members` body `{"name":"测试客户","mobile":"13900000000","customerType":"RETAIL"}` | code=0，返回 `memberId` `name` `mobile` | P0 |
| TC-MEM-003 | 手机号重复检测 | 1. 两次 POST 同 mobile | 第二次返回错误或允许 | P2 |
| TC-MEM-004 | 客户分配给销售员 | 1. 取 memberId 2. POST `/api/admin/members/:memberId/assign` body `{"staffId":1}` | code=0 | P1 |
| TC-MEM-005 | 客户价格历史查询 | 1. GET `/api/admin/members/:memberId/price-history?skuId=1` | code=0，返回 lastPrice/highestPrice/lowestPrice | P1 |
| TC-MEM-006 | 客户搜索 | 1. GET `/api/admin/members?keyword=测试` | 仅返回匹配的客户 | P2 |

## 模块 8: 收款与退款 (Payment/Refund)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-PAY-001 | 后台支付记录查询 | 1. GET `/api/admin/payment-orders` | code=0，records 数组（含 payNo/sourceType/sourceNo/amount/status/paymentMethod） | P0 |
| TC-PAY-002 | 门店支付记录查询 | 1. GET `/api/store/payment-orders` | code=0 | P0 |
| TC-PAY-003 | 后台退款记录查询 | 1. GET `/api/admin/refund-orders` | code=0，records 数组 | P0 |
| TC-PAY-004 | 分享收款链接查询 | 1. GET `/api/admin/collection-links` | code=0，records 数组（含 linkNo/sourceNo/amount/shareUrl） | P0 |
| TC-PAY-005 | 门店分享收款链接查询 | 1. GET `/api/store/collection-links` | code=0 | P0 |
| TC-PAY-006 | 分享收款页详情 | 1. POST `/api/store/sale-bills/:billNo/collection-link` 创建 2. 访问返回的 shareUrl | 页面展示正确的销售单详情与金额 | P1 |
| TC-PAY-007 | 销售单离线收款后状态 | 1. 创建 bill 2. 离线收款 3. GET 销售单详情 | 收款状态变更（PAID/PARTIAL） | P0 |
| TC-PAY-008 | 未收到款金额计算 | 1. 创建 bill receivableAmount=200，receivableAmount=0，receivedAmount=0 2. 离线收款 50 3. GET 详情 | unreceivedAmount = 150 | P0 |

## 模块 9: 挂单 (Hold Orders)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-HOLD-001 | 创建挂单 | 1. POST `/api/store/hold-orders` body `{"customerName":"测试","customerMobile":"13900000001","items":[{"skuId":1,"skuName":"SKU1","quantity":1,"unitPrice":100,"subtotalAmount":100}]}` | code=0，返回 `holdNo` | P0 |
| TC-HOLD-002 | 挂单列表查询 | 1. GET `/api/store/hold-orders` | code=0，records 数组 | P0 |
| TC-HOLD-003 | 取单恢复 | 1. 创建 hold 2. POST `/api/store/hold-orders/:holdNo/restore` | code=0，返回 `items` | P1 |
| TC-HOLD-004 | 删除挂单 | 1. 创建 2. DELETE `/api/store/hold-orders/:holdNo` | code=0，status=DELETED | P1 |
| TC-HOLD-005 | 挂单不存在时的恢复 | 1. POST `/api/store/hold-orders/NOT_EXIST/restore` | HTTP 404 | P2 |

## 模块 10: 报表 (Reports)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-REP-001 | 后台报表看板 | 1. GET `/api/admin/reports/dashboard` | code=0，返回 `salesAmount/saleBillCount/pendingCollectionAmount/inventoryWarningCount/pendingOrderCount` | P0 |
| TC-REP-002 | 门店工作台看板 | 1. GET `/api/store/dashboard?storeId=1` | code=0，返回 `todayOrderCount/pendingOrderCount/todaySalesAmount/unReceivedAmount` | P0 |
| TC-REP-003 | 近 7 天销售趋势 | 1. GET `/api/admin/reports/daily-sales` | code=0，records 数组（含 date/count/amount） | P1 |
| TC-REP-004 | 订单状态分布 | 1. GET `/api/admin/reports/order-stats` | code=0，返回 records 数组（含 status/count） | P1 |
| TC-REP-005 | 门店业绩 | 1. GET `/api/admin/reports/store-performance` | code=0，返回 records 数组（含 storeName/totalSales/billCount） | P1 |

## 模块 11: 权限与安全 (Security)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-SEC-001 | SQL 注入测试 - 商品搜索 | 1. GET `/api/admin/products?keyword=1' OR '1'='1` | 不会返回全表或泄露敏感字段 | P0 |
| TC-SEC-002 | SQL 注入测试 - 订单搜索 | 1. GET `/api/admin/orders?keyword=1' UNION SELECT 1,2,3,4--` | 无异常或非法注入数据 | P0 |
| TC-SEC-003 | XSS 测试 | 1. POST 商品 name 为 `<script>alert(1)</script>` 2. GET 商品列表 | 不执行脚本（或不存入数据库前被过滤） | P1 |
| TC-SEC-004 | 水平越权测试 | 1. 使用 admin token 查询 storeId=100000（可能不存在） 2. 无权限应拒绝 | 正确返回 404 或空数组 | P2 |
| TC-SEC-005 | 敏感数据泄露 | 1. GET 接口 2. 检查是否有 password_hash/明文密码 | 不应出现敏感字段 | P0 |
| TC-SEC-006 | 大文件上传限制 | 1. POST 请求大于 2MB body | HTTP 413 或合理拒绝 | P2 |
| TC-SEC-007 | 未认证访问私有接口 | 1. 无 token GET `/api/admin/orders` | HTTP 401 | P0 |
| TC-SEC-008 | 错误 Token 访问 | 1. 伪造 token 访问 | HTTP 401 | P0 |
| TC-SEC-009 | CSRF 测试 | 1. 跨域 POST `/api/admin/products` | 被 CORS 或服务器逻辑正确处理 | P2 |

## 模块 12: 性能测试 (Performance)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-PERF-001 | 健康检查接口性能 | 1. 100 并发 GET `/health` 30s | P95 < 50ms，错误率 < 1% | P0 |
| TC-PERF-002 | 商品列表查询性能 | 1. 100 并发 GET `/api/admin/products` | P95 < 500ms | P1 |
| TC-PERF-003 | 订单列表查询性能 | 1. 100 并发 GET `/api/admin/orders?page=1&pageSize=20` | P95 < 500ms | P1 |
| TC-PERF-004 | 登录接口负载 | 1. 10 并发 POST 登录 30 次 | P95 < 200ms | P1 |
| TC-PERF-005 | 创建销售单性能 | 1. 10 并发 POST 创建销售单 | P95 < 300ms | P1 |

## 模块 13: 响应结构一致性 (Response Schema)

| ID | 用例名称 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-SCHEMA-001 | 成功响应结构 | 1. 多个 GET/POST 接口验证 | 返回结构 `{ code: "0", data: any, message? }` | P0 |
| TC-SCHEMA-002 | 错误响应结构 | 1. 故意发送错误请求 | 返回 `code != "0"`，`message` 有信息 | P1 |
| TC-SCHEMA-003 | 分页字段一致性 | 1. GET 分页接口对比 | 统一字段名 `total` / `page` / `pageSize` / `records` | P1 |
| TC-SCHEMA-004 | 列表型响应字段统一 | 1. 列表接口比较 | 一致的字段命名 | P2 |

---

## 附: 严重程度与优先级定义

| 级别 | 定义 | 示例 |
|---|---|---|
| P0 | 功能阻塞、核心流程阻断、数据丢失风险 | 登录失败、无法创建销售单、SQL 注入成功 |
| P1 | 重要功能有缺陷、影响业务流程但可绕 | 商品列表分页错误、价格计算不一致 |
| P2 | 次要问题、不影响核心流程 | 按钮样式不统一、字段对齐问题 |
