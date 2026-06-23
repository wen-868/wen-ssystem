# 子项目 A：销售开单功能设计

日期：2026-06-16
状态：待审阅

## 1. 目标

为商家移动端 H5 新增销售开单功能，支持两种场景：
- **门店现场开单**：面对顾客，开单后立即收款出库
- **外出拜访开单**：拜访客户时开单，生成收款链接分享给客户

## 2. 范围

### 新增文件
| 文件 | 说明 |
|---|---|
| `merchant-mobile/src/views/CreateSaleView.vue` | 开单主页面 |
| `merchant-mobile/src/views/SaleBillsView.vue` | 销售单列表页 |

### 修改文件
| 文件 | 变更 |
|---|---|
| `merchant-mobile/src/api.ts` | 新增 5 个销售单 API 函数 |
| `merchant-mobile/src/router.ts` | 新增 2 个路由 |
| `merchant-mobile/src/App.vue` | Tabbar 新增"开单"Tab |

### 不涉及
- 后端 API（已完整实现）
- 管理后台 / 门店操作端 / 微信小程序

## 3. 页面设计

### 3.1 CreateSaleView.vue — 开单主页面

#### 页面结构（从上到下）

**A. 场景切换栏**
- 两个 Tab：「门店现场」「外出拜访」
- 默认选中「门店现场」
- 切换场景时影响底部操作按钮的文案和行为

**B. 客户选择区**
- 搜索框：输入手机号搜索已有客户
- 快捷选项：「散客」（不关联会员）
- 选中客户后显示：姓名、类型（零售/批发）、手机号
- 批发客户自动使用批发价

**C. 商品选择区**
- 顶部：搜索框 + 扫码按钮（`van-icon="scan"`）
- 搜索：输入商品名称/SKU 搜索，调用 `/store/products` API（支持 keyword + barcode）
- 扫码：调用 Vant Scanner 组件扫描条码（当前 mock 阶段显示占位提示）
- 搜索结果列表：显示商品名、规格、库存、价格（根据客户类型显示对应价格）
- 点击商品添加到已选列表

**D. 已选商品列表**
- 每行显示：商品名、单价、数量步进器（`van-stepper`）、小计金额
- 数量步进器：支持箱数和瓶数（白酒行业特有）
- 支持左滑删除
- 底部汇总栏（sticky）：
  - 商品总额
  - 折扣金额（可输入，默认 0）
  - 抹零金额（可输入，默认 0）
  - 应收金额（自动计算）
  - 操作按钮：
    - 门店现场：「立即收款」
    - 外出拜访：「生成收款链接」

**E. 收款弹窗（门店现场场景）**
- ActionSheet 弹出，选择收款方式：现金(CASH) / 微信(OTHER_WECHAT) / 支付宝(ALIPAY) / 转账(TRANSFER)
- 输入收款金额（默认等于应收金额）
- 确认后调用 `offlinePayment` API
- 成功后显示成功提示，自动清空表单

**F. 收款链接弹窗（外出拜访场景）**
- 显示收款金额（默认等于应收金额）
- 可选：设置过期时间（默认 72 小时）
- 确认后调用 `createCollectionLink` API
- 成功后显示收款链接和二维码，支持复制/分享

### 3.2 SaleBillsView.vue — 销售单列表页

#### 页面结构
- 顶部 Tab 筛选：全部 / 未收款 / 部分收款 / 已收款 / 已分享
- 列表项显示：单号、客户名、应收金额、收款状态、创建时间
- 下拉刷新 + 上拉加载
- 点击进入详情弹窗（Popup）
- 详情弹窗内容：
  - 单据信息（单号、客户、状态、金额）
  - 商品明细列表
  - 操作按钮（根据状态显示）：
    - UNPAID：「立即收款」「生成收款链接」
    - PARTIAL：「继续收款」
    - SHARED：「继续收款」
    - PAID：无操作按钮

## 4. API 对接

在 `api.ts` 中新增以下函数：

```typescript
/* ========== 销售单 ========== */

export interface SaleBillItem {
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  priceType: string
  subtotalAmount: number
}

export interface SaleBillRecord {
  billNo: string
  storeId: number
  customerId: number | null
  customerName: string
  customerType: string
  businessStatus: string
  collectionStatus: string
  receivableAmount: number
  receivedAmount: number
  unreceivedAmount: number
  createdAt: string
}

export interface SaleBillDetail extends SaleBillRecord {
  items: SaleBillItem[]
}

export interface CreateSaleBillParams {
  customerId?: number | null
  customerName?: string
  customerMobile?: string
  discountAmount?: number
  roundingAmount?: number
  remark?: string
  items: {
    skuId: number
    boxQty?: number
    bottleQty?: number
    totalBottleQty: number
    unitPrice?: number
    priceType?: string
  }[]
}

export function createSaleBill(data: CreateSaleBillParams) {
  return api.post('/store/sale-bills', data)
}

export function fetchSaleBills(params: {
  page?: number
  pageSize?: number
  keyword?: string
  collectionStatus?: string
}) {
  return api.get('/store/sale-bills', { params })
}

export function fetchSaleBillDetail(billNo: string) {
  return api.get(`/store/sale-bills/${billNo}`)
}

export function offlinePayment(billNo: string, data: {
  amount: number
  paymentMethod: string
  remark?: string
}) {
  return api.post(`/store/sale-bills/${billNo}/offline-payment`, data)
}

export function createCollectionLink(billNo: string, data: {
  amount: number
  shareChannel?: string
  expireHours?: number
  remark?: string
}) {
  return api.post(`/store/sale-bills/${billNo}/collection-link`, data)
}
```

## 5. 路由变更

在 `router.ts` 中新增：

```typescript
{
  path: '/create-sale',
  name: 'create-sale',
  component: () => import('./views/CreateSaleView.vue')
},
{
  path: '/sale-bills',
  name: 'sale-bills',
  component: () => import('./views/SaleBillsView.vue')
}
```

## 6. Tabbar 变更

在 `App.vue` 中：
- `baseTabs` 数组在"订单"之后插入 `{ name: 'create-sale', icon: 'gold-coin', label: '开单' }`
- `views` 对象新增 `create-sale: CreateSaleView` 和 `sale-bills: SaleBillsView`
- 销售单列表通过开单页面内的入口访问（不放在 Tabbar），或通过首页仪表盘的快捷入口进入

**最终 Tabbar 布局（普通角色）：**
首页 | 订单 | **开单** | 库存 | 客户 | 我的

**管理员额外：** 首页 | 订单 | **开单** | 库存 | 客户 | 应收 | 报表 | 我的

## 7. 业务逻辑要点

### 价格计算
- 散客（无 customerId）：使用门店价（store_price），fallback 零售价
- 零售会员：使用门店价
- 批发会员：使用批发价（wholesale_price）
- 手动定价：如果用户修改了单价，以用户输入为准

### 库存扣减时机
- 创建销售单时**不扣库存**
- 调用 `offlinePayment` 时**扣减 OFFLINE 库存**（仅首次收款时扣减，幂等）
- 生成收款链接时**不扣库存**，等客户付款后通过回调扣减

### 数量输入
- 白酒行业特有：支持"箱"和"瓶"两种计量单位
- `totalBottleQty = boxQty * 每箱瓶数 + bottleQty`
- 当前 mock 数据中每箱 6 瓶（从 product_sku 获取）

## 8. 错误处理

| 场景 | 处理方式 |
|---|---|
| 库存不足 | 收款时后端返回错误，前端提示"库存不足，无法完成出库" |
| 网络异常 | Vant showToast 提示"网络异常，请重试" |
| 创建失败 | 显示后端返回的错误信息 |
| 收款金额超限 | 前端校验金额不超过应收金额 |

## 9. 不在本子项目范围内

- 微信支付真实接入（使用 mock）
- 扫码硬件调用（mock 阶段显示占位）
- 管理后台的销售单管理
- 打印小票功能
