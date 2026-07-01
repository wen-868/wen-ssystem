# 智享全链 — 小程序平台 & 支付配置 实施方案

> 版本：v2.0 | 日期：2026-07-01 | 状态：待实施

---

## 一、设计原则

1. **微信支付 AppID ≠ 微信小程序 AppID**，两者独立配置，不可混淆
   - 微信支付 AppID：来自微信支付商户平台，管钱（收款/退款）
   - 微信小程序 AppID：来自微信公众平台，管小程序本身（发布/登录/消息）
2. **支付配置 = 租户级全局配置**，独立二级菜单，含微信支付/支付宝/银行账号
3. **小程序模板 = 纯UI样式差异**，价格由客户类型驱动，不区分业务版本
4. **模板可扩展**，前期3套，架构支持后续无限添加
5. **一键发布 = 编译时多态**，共享代码 + 构建时注入客户配置
6. **实时同步**：系统调价 → 小程序实时生效，WebSocket + 轮询双通道

---

## 二、数据库设计

### 2.1 支付配置表 — payment_config（新建）

> 支付配置独立成表，不再放 sys_config，因为需要支持银行账号列表等复杂结构

```sql
CREATE TABLE payment_config (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  provider    VARCHAR(20)  NOT NULL COMMENT 'wechat_pay/alipay/unionpay',
  config_key  VARCHAR(64)  NOT NULL,
  config_value TEXT        NOT NULL,
  is_encrypted TINYINT     NOT NULL DEFAULT 0 COMMENT '是否加密存储',
  description VARCHAR(255) NOT NULL DEFAULT '',
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_provider_key (tenant_id, provider, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付渠道配置';
```

### 2.2 银行账号表 — bank_account（新建）

```sql
CREATE TABLE bank_account (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(64)  NOT NULL,
  bank_name     VARCHAR(64)  NOT NULL COMMENT '银行名称',
  branch_name   VARCHAR(128) NOT NULL DEFAULT '' COMMENT '支行名称',
  account_name  VARCHAR(64)  NOT NULL COMMENT '开户名',
  account_no    VARCHAR(64)  NOT NULL COMMENT '银行账号(加密)',
  bank_code     VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '银行联行号',
  qr_code_url   VARCHAR(512) NOT NULL DEFAULT '' COMMENT '收款码图片URL',
  is_default    TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认收款账户',
  status        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
  remark        VARCHAR(255) NOT NULL DEFAULT '',
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='银行收款账户';
```

### 2.3 支付配置初始数据

```sql
-- 微信支付配置（支付AppID，非小程序AppID！）
INSERT INTO payment_config (tenant_id, provider, config_key, config_value, is_encrypted, description, sort_order) VALUES
('DEFAULT', 'wechat_pay', 'enabled', '0', 0, '是否启用', 1),
('DEFAULT', 'wechat_pay', 'app_id', '', 0, '微信支付 AppID（来自 pay.weixin.qq.com）', 2),
('DEFAULT', 'wechat_pay', 'mch_id', '', 0, '微信支付商户号', 3),
('DEFAULT', 'wechat_pay', 'api_v3_key', '', 1, 'API v3 密钥', 4),
('DEFAULT', 'wechat_pay', 'serial_no', '', 0, '证书序列号', 5),
('DEFAULT', 'wechat_pay', 'private_key', '', 1, '商户私钥(PEM)', 6),
('DEFAULT', 'wechat_pay', 'notify_url', '', 0, '支付回调地址', 7);

-- 支付宝配置
INSERT INTO payment_config (tenant_id, provider, config_key, config_value, is_encrypted, description, sort_order) VALUES
('DEFAULT', 'alipay', 'enabled', '0', 0, '是否启用', 1),
('DEFAULT', 'alipay', 'app_id', '', 0, '支付宝 AppID', 2),
('DEFAULT', 'alipay', 'private_key', '', 1, '应用私钥', 3),
('DEFAULT', 'alipay', 'alipay_public_key', '', 0, '支付宝公钥', 4),
('DEFAULT', 'alipay', 'notify_url', '', 0, '支付回调地址', 5);
```

### 2.4 miniapp_config — 小程序平台配置

> 注意：这里的 app_id 是**小程序 AppID**（来自 mp.weixin.qq.com），与支付 AppID 完全不同

```sql
CREATE TABLE miniapp_config (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  platform    VARCHAR(20)  NOT NULL COMMENT 'WECHAT/ALIPAY/DOUYIN/KUAISHOU',
  app_id      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '小程序 AppID（来自公众平台）',
  app_secret  VARCHAR(512) NOT NULL DEFAULT '' COMMENT '小程序 AppSecret（加密存储）',
  app_name    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '小程序名称',
  app_icon    VARCHAR(512) NOT NULL DEFAULT '' COMMENT '小程序图标URL',
  template_id INT          NULL     COMMENT '关联 miniapp_template.id',
  status      VARCHAR(20)  NOT NULL DEFAULT 'draft' COMMENT 'draft/published',
  publish_version VARCHAR(20) DEFAULT '' COMMENT '发布版本号',
  published_at    DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序平台配置';
```

### 2.5 miniapp_template — 模板仓库

```sql
CREATE TABLE miniapp_template (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(64)  NOT NULL COMMENT '模板名称',
  description  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '模板描述',
  thumbnail    VARCHAR(512) NOT NULL DEFAULT '' COMMENT '缩略图URL',
  preview_urls JSON         NULL     COMMENT '预览截图URL列表',
  style_config JSON         NOT NULL COMMENT '样式配置',
  page_config  JSON         NOT NULL COMMENT '页面配置',
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  status       VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/inactive',
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序模板';
```

### 2.6 miniapp_publish_log — 发布历史

```sql
CREATE TABLE miniapp_publish_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  platform    VARCHAR(20)  NOT NULL,
  template_id INT          NULL,
  action      VARCHAR(20)  NOT NULL COMMENT 'publish/update/offline',
  version     VARCHAR(20)  NOT NULL DEFAULT '',
  result      VARCHAR(20)  NOT NULL COMMENT 'success/failed',
  error_msg   TEXT         NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序发布日志';
```

### 2.7 初始模板数据

```sql
INSERT INTO miniapp_template (name, description, style_config, page_config, sort_order, status) VALUES
('经典蓝白', '蓝白配色，简洁大方，适合大多数酒水商家',
 '{"primaryColor":"#1677FF","secondaryColor":"#E6F4FF","backgroundColor":"#F5F5F5","fontFamily":"PingFang SC","borderRadius":"8px","tabBarStyle":"default"}',
 '{"homeLayout":"standard","productCardStyle":"grid","orderFlowStyle":"step","showBanner":true,"showCategoryNav":true,"showSearchBar":true}',
 1, 'active'),
('暖橙商务', '暖橙色调，温暖亲切，适合中高端酒水门店',
 '{"primaryColor":"#FA8C16","secondaryColor":"#FFF7E6","backgroundColor":"#FAFAFA","fontFamily":"PingFang SC","borderRadius":"12px","tabBarStyle":"rounded"}',
 '{"homeLayout":"featured","productCardStyle":"list","orderFlowStyle":"simple","showBanner":true,"showCategoryNav":true,"showSearchBar":true,"showPromotionBanner":true}',
 2, 'active'),
('深色臻品', '深色高级感，黑金配色，适合高端酒品专卖',
 '{"primaryColor":"#1A1A2E","secondaryColor":"#E8D5B7","backgroundColor":"#0D0D0D","fontFamily":"PingFang SC","borderRadius":"4px","tabBarStyle":"dark","darkMode":true}',
 '{"homeLayout":"premium","productCardStyle":"large","orderFlowStyle":"minimal","showBanner":true,"showCategoryNav":false,"showSearchBar":true,"showBrandStory":true}',
 3, 'active');
```

---

## 三、后端接口设计

### 3.1 支付配置服务 — PaymentConfigService

**文件：** `backend/src/services/admin/payment-config.service.ts`

```
PaymentConfigService:
  ── 支付渠道配置 ──
  getChannelConfig(tenantId, provider)      → 返回支付渠道完整配置(敏感字段脱敏)
  saveChannelConfig(tenantId, provider, data) → 保存配置(自动加密敏感字段)
  isProviderReady(tenantId, provider)       → 检查是否已完成配置
  testConnection(tenantId, provider)        → 测试支付连接

  ── 银行账号管理 ──
  listBankAccounts(tenantId)               → 银行账号列表
  createBankAccount(tenantId, data)        → 添加银行账号
  updateBankAccount(id, data)              → 编辑银行账号
  deleteBankAccount(id)                    → 删除银行账号
  setDefaultBankAccount(id)                → 设为默认收款账户
```

**路由：** `backend/src/routes/payment-config.routes.ts`

```
GET    /api/admin/payment/configs/:provider     → 获取指定渠道配置
PUT    /api/admin/payment/configs/:provider     → 保存指定渠道配置
POST   /api/admin/payment/configs/:provider/test → 测试连接
GET    /api/admin/payment/status               → 各渠道配置状态

GET    /api/admin/payment/bank-accounts        → 银行账号列表
POST   /api/admin/payment/bank-accounts        → 添加银行账号
PUT    /api/admin/payment/bank-accounts/:id    → 编辑银行账号
DELETE /api/admin/payment/bank-accounts/:id    → 删除银行账号
POST   /api/admin/payment/bank-accounts/:id/default → 设为默认
```

### 3.2 WechatPay 改造

```ts
// 改造后：构造函数接收 config 对象
constructor(config: WechatPayConfig) {
  this.config = config;
}

// 静态工厂：从租户配置创建
static async fromTenant(tenantId: string): Promise<WechatPay> {
  const config = await paymentConfigService.getDecryptedConfig(tenantId, 'wechat_pay');
  return new WechatPay(config);
}
```

### 3.3 支付触发检测

```ts
const ready = await paymentConfigService.isProviderReady(tenantId, 'wechat_pay');
if (!ready) {
  return res.status(400).json({ 
    code: 'PAYMENT_NOT_CONFIGURED', 
    message: '请先配置微信支付',
    provider: 'wechat_pay'
  });
}
```

### 3.4 小程序配置服务 — MiniappConfigService

**文件：** `backend/src/services/admin/miniapp-config.service.ts`

```
MiniappConfigService:
  listConfigs(tenantId)                    → 所有平台配置列表
  getConfig(tenantId, platform)            → 获取指定平台配置
  saveConfig(tenantId, platform, data)     → 保存配置
  getStatus(tenantId, platform)            → 配置状态
  listTemplates()                          → 可用模板列表
  getTemplate(id)                          → 模板详情
  publish(tenantId, platform)              → 触发发布
  getPublishHistory(tenantId, platform)    → 发布历史
```

### 3.5 实时同步机制

**场景：** 管理员在后台调价 → 小程序端需要实时看到新价格

**方案：WebSocket + 轮询双通道**

```
┌──────────────┐     WebSocket      ┌──────────────┐
│  管理后台     │ ─── 调价事件 ───→  │  后端服务     │
│  (调价操作)   │                    │  (事件广播)   │
└──────────────┘                    └──────┬───────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │ WebSocket            │ 轮询（兜底）         │
                    ▼                     ▼                     │
            ┌──────────────┐     ┌──────────────┐              │
            │  小程序端     │     │  小程序端     │              │
            │  (实时推送)   │     │  (定时拉取)   │              │
            └──────────────┘     └──────────────┘              │
```

**后端实现：**

```
backend/src/services/sync/
  price-sync.service.ts          → 价格变更事件广播
  product-sync.service.ts        → 商品上下架同步

API:
  GET  /api/miniapp/sync/check   → 客户端轮询：返回上次同步时间戳后的变更列表
  GET  /api/miniapp/sync/price   → 客户端轮询：返回当前商品最新价格
```

**小程序端实现：**

```js
// app-mobile/src/utils/sync.js
// 1. 优先 WebSocket（即时）
// 2. 兜底轮询（每30秒检查一次）
// 3. 页面 onShow 时主动拉取最新价格
```

---

## 四、前端页面设计

### 4.1 系统菜单结构

```
设置
├── 系统配置       /system              （门店管理 + 员工管理）
├── 参数配置       /system/config        （通用/订单/库存/通知开关）
├── 支付配置       /system/payment       ← 新建，独立二级菜单
├── 小程序配置     /system/miniapp       ← 新建，独立二级菜单
└── 角色权限       /system/roles
```

### 4.2 /system/payment — 支付配置页（新建）

```
┌─ 支付配置 ──────────────────────────────────────────────────┐
│                                                             │
│  ┌── Tab: 微信支付 ──┬── Tab: 支付宝 ──┬── Tab: 银行账号 ─┐│
│                                                                
│  ┌─ 微信支付 ──────────────────────────────────────────┐   │
│  │  [启用开关]                          [已配置 ✓]     │   │
│  │                                                     │   │
│  │  ⚠ 注意：此处填写的是微信「支付」AppID，            │   │
│  │     来自 pay.weixin.qq.com（商户平台）              │   │
│  │     不是小程序 AppID（小程序配置在另一页面）         │   │
│  │                                                     │   │
│  │  AppID(支付)   [wx1234567890abcdef        ]        │   │
│  │  商户号(MchID) [1234567890              ]          │   │
│  │  API v3 密钥   [••••••••••••••••] [👁]            │   │
│  │  证书序列号    [ABC1234567890           ]          │   │
│  │  商户私钥      [上传 .pem 文件]                    │   │
│  │  回调地址      [https://api.xxx.com/...]           │   │
│  │                (自动生成，可修改)                   │   │
│  │                                                     │   │
│  │  [测试连接]  [保存]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 支付宝 ────────────────────────────────────────────┐   │
│  │  [启用开关]                          [未配置 ⚠]     │   │
│  │  AppID       [____________________]                  │   │
│  │  应用私钥    [____________________]                  │   │
│  │  支付宝公钥  [____________________]                  │   │
│  │  回调地址    [____________________]                  │   │
│  │  [保存]                                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 银行账号 ──────────────────────────────────────────┐   │
│  │  [+ 添加银行账号]                                    │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │ ⭐ 中国工商银行  北京分行                       ││   │
│  │  │    开户名：XX酒业有限公司                       ││   │
│  │  │    账号：6222 **** **** 1234                    ││   │
│  │  │    联行号：102100099996                        ││   │
│  │  │    [设为默认] [编辑] [删除]                     ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │    中国建设银行  深圳分行                       ││   │
│  │  │    开户名：XX酒业有限公司                       ││   │
│  │  │    账号：4367 **** **** 5678                    ││   │
│  │  │    [设为默认] [编辑] [删除]                     ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 /system/miniapp — 小程序配置页（新建）

```
┌─ 小程序配置 ─────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ 微信小程序│ 支付宝   │ 抖音     │ 快手     │              │
│  │  (已发布) │ (未配置) │ (未配置) │ (未配置) │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│  ┌─ 微信小程序 ─────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  ⚠ 注意：此处填写的是微信「小程序」AppID，           │   │
│  │     来自 mp.weixin.qq.com（公众平台）                │   │
│  │     不是支付 AppID（支付配置在另一页面）              │   │
│  │                                                      │   │
│  │  小程序 AppID     [wx1234567890abcdef        ]       │   │
│  │  小程序 AppSecret [••••••••••••••••] [👁]           │   │
│  │  小程序名称       [智享全链                    ]     │   │
│  │  小程序图标       [上传 120x120px]                   │   │
│  │                                                      │   │
│  │  选择模板                                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │ [预览图] │ │ [预览图] │ │ [预览图] │            │   │
│  │  │ 经典蓝白 │ │ 暖橙商务 │ │ 深色臻品 │            │   │
│  │  │   ✓ 已选 │ │  [选择]  │ │  [选择]  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  │                                                      │   │
│  │  [保存配置]  [一键发布]                              │   │
│  │                                                      │   │
│  │  发布历史                                            │   │
│  │  ┌──────────────────────────────────────────────────┐│   │
│  │  │ 2026-06-30  v1.2.0  发布成功  查看详情          ││   │
│  │  │ 2026-06-15  v1.1.0  发布成功  查看详情          ││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 支付触发检测弹窗

```
┌──────────────────────────────────┐
│  ⚠ 微信支付未配置                │
│                                  │
│  您尚未配置微信支付凭证，         │
│  无法发起在线收款。               │
│                                  │
│  请前往 [支付配置] 页面完成配置。 │
│                                  │
│        [取消]    [去配置]         │
└──────────────────────────────────┘
```

---

## 五、AppID 对照总表

| 用途 | AppID 来源 | 配置位置 | 说明 |
|------|-----------|---------|------|
| 微信支付 | pay.weixin.qq.com（商户平台） | 支付配置 → 微信支付 | 管收款/退款，关联商户号 |
| 微信小程序 | mp.weixin.qq.com（公众平台） | 小程序配置 → 微信小程序 | 管小程序发布/登录 |
| 支付宝支付 | open.alipay.com（开放平台） | 支付配置 → 支付宝 | 管支付宝收款 |
| 支付宝小程序 | open.alipay.com（开放平台） | 小程序配置 → 支付宝 | 管支付宝小程序发布 |

**关键：微信支付 AppID 和微信小程序 AppID 是两个不同的 AppID，来自两个不同的平台，绝对不能共用！**

---

## 六、一键发布 & 实时同步

### 6.1 发布引擎

```
发布流程：
1. 读取 miniapp_config (小程序AppID, 小程序AppSecret, templateId)
2. 读取 miniapp_template (styleConfig, pageConfig)
3. 读取 sys_config (apiBaseUrl, companyName, companyLogo)
4. 注入配置到 app-mobile 项目:
   - project.config.json → appid 替换为小程序AppID
   - manifest.json → mp-weixin.appid 替换为小程序AppID
   - src/config.js → 注入 apiBaseUrl/tenantId/theme
5. 编译: npx uni build -p mp-weixin
6. 上传: miniprogram-ci
7. 记录日志
```

### 6.2 实时同步机制

**同步内容：**
- 商品价格变更 → 小程序实时展示
- 商品上下架 → 小程序实时展示
- 客户类型变更 → 小程序实时价格切换

**技术方案：**

| 通道 | 方式 | 延迟 | 场景 |
|------|------|------|------|
| WebSocket | 服务端主动推送 | <1秒 | 价格变更/商品上下架/库存预警 |
| 轮询 | 客户端定时拉取 | 30秒 | WebSocket 断开时的兜底方案 |
| onShow | 页面显示时拉取 | 即时机 | 小程序从后台切回前台 |

**后端实现：**

```
backend/src/services/sync/
  price-sync.service.ts     → 价格变更 WebSocket 广播
  product-sync.service.ts   → 商品状态变更广播

路由：
  GET /api/miniapp/sync/check?since=timestamp  → 返回变更列表
  GET /api/miniapp/sync/prices?ids=1,2,3       → 返回最新价格
```

**小程序端实现：**

```js
// app-mobile/src/utils/sync.js
export class SyncManager {
  // 1. 建立 WebSocket 连接
  connect() { ... }
  
  // 2. 收到价格变更推送 → 更新本地缓存
  onPriceChange(data) { ... }
  
  // 3. WebSocket 断开 → 启动轮询
  startPolling() { ... }  // 每30秒 GET /miniapp/sync/check
  
  // 4. 页面 onShow → 主动拉取
  refresh() { ... }
}
```

---

## 七、任务拆解 & 分派

### Phase A：支付配置（独立二级菜单）（1-2天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| A1 | DB建表 | 阿坚 | 新建 `payment_config` + `bank_account` 表，插入初始数据 |
| A2 | PaymentConfigService | 后端 | 实现渠道配置 CRUD + 银行账号 CRUD + 加密存储 |
| A3 | 支付配置路由 | 后端 | 新建 `payment-config.routes.ts`，注册到 server.ts |
| A4 | WechatPay 改造 | 后端 | 构造函数改为接收 config 对象，新增 `fromTenant()` |
| A5 | 支付触发检测 | 后端 | 所有支付入口增加 `isProviderReady()` 检测 |
| A6 | 前端支付配置页 | 前端 | 新建 `/system/payment` 页面，含微信支付/支付宝/银行账号三个Tab |
| A7 | 菜单更新 | 前端 | `MainLayout.vue` 菜单增加"支付配置"入口 |
| A8 | 前端支付检测弹窗 | 前端 | 支付触发时收到 `PAYMENT_NOT_CONFIGURED` → 弹窗引导配置 |

### Phase B：小程序配置（1-2天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| B1 | DB建表 | 阿坚 | 执行 `miniapp_config` 建表 SQL |
| B2 | MiniappConfigService | 后端 | 实现 listConfigs / getConfig / saveConfig / getStatus |
| B3 | 小程序配置路由 | 后端 | 新建 `miniapp-config.routes.ts` |
| B4 | 前端小程序配置页 | 前端 | 新建 `/system/miniapp` 页面，含平台Tab + 凭证表单 + 明显区分支付AppID的提示 |
| B5 | 菜单更新 | 前端 | 菜单增加"小程序配置"入口 |

### Phase C：模板系统（1-2天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| C1 | DB建表 | 阿坚 | 执行 `miniapp_template` + `miniapp_publish_log` 建表 + 插入3套模板 |
| C2 | MiniappTemplateService | 后端 | 实现 listTemplates / getTemplate |
| C3 | 路由注册 | 后端 | 注册模板相关路由 |
| C4 | 前端模板选择 | 前端 | 小程序配置页增加模板选择区域（卡片 + 选中态 + 预览） |
| C5 | 模板可扩展设计 | 前后端 | 模板数据从DB读取，新增模板只需插入数据 |

### Phase D：一键发布 + 实时同步（2-3天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| D1 | 配置注入模板 | 全栈 | `app-mobile/src/config.template.js` |
| D2 | MiniappPublishService | 后端 | 发布流程：配置注入 → 编译 → miniprogram-ci 上传 |
| D3 | 发布路由 | 后端 | `POST /admin/miniapp/publish` + `GET /admin/miniapp/publish-logs` |
| D4 | 前端发布按钮 | 前端 | "一键发布"按钮 + 状态弹窗 + 发布历史 |
| D5 | 实时同步服务 | 后端 | WebSocket 价格推送 + 轮询 API |
| D6 | 小程序同步客户端 | 前端 | SyncManager：WebSocket + 轮询 + onShow 刷新 |
| D7 | 端到端测试 | 全栈 | 调价 → 小程序实时生效 |

### Phase E：联调 & 收尾（1天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| E1 | 全流程联调 | 全栈 | 支付配置 → 小程序配置 → 模板选择 → 发布 → 价格同步 |
| E2 | 边界情况 | 全栈 | 未配置支付/小程序时的各入口提示、密钥脱敏 |
| E3 | 文档更新 | 全栈 | 更新 MEMORY.md / WORKING-MEMORY.md |

---

## 八、文件清单

### 新建文件

```
backend/
  src/services/admin/payment-config.service.ts
  src/services/admin/miniapp-config.service.ts
  src/services/admin/miniapp-template.service.ts
  src/services/admin/miniapp-publish.service.ts
  src/services/sync/price-sync.service.ts
  src/services/sync/product-sync.service.ts
  src/routes/payment-config.routes.ts
  src/routes/miniapp-config.routes.ts
  scripts/publish-miniapp.ts

admin-web/
  src/views/PaymentConfigView.vue        (新建)
  src/views/MiniappConfigView.vue        (新建)

app-mobile/
  src/config.template.js                 (新建)
  src/utils/sync.js                      (新建)

docs/
  sql/migrate_v3_payment_miniapp.sql     (新建)
```

### 修改文件

```
backend/
  src/shared/wechat-pay.ts               (构造函数改造)
  src/server.ts                          (注册新路由)
  src/controllers/admin/order.controller.ts (支付触发点增加检测)
  src/controllers/admin/sales.controller.ts (支付触发点增加检测)

admin-web/
  src/views/SystemConfigView.vue         (移除支付配置Tab，精简)
  src/layouts/MainLayout.vue             (菜单新增两项)
  src/router/index.ts                    (新增两个路由)
  src/api.ts                             (新增API调用)

app-mobile/
  src/pages/products/products.vue        (集成 SyncManager 实时价格)
  src/pages/home/home.vue                (集成 SyncManager)
```

---

## 九、价格同步完整链路

```
后台管理员调价
  │
  ▼
POST /admin/products/:id  (price: 100 → 120)
  │
  ├─→ 更新 MySQL products 表
  │
  ├─→ PriceSyncService.broadcastPriceChange(productId, newPrice)
  │     │
  │     ├─→ WebSocket 推送 → 在线小程序客户端实时收到
  │     │
  │     └─→ 写入 price_change_log 表（供轮询客户端拉取）
  │
  ▼
小程序端
  │
  ├─ WebSocket 在线 → 收到推送 → 更新本地缓存 → UI 刷新
  │
  ├─ 轮询（30秒）→ GET /miniapp/sync/check → 有变更 → 拉取最新价格
  │
  └─ onShow → GET /miniapp/products → 全量刷新价格
```