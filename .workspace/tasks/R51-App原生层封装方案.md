# R51 — App 原生层封装方案

> **日期**：2026-07-19
> **撰写人**：凌舟
> **范围**：app-mobile（uni-app）原生插件封装、离线能力、安全加固、性能优化、HarmonyOS 适配
> **对齐代码版本**：main 分支，pages.json 72 条路由，38 个 API 模块

---

## 现状概览

| 项目 | 值 |
|------|-----|
| 项目名 | 智享全链酒水批发管理系统 |
| App端 | app-mobile（uni-app，Vue3 + Vant） |
| 包名 | `com.zhixiang.app`（Android） |
| API域名 | `https://api.zhixiang-chain.com` |
| 已声明模块 | Payment、Push、OAuth |
| 已有权限 | INTERNET、CAMERA、ACCESS_NETWORK_STATE、ACCESS_WIFI_STATE |
| 存储Key | `merchant_token` / `merchant_user` / `merchant_tenant` / `merchant_tenant_id` |
| 网络层 | `api/request.ts`，超时 30s，401 自动跳 `/pages/login/login` |
| tabBar | home / orders / create-sale / products / profile |

### 需要新建的后端能力

| 能力 | 现状 | 方案 |
|------|------|------|
| 文件上传端点 | 仅有采购合同使用 multer，无通用上传 | 新建 `upload.routes.ts` |
| 打印记录API | 无任何打印后端 | 新建 `print.routes.ts` + `print.service.ts` |
| App推送通道 | 当前轮询 `/admin/notifications/unread-count` | 新增厂商推送（FCM/HMS/极光） |
| 离线同步扩展 | `/api/sync` 仅支持价格/商品同步到小程序缓存 | 扩展为 App 端增量同步 + 冲突解决 |

---

## 一、离线能力（SQLite + 同步机制）

### 1.1 SQLite 本地表结构

基于后端 `t_product_sku` / `t_product_price` / `t_inventory_balance` 实际字段设计，字段名与后端查询返回的驼峰命名对齐。

```sql
-- 本地商品SKU表
CREATE TABLE IF NOT EXISTS local_product_sku (
  id            INTEGER PRIMARY KEY,
  sku_id        INTEGER NOT NULL,
  spu_id        INTEGER NOT NULL,
  sku_code      TEXT,
  barcode       TEXT,
  sku_name      TEXT NOT NULL,
  volume        TEXT,
  packaging     TEXT,
  base_unit     TEXT DEFAULT '瓶',
  box_unit      TEXT DEFAULT '箱',
  box_ratio     INTEGER DEFAULT 1,
  temperature   TEXT DEFAULT 'NORMAL',
  trace_enabled INTEGER DEFAULT 0,
  status        INTEGER DEFAULT 1,
  -- SPU 信息冗余
  spu_name      TEXT,
  category_id   INTEGER,
  category_name TEXT,
  brand_name    TEXT,
  main_image    TEXT,
  -- 价格（来自 t_product_price）
  retail_price      REAL DEFAULT 0,
  wholesale_price   REAL DEFAULT 0,
  cost_price        REAL DEFAULT 0,
  miniapp_price     REAL DEFAULT 0,
  store_price       REAL DEFAULT 0,
  -- 库存
  available_qty  INTEGER DEFAULT 0,
  warning_threshold INTEGER DEFAULT 0,
  -- 同步元数据
  server_updated_at TEXT,
  local_updated_at  TEXT DEFAULT (datetime('now')),
  is_dirty       INTEGER DEFAULT 0,  -- 1=本地修改未同步
  tenant_id      TEXT NOT NULL,
  UNIQUE(sku_id, tenant_id)
);
CREATE INDEX idx_sku_barcode ON local_product_sku(barcode);
CREATE INDEX idx_sku_spu_id ON local_product_sku(spu_id);
CREATE INDEX idx_sku_dirty ON local_product_sku(is_dirty);

-- 本地客户表
CREATE TABLE IF NOT EXISTS local_member (
  id            INTEGER PRIMARY KEY,
  member_id     INTEGER NOT NULL UNIQUE,
  name          TEXT,
  phone         TEXT,
  customer_type TEXT DEFAULT 'RETAIL',
  address       TEXT,
  remark        TEXT,
  level_code    TEXT,
  debt_amount   REAL DEFAULT 0,
  status        INTEGER DEFAULT 1,
  local_updated_at  TEXT DEFAULT (datetime('now')),
  is_dirty       INTEGER DEFAULT 0,
  tenant_id      TEXT NOT NULL
);
CREATE INDEX idx_member_phone ON local_member(phone);

-- 本地销售单草稿表
CREATE TABLE IF NOT EXISTS local_sale_draft (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_no        TEXT UNIQUE NOT NULL,
  customer_name   TEXT,
  customer_mobile TEXT,
  customer_id     INTEGER,
  items_json      TEXT NOT NULL,  -- JSON: SaleItem[]
  total_amount    REAL DEFAULT 0,
  remark          TEXT,
  status          TEXT DEFAULT 'DRAFT',  -- DRAFT / PENDING_SYNC / SYNCED / SYNC_FAILED
  created_at      TEXT DEFAULT (datetime('now')),
  synced_at       TEXT,
  error_msg       TEXT,
  tenant_id       TEXT NOT NULL
);
CREATE INDEX idx_draft_status ON local_sale_draft(status);

-- 本地库存快照表（用于离线开单校验库存）
CREATE TABLE IF NOT EXISTS local_inventory_snapshot (
  id            INTEGER PRIMARY KEY,
  sku_id        INTEGER NOT NULL UNIQUE,
  available_qty INTEGER NOT NULL,
  stock_type    TEXT DEFAULT 'OFFLINE',
  store_id      INTEGER,
  synced_at     TEXT NOT NULL,
  tenant_id     TEXT NOT NULL
);

-- 同步水位表
CREATE TABLE IF NOT EXISTS sync_watermark (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  product_since TEXT DEFAULT '1970-01-01T00:00:00Z',
  price_since   TEXT DEFAULT '1970-01-01T00:00:00Z',
  inventory_since TEXT DEFAULT '1970-01-01T00:00:00Z',
  member_since  TEXT DEFAULT '1970-01-01T00:00:00Z',
  last_full_sync TEXT
);
```

### 1.2 同步策略

对齐现有 `/api/sync`（`sync.routes.ts`），基于 `since` 时间戳增量拉取。

#### 现有同步端点（已存在，直接复用）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sync/check?since=` | GET | 增量价格变更，读取 `t_price_change_log` |
| `/api/sync/prices?ids=` | GET | 批量查询最新价格 |
| `/api/sync/price` | POST | 全量同步价格到 sync_cache |
| `/api/sync/product` | POST | 全量同步商品到 sync_cache |
| `/api/sync/product/status` | GET | 商品同步状态 |
| `/api/sync/price/last` | GET | 价格最后同步时间 |
| `/api/sync/product/last` | GET | 商品最后同步时间 |

#### 需要新增的同步端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sync/products/delta?since=` | GET | **新建** — 增量商品变更（新增/修改/停用），返回 `{ since, changes: [{skuId, spuId, action, data}] }` |
| `/api/sync/inventory/delta?since=` | GET | **新建** — 增量库存变更，读取 `t_inventory_balance.updated_at` |
| `/api/sync/members/delta?since=` | GET | **新建** — 增量客户变更 |
| `/api/sync/offline-orders` | POST | **新建** — 批量提交离线销售单 |

#### 增量商品同步接口定义

```typescript
// 后端: sync.controller.ts 新增
// GET /api/sync/products/delta?since=2026-07-19T00:00:00Z
interface SyncDeltaResponse {
  since: string          // 本次请求的 since 值
  until: string          // 本次返回数据的最新时间戳
  hasMore: boolean       // 是否还有更多数据
  changes: Array<{
    action: 'UPSERT' | 'DELETE' | 'STATUS_CHANGE',
    skuId: number,
    spuId: number,
    data?: ProductDeltaData,  // UPSERT/STATUS_CHANGE 时有值
  }>
}

interface ProductDeltaData {
  skuId: number
  spuId: number
  skuCode: string
  barcode: string
  skuName: string
  volume: string
  packaging: string
  baseUnit: string
  boxUnit: string
  boxRatio: number
  temperature: string
  traceEnabled: number
  status: number
  // SPU 字段
  spuName: string
  categoryId: number
  categoryName: string
  brandName: string
  mainImage: string
  // 价格
  retailPrice: number
  wholesalePrice: number
  costPrice: number
  miniappPrice: number
  storePrice: number
  // 库存
  availableQty: number
  warningThreshold: number
  updatedAt: string
}
```

#### 同步流程

```
App 启动
  │
  ├─ 有网络 → 增量同步
  │    ├─ 读取 sync_watermark 表的 product_since / price_since
  │    ├─ GET /api/sync/products/delta?since={product_since}
  │    ├─ GET /api/sync/check?since={price_since}
  │    ├─ GET /api/sync/inventory/delta?since={inventory_since}
  │    ├─ 更新本地 SQLite
  │    ├─ 更新 sync_watermark
  │    └─ 提交离线销售单 POST /api/sync/offline-orders
  │
  ├─ 无网络 → 读取本地 SQLite
  │    ├─ 开单时写入 local_sale_draft（status=DRAFT）
  │    └─ 恢复网络后自动触发同步
  │
  └─ 后台同步（每 5 分钟 + 前台恢复时）
       └─ 静默增量同步，不阻塞 UI
```

#### 离线销售单提交

```typescript
// POST /api/sync/offline-orders
// 请求体
interface OfflineOrderBatch {
  orders: Array<{
    draftNo: string,
    customerName: string,
    customerMobile?: string,
    customerId?: number,
    items: Array<{
      productId: number,
      productName: string,
      skuId: number,
      boxQty: number,
      bottleQty: number,
      unitPrice: number,
      subtotalAmount: number,
    }>,
    totalAmount: number,
    remark?: string,
    createdAt: string,  // 离线创建时间
    // 请求体
  }>
}

// 响应体
interface OfflineOrderResult {
  results: Array<{
    draftNo: string,
    success: boolean,
    billNo?: string,     // 成功时返回服务端单号
    error?: string,      // 失败时返回错误信息
  }>
}
```

### 1.3 本地数据库操作层

```typescript
// app-mobile/src/api/local-db.ts
import { openDatabase } from '@/native/sqlite'

export class LocalProductDb {
  /** 扫码查商品 — 对齐后端 barcode LIKE 搜索 */
  static async findByBarcode(barcode: string, tenantId: string): Promise<ProductDeltaData | null>

  /** 搜索商品（名称/skuCode/barcode）— 对齐 product.service.ts 的 LIKE 搜索 */
  static async search(keyword: string, tenantId: string, page: number, pageSize: number): Promise<{list: ProductDeltaData[], total: number}>

  /** 全量导入 — 用于首次全量同步 */
  static async bulkUpsert(products: ProductDeltaData[], tenantId: string): Promise<number>

  /** 增量更新 */
  static async applyDelta(changes: SyncDeltaResponse['changes'], tenantId: string): Promise<number>

  /** 读取本地库存校验 */
  static async getStock(skuId: number, tenantId: string): Promise<number>
}
```

---

## 二、原生插件

### 2.1 条码扫码

#### 现有后端能力

- `product.service.ts` 的 `listProducts()`：`s.barcode LIKE ?` 支持条码搜索
- `store/product.service.ts` 的门店商品搜索也支持 barcode
- `trace.routes.ts`：`GET /api/admin/trace/codes/:traceCode` 追溯码详情

#### 扫码调用链

```
原生扫码插件
  │
  ├─ 返回 barcode 字符串
  │
  ├─ 1. 查本地 SQLite: LocalProductDb.findByBarcode(barcode, tenantId)
  │    ├─ 命中 → 直接展示商品信息
  │    └─ 未命中 → 走网络
  │
  ├─ 2. 有网络: productsApi.list({ keyword: barcode })
  │    └─ 对齐 GET /admin/products?keyword={barcode}
  │
  └─ 3. 追溯码判断（barcode 以特定前缀开头）
       └─ GET /api/admin/trace/query/:traceCode → 展示追溯链
```

#### 插件封装接口

```typescript
// app-mobile/src/native/scan.ts

interface ScanResult {
  code: string       // 扫码内容
  type: 'barcode' | 'qrcode' | 'trace_code'  // 自动识别类型
  format: string     // EAN_13 / CODE_128 / QR_CODE
}

interface ScanOptions {
  /** 是否连续扫码（盘点场景） */
  continuous?: boolean
  /** 连续扫码间隔（毫秒） */
  interval?: number
  /** 扫码框标题 */
  title?: string
}

// 原生插件调用
function scan(options?: ScanOptions): Promise<ScanResult>

// 条码处理路由 — 扫码后自动分发
async function handleScanResult(result: ScanResult): Promise<{
  action: 'product' | 'trace' | 'unknown'
  data: any
}> {
  const code = result.code.trim()

  // 判断是否为追溯码（追溯码格式由 trace-code.ts 生成规则决定）
  if (isTraceCode(code)) {
    const data = await get(`/admin/trace/query/${code}`)
    return { action: 'trace', data }
  }

  // 商品条码搜索
  // 优先本地
  const local = await LocalProductDb.findByBarcode(code, getCurrentTenantId())
  if (local) return { action: 'product', data: local }

  // 网络搜索
  const res = await productsApi.list({ keyword: code, page: 1, pageSize: 10 })
  if (res.list.length > 0) return { action: 'product', data: res.list[0] }

  return { action: 'unknown', data: null }
}
```

#### Android 原生实现

```
插件路径：nativeplugins/ZXing-Scanner/
├── android/
│   └── zxinglibrary/
│       ├── MainActivity.java      — 扫码 Activity
│       ├── CaptureHandler.java    — 相机预览 + 解码
│       └── BarcodeFormat.java     — 格式识别
├── package.json
└── index.d.ts                     — TypeScript 类型声明
```

**所需新增权限**（manifest.json）：

```json
"<uses-permission android:name=\"android.permission.CAMERA\"/>"   // 已有
"<uses-feature android:name=\"android.hardware.camera.autofocus\"/>"  // 新增
```

**uni-app 调用方式**：

```javascript
const scanner = uni.requireNativePlugin('ZXing-Scanner')
scanner.scan({ continuous: false, title: '扫一扫' }, (res) => {
  if (res.code) handleScanResult({ code: res.code, type: res.type, format: res.format })
})
```

---

### 2.2 蓝牙打印

> 后端无打印相关实现，需从零搭建。

#### 2.2.1 后端打印记录 API（新建）

```typescript
// backend/src/routes/print.routes.ts — 新建文件

const router = Router()

// 保存打印记录
router.post('/records', requireAuthWithTenant, printController.createRecord)

// 查询打印记录
router.get('/records', requireAuthWithTenant, printController.listRecords)

// 重打
router.post('/records/:id/reprint', requireAuthWithTenant, printController.reprint)

export const routeConfig: RouteConfig = {
  prefix: '/api/admin/print',
  router,
  auth: 'requireAuthWithTenant',
}
```

**打印记录数据库表**（新建迁移）：

```sql
CREATE TABLE t_print_record (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   VARCHAR(64) NOT NULL,
  store_id    BIGINT UNSIGNED DEFAULT NULL,
  bill_type   VARCHAR(32) NOT NULL COMMENT '单据类型：SALE_BILL/PURCHASE/INVENTORY_CHECK/TRANSFER',
  bill_no     VARCHAR(64) NOT NULL COMMENT '关联单号',
  printer_mac VARCHAR(32) DEFAULT NULL COMMENT '打印机蓝牙MAC地址',
  print_content TEXT COMMENT '打印内容JSON',
  copies      INT NOT NULL DEFAULT 1 COMMENT '打印份数',
  operator_id BIGINT UNSIGNED DEFAULT NULL,
  status      VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' COMMENT 'SUCCESS/FAILED',
  error_msg   TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_print_record_tenant (tenant_id),
  KEY idx_print_record_bill (bill_type, bill_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打印记录表';
```

**打印记录 Service**：

```typescript
// backend/src/services/admin/print.service.ts — 新建文件
interface PrintRecordCreate {
  billType: 'SALE_BILL' | 'PURCHASE' | 'INVENTORY_CHECK' | 'TRANSFER'
  billNo: string
  printerMac?: string
  printContent: string  // JSON 字符串
  copies?: number
}
```

#### 2.2.2 前端打印模板引擎

```typescript
// app-mobile/src/native/print.ts

/** 打印机连接信息 */
interface PrinterInfo {
  mac: string          // 蓝牙 MAC 地址
  name: string
  type: 'thermal' | 'dot'  // 热敏 / 针式
  paperWidth: number   // 纸宽 mm（58/80）
  connected: boolean
}

/** 打印模板数据 */
interface SaleBillPrintData {
  billNo: string
  customerName: string
  customerMobile?: string
  items: Array<{
    productName: string
    skuName: string
    boxQty: number
    bottleQty: number
    unitPrice: number
    subtotalAmount: number
  }>
  totalAmount: number
  receivableAmount: number
  remark?: string
  operatorName: string
  createdAt: string
}

// 蓝牙打印机管理
const PrintManager = {
  /** 搜索蓝牙打印机 */
  async search(): Promise<PrinterInfo[]>,

  /** 连接打印机 */
  async connect(mac: string): Promise<boolean>,

  /** 断开连接 */
  async disconnect(): Promise<void>,

  /** 检查连接状态 */
  async isConnected(): Promise<boolean>,

  /** 打印销售单（热敏58mm） */
  async printSaleBill(data: SaleBillPrintData): Promise<void>,

  /** 打印销售单（针式，三联） */
  async printSaleBillDot(data: SaleBillPrintData): Promise<void>,

  /** 自定义打印 */
  async printRaw(lines: PrintLine[]): Promise<void>,
}

/** 打印行类型 */
type PrintLine =
  | { type: 'text'; content: string; align?: 'left' | 'center' | 'right'; bold?: boolean; size?: 'normal' | 'large' | 'small' }
  | { type: 'divider'; char?: string }
  | { type: 'table'; headers: string[]; rows: string[][]; widths: number[] }
  | { type: 'barcode'; content: string; height?: number; width?: number }
  | { type: 'qrcode'; content: string; size?: number }
  | { type: 'feed'; lines: number }
```

#### 2.2.3 热敏打印模板（58mm纸宽）

```
================================
     智享全链 - 销售单
================================
单号: XS202607190001
客户: 张三  13800138000
日期: 2026-07-19 14:30
--------------------------------
商品           数量   单价  金额
--------------------------------
茅台飞天 500ml
  x1箱(6瓶)    6   1499  8994
五粮液 52度
  x2瓶         2    899  1798
--------------------------------
合计:                   10792
应收:                   10792
--------------------------------
操作员: 李四
================================
```

#### 2.2.4 所需新增权限

```json
"<uses-permission android:name=\"android.permission.BLUETOOTH\"/>"
"<uses-permission android:name=\"android.permission.BLUETOOTH_ADMIN\"/>"
"<uses-permission android:name=\"android.permission.BLUETOOTH_SCAN\"/>"
"<uses-permission android:name=\"android.permission.BLUETOOTH_CONNECT\"/>"
"<uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\"/>"
```

> Android 12+ 需要 `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`，同时需要定位权限辅助蓝牙搜索。

---

### 2.3 推送通知

#### 现有通知体系

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/notifications` | GET | 通知列表，支持 `type` / `page` / `pageSize` / `unreadOnly` |
| `/api/admin/notifications/unread-count` | GET | 各分类未读数 |
| `/api/admin/notifications/:id/read` | PUT | 标记已读 |
| `/api/admin/notifications/read-all` | POST | 按类型全部已读 |
| `/api/admin/notifications/:id` | DELETE | 删除单条 |
| `/api/admin/notifications/batch-delete` | POST | 批量删除 |

**通知类型**（`notifications.ts` 中定义）：`system` / `order` / `inventory` / `marketing`

**当前实现**：App 端定时轮询 `getUnreadCount()`，无厂商推送。

#### 推送升级方案

```
┌─────────────────────────────────────────────┐
│               推送触发源                      │
│  订单状态变更 / 库存预警 / 营销活动 / 系统公告  │
└──────────────┬──────────────────────────────┘
               │ notification.service.ts
               ▼
┌──────────────────────────────────────────────┐
│         notification-sender.ts               │
│  写入 t_notification 表 + 调用推送服务         │
└──────────┬──────────┬───────────┬────────────┘
           │          │           │
           ▼          ▼           ▼
        ┌──────┐  ┌──────┐  ┌──────────┐
        │ FCM  │  │ 极光  │  │ HMS Push │
        │Android│  │全平台 │  │HarmonyOS│
        └──┬───┘  └──┬───┘  └────┬─────┘
           │         │           │
           ▼         ▼           ▼
        Android   iOS/Android  HarmonyOS
```

#### 推送服务接口（后端新建）

```typescript
// backend/src/services/admin/push.service.ts — 新建文件

interface PushMessage {
  tenantId: string
  userIds: number[]         // 推送目标用户
  title: string
  body: string
  data: {
    type: NotificationType  // system | order | inventory | marketing
    id: number              // 通知记录ID
    linkUrl?: string        // 跳转链接
  }
}

interface PushProvider {
  /** 推送单条消息 */
  send(message: PushMessage): Promise<{ success: boolean; failedTokens?: string[] }>
  /** 批量推送 */
  sendBatch(messages: PushMessage[]): Promise<void>
}
```

#### 前端推送接收层

```typescript
// app-mobile/src/native/push.ts

/** 推送消息体 */
interface PushPayload {
  type: 'system' | 'order' | 'inventory' | 'marketing'
  id: number
  title: string
  body: string
  linkUrl?: string
}

/** 注册推送 */
async function registerPush(): Promise<void> {
  // #ifdef APP-PLUS
  const push = uni.requireNativePlugin('JPush')
  push.init()
  push.setAlias({ alias: `merchant_${getCurrentUserId()}_${getCurrentTenantId()}` })
  // #endif
}

/** 推送点击处理 — 对齐现有 NotificationItem.linkUrl 跳转 */
function onPushClick(payload: PushPayload): void {
  // 标记已读
  notificationsApi.markRead(payload.id)

  // 路由跳转
  const routeMap: Record<string, string> = {
    order: `/pages/orders/order-detail?orderNo=${payload.linkUrl || ''}`,
    inventory: '/pages/inventory/inventory',
    marketing: '/pages/marketing/marketing',
    system: '/pages/notifications/notification-detail?id=' + payload.id,
  }
  const url = routeMap[payload.type] || '/pages/notifications/notifications'
  uni.navigateTo({ url })
}
```

#### manifest.json 推送配置扩展

```json
{
  "app-plus": {
    "modules": {
      "Push": {},
      "Payment": {},
      "OAuth": {}
    },
    "distribute": {
      "sdkConfigs": {
        "push": {
          "jpush": {
            "appkey": "jp_appkey_placeholder",
            "appsecret": "jp_appsecret_placeholder"
          }
        }
      }
    }
  }
}
```

---

## 三、安全加固

### 3.1 代码混淆

**manifest.json 配置**：

```json
{
  "app-plus": {
    "distribute": {
      "android": {
        "abiFilters": ["armeabi-v7a", "arm64-v8a"],
        "minSdkVersion": 21,
        "safeguard": true
      }
    }
  }
}
```

- 使用 HBuilderX 云打包时开启 `safeguard` 代码混淆
- 关键业务逻辑（价格计算、库存校验）放在后端，前端仅做展示

### 3.2 敏感数据加密

对齐现有 `storage.ts` 的 4 个 key 进行加密存储。

```typescript
// app-mobile/src/utils/crypto.ts

/** AES-256-GCM 加密工具 */
const Crypto = {
  /** 派生密钥（基于设备指纹 + 固定盐值） */
  async deriveKey(): Promise<CryptoKey>,

  /** 加密 */
  async encrypt(plaintext: string): Promise<string>,

  /** 解密 */
  async decrypt(ciphertext: string): Promise<string>,
}

// 加密存储适配 — 替换 storage.ts 中的 uni.setStorageSync
export function setSecureStorage(key: string, value: string): void {
  // #ifdef APP-PLUS
  const encrypted = Crypto.encrypt(value)
  uni.setStorageSync(`enc_${key}`, encrypted)
  // #endif
  // #ifndef APP-PLUS
  uni.setStorageSync(key, value)
  // #endif
}

export function getSecureStorage(key: string): string {
  // #ifdef APP-PLUS
  const encrypted = uni.getStorageSync(`enc_${key}`)
  return encrypted ? Crypto.decrypt(encrypted) : ''
  // #endif
  // #ifndef APP-PLUS
  return uni.getStorageSync(key) || ''
  // #endif
}
```

**需要加密的 4 个 key**：

| 原始 Key | 加密后存储为 | 内容 |
|----------|-------------|------|
| `merchant_token` | `enc_merchant_token` | JWT Token |
| `merchant_user` | `enc_merchant_user` | 用户信息 JSON |
| `merchant_tenant` | `enc_merchant_tenant` | 租户信息 JSON |
| `merchant_tenant_id` | `enc_merchant_tenant_id` | 租户 ID |

### 3.3 SSL 证书锁定

```typescript
// app-mobile/src/utils/pin-ssl.ts

// #ifdef APP-PLUS
const SSL_PIN_HASHES = [
  'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',  // 生产环境证书指纹
]

function verifySSL(fingerprint: string): boolean {
  return SSL_PIN_HASHES.includes(fingerprint)
}
// #endif
```

### 3.4 防调试与防篡改

```typescript
// app-mobile/src/utils/security.ts

// #ifdef APP-PLUS
/** 检测是否被调试 */
function isDebugged(): boolean

/** 检测 Root / 越狱 */
function isDeviceCompromised(): boolean

/** App 启动时安全检查 */
async function securityCheck(): Promise<boolean> {
  if (isDeviceCompromised()) {
    uni.showModal({ title: '安全提示', content: '设备环境异常，请联系管理员', showCancel: false })
    return false
  }
  return true
}
// #endif
```

---

## 四、性能优化

### 4.1 分包策略

基于实际 72 条页面路由、42 个目录进行分包。

#### 当前页面统计

| 目录 | 页面数 | 说明 |
|------|:------:|------|
| 主包（tabBar + login/register） | 7 | home/orders/products/profile/create-sale/login/register |
| pos（门店收银） | 10 | cashier/sale-bills/order-fulfill/shift/daily-settle/member/sale-return/coupon-verify/hold-order/store-control |
| marketing | 12 | marketing/coupons/create-coupon/activities/参与记录/社群/拼团/砍价/秒杀 |
| reports | 6 | reports/sales/inventory/purchase/customer/finance |
| report-permission | 7 | index/report-matrix/store-data-permission/permission-assign/audit-logs/audit-detail/my-permission |
| loss-gain | 6 | loss-list/gain-list/create-loss/create-gain/loss-gain-detail/loss-gain-report |
| 其他（散落页面） | 24 | inventory/customers/batches/finance/admin 等 |

#### 分包方案

```json
{
  "pages": [
    { "path": "pages/login/login" },
    { "path": "pages/register/register" },
    { "path": "pages/home/home" },
    { "path": "pages/orders/orders" },
    { "path": "pages/orders/order-detail" },
    { "path": "pages/sales/create-sale" },
    { "path": "pages/products/products" },
    { "path": "pages/products/product-detail" },
    { "path": "pages/profile/profile" },
    { "path": "pages/profile/edit" },
    { "path": "pages/profile/change-password" },
    { "path": "pages/notifications/notifications" },
    { "path": "pages/notifications/notification-detail" },
    { "path": "pages/todos/todos" }
  ],
  "subPackages": [
    {
      "root": "pages-sub/order",
      "pages": [
        { "path": "order-center/order-center" },
        { "path": "order-exception/exception" },
        { "path": "order-aftersale/aftersale" },
        { "path": "sales/sale-bills" }
      ]
    },
    {
      "root": "pages-sub/product",
      "pages": [
        { "path": "inventory/inventory" },
        { "path": "customers/customers" },
        { "path": "customers/customer-detail" },
        { "path": "batches/batch-list" },
        { "path": "batches/batch-detail" },
        { "path": "categories/categories" },
        { "path": "categories/category-edit" },
        { "path": "suppliers/suppliers" },
        { "path": "batch-price/batch-price" },
        { "path": "price/price-manage" },
        { "path": "price/batch-adjust" },
        { "path": "price-push/price-push" },
        { "path": "stock-check/stock-checks" },
        { "path": "stock-check/create-check" },
        { "path": "stock-check/check-detail" },
        { "path": "stock-warning/stock-warning" },
        { "path": "collection-link/collection-link" }
      ]
    },
    {
      "root": "pages-sub/pos",
      "pages": [
        { "path": "pos/cashier" },
        { "path": "pos/sale-bills" },
        { "path": "pos/order-fulfill" },
        { "path": "pos/shift" },
        { "path": "pos/daily-settle" },
        { "path": "pos/member" },
        { "path": "pos/sale-return" },
        { "path": "pos/coupon-verify" },
        { "path": "pos/hold-order" },
        { "path": "pos/store-control" }
      ]
    },
    {
      "root": "pages-sub/marketing",
      "pages": [
        { "path": "marketing/marketing" },
        { "path": "marketing/coupons" },
        { "path": "marketing/create-coupon" },
        { "path": "marketing/activities" },
        { "path": "marketing/participation-records" },
        { "path": "marketing/community-activities" },
        { "path": "marketing/group-buy-list" },
        { "path": "marketing/group-buy-detail" },
        { "path": "marketing/bargain-list" },
        { "path": "marketing/bargain-detail" },
        { "path": "marketing/seckill-list" },
        { "path": "marketing/seckill-detail" },
        { "path": "member/member" },
        { "path": "member-levels/member-levels" },
        { "path": "member-levels/level-config" },
        { "path": "points/points-detail" },
        { "path": "points/points-exchange" },
        { "path": "stored-cards/stored-cards" },
        { "path": "stored-cards/recharge-records" },
        { "path": "stored-cards/consume-records" }
      ]
    },
    {
      "root": "pages-sub/finance",
      "pages": [
        { "path": "finance/finance-dashboard" },
        { "path": "finance/expenses" },
        { "path": "finance/expense-create" },
        { "path": "reports/reports" },
        { "path": "reports/sales-reports" },
        { "path": "reports/inventory-reports" },
        { "path": "reports/purchase-reports" },
        { "path": "reports/customer-reports" },
        { "path": "reports/finance-reports" },
        { "path": "receipts/receipts" },
        { "path": "receivable/receivable" },
        { "path": "reconciliation/reconciliation" },
        { "path": "statements/statements" },
        { "path": "loss-gain/loss-list" },
        { "path": "loss-gain/gain-list" },
        { "path": "loss-gain/create-loss" },
        { "path": "loss-gain/create-gain" },
        { "path": "loss-gain/loss-gain-detail" },
        { "path": "loss-gain/loss-gain-report" },
        { "path": "transfer/transfer" },
        { "path": "purchase/orders" },
        { "path": "purchase/in-stock" },
        { "path": "instant-retail/orders" },
        { "path": "instant-retail/config" },
        { "path": "instant-retail/products" }
      ]
    },
    {
      "root": "pages-sub/admin",
      "pages": [
        { "path": "admin/admin" },
        { "path": "admin/employees" },
        { "path": "roles/roles" },
        { "path": "roles/role-edit" },
        { "path": "stores/stores" },
        { "path": "stores/store-edit" },
        { "path": "system/operation-logs" },
        { "path": "report-permission/index" },
        { "path": "report-permission/report-matrix" },
        { "path": "report-permission/store-data-permission" },
        { "path": "report-permission/permission-assign" },
        { "path": "report-permission/audit-logs" },
        { "path": "report-permission/audit-detail" },
        { "path": "report-permission/my-permission" }
      ]
    }
  ]
}
```

#### 预估包体积

| 包 | 页面数 | 预估大小 |
|----|:------:|:--------:|
| 主包 | 14 | ~800KB |
| pages-sub/order | 4 | ~200KB |
| pages-sub/product | 16 | ~500KB |
| pages-sub/pos | 10 | ~400KB |
| pages-sub/marketing | 20 | ~600KB |
| pages-sub/finance | 25 | ~700KB |
| pages-sub/admin | 14 | ~400KB |
| **总计** | **103** | **~3.6MB** |

> 主包控制在 2MB 以内（含公共依赖），满足微信小程序主包限制。App 端无主包大小硬限制，但分包可加速首屏加载。

### 4.2 列表虚拟滚动

适用于高频长列表页面：

| 页面 | 数据源 | 预估数据量 |
|------|--------|:----------:|
| 商品列表 `/pages/products/products` | `GET /admin/products` | 500+ |
| 销售单列表 `/pages/sales/sale-bills` | `GET /admin/sales` | 1000+ |
| 订单列表 `/pages/orders/orders` | `GET /admin/orders` | 500+ |
| 通知列表 `/pages/notifications/notifications` | `GET /admin/notifications` | 200+ |

```vue
<!-- 虚拟滚动组件使用示例 -->
<template>
  <virtual-list
    :data="productList"
    :item-size="120"
    :buffer="5"
    @load-more="loadMore"
  >
    <template #default="{ item }">
      <view class="product-item">
        <image :src="item.image" class="product-img" mode="aspectFill" />
        <view class="product-info">
          <text class="product-name">{{ item.name }}</text>
          <text class="product-price">¥{{ item.price }}</text>
        </view>
      </view>
    </template>
  </virtual-list>
</template>
```

### 4.3 图片优化

```typescript
// app-mobile/src/utils/image.ts

/** 图片压缩 — 拍照/选择图片后压缩 */
function compressImage(filePath: string, quality = 80, maxWidth = 1080): Promise<string>

/** 缩略图 URL — 后端图片加参数 */
function thumbnail(url: string, width = 200, height = 200): string {
  if (!url) return '/static/logo.svg'
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}x-oss-process=image/resize,w_${width},h_${height}`
}

/** 图片懒加载 — 在列表页使用 */
// <image :src="item.image" lazy-load mode="aspectFill" />
```

---

## 五、HarmonyOS 适配

### 5.1 适配现状

- uni-app 从 HBuilderX 3.6.0+ 支持 HarmonyOS
- 当前 `manifest.json` 未配置 HarmonyOS 相关选项
- `app-plus` 的 Android 配置不适用于 HarmonyOS

### 5.2 需适配的原生能力

| 能力 | Android 实现 | HarmonyOS 对应 |
|------|-------------|----------------|
| 条码扫码 | ZXing 库 | @hms/core/Scan Kit |
| 蓝牙打印 | BLE API | @hms/core/Bluetooth Kit |
| 推送通知 | FCM / 极光 | 华为推送服务（Push Kit） |
| 本地存储 | SQLite | @hms/core/DataRelationalStore |
| 文件上传 | uni.uploadFile | @hms/core/Network |

### 5.3 manifest.json HarmonyOS 配置

```json
{
  "app-plus": {
    "distribute": {
      "harmony": {
        "appid": "com.zhixiang.app",
        "bundleName": "com.zhixiang.app",
        "certificate": "",
        "profile": "",
        "permissions": [
          "ohos.permission.INTERNET",
          "ohos.permission.CAMERA",
          "ohos.permission.GET_NETWORK_INFO",
          "ohos.permission.ACCESS_BLUETOOTH"
        ]
      }
    }
  }
}
```

### 5.4 条件编译适配

```typescript
// 扫码适配
function nativeScan(): Promise<ScanResult> {
  // #ifdef APP-PLUS && !HARMONYOS
  const scanner = uni.requireNativePlugin('ZXing-Scanner')
  // #endif

  // #ifdef HARMONYOS
  // 使用 HarmonyOS Scan Kit
  // #endif
}

// 推送适配
function registerPush(): void {
  // #ifdef APP-PLUS && !HARMONYOS
  const push = uni.requireNativePlugin('JPush')
  // #endif

  // #ifdef HARMONYOS
  // 使用华为 Push Kit
  // #endif
}
```

---

## 六、优先级排序与工作量估算

| 优先级 | 模块 | 内容 | 工作量 | 负责人建议 |
|:------:|------|------|:------:|-----------|
| **P0** | 条码扫码 | 原生扫码插件 + 路由分发 + 追溯码识别 | 2天 | 阿澈 |
| **P0** | 蓝牙打印 | 热敏打印插件 + 模板引擎 + 后端打印记录 | 3天 | 阿坚（后端） + 阿澈（前端） |
| **P1** | 离线能力 | SQLite 建表 + 增量同步 + 离线开单 | 5天 | 阿坚（后端扩展） + 阿澈（前端） |
| **P1** | 安全加固 | Token 加密 + 证书锁定 + 防调试 | 2天 | 阿澈 |
| **P1** | 分包优化 | pages.json 分包改造 + 路由适配 | 1天 | 阿澈 |
| **P2** | 推送通知 | 极光集成 + 后端推送服务 + 点击跳转 | 3天 | 阿坚（后端） + 阿澈（前端） |
| **P2** | 虚拟滚动 | 高频列表页面改造 | 1天 | 阿澈 |
| **P3** | HarmonyOS | 条件编译适配 + Scan Kit / Push Kit | 5天 | 阿澈 |

### 实施顺序建议

```
第1周: P0 扫码 + P1 安全加固 + P1 分包优化
第2周: P0 蓝牙打印（后端 + 前端）
第3周: P1 离线能力（后端扩展 + SQLite + 同步）
第4周: P2 推送通知 + P2 虚拟滚动
后续:  P3 HarmonyOS 适配
```

### 后端需新建的文件清单

| 文件 | 说明 |
|------|------|
| `backend/src/routes/print.routes.ts` | 打印记录路由 |
| `backend/src/services/admin/print.service.ts` | 打印记录服务 |
| `backend/src/controllers/admin/print.controller.ts` | 打印记录控制器 |
| `backend/src/services/admin/push.service.ts` | 推送服务（统一接口） |
| `backend/src/controllers/admin/sync.controller.ts` | 扩展：新增 delta 端点 |
| `backend/src/services/sync/delta-sync.service.ts` | 增量同步服务 |
| `docs/migrations/xxx_print_record.sql` | 打印记录表 DDL |

### 前端需新建的文件清单

| 文件 | 说明 |
|------|------|
| `app-mobile/src/native/scan.ts` | 扫码插件封装 |
| `app-mobile/src/native/print.ts` | 打印插件封装 |
| `app-mobile/src/native/push.ts` | 推送插件封装 |
| `app-mobile/src/native/sqlite.ts` | SQLite 操作层 |
| `app-mobile/src/api/local-db.ts` | 本地数据库业务层 |
| `app-mobile/src/utils/crypto.ts` | 加密工具 |
| `app-mobile/src/utils/pin-ssl.ts` | 证书锁定 |
| `app-mobile/src/utils/security.ts` | 安全检查 |