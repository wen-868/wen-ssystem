# 智享全链 — 小程序平台 & 支付配置 实施方案

> 版本：v1.0 | 日期：2026-07-01 | 状态：待实施

---

## 一、设计原则

1. **小程序模板 = 纯UI样式差异**，不区分业务版本（零售/批发/渠道），价格展示由客户绑定的客户类型驱动
2. **支付配置 = 租户级**，每个商户配置自己的微信支付/支付宝凭证，未配置时引导配置
3. **模板可扩展**，前期3套，架构支持后续无限添加
4. **一键发布 = 编译时多态**，共享代码 + 构建时注入客户配置

---

## 二、数据库设计

### 2.1 sys_config 新增支付配置项

```sql
-- 微信支付配置（租户级）
INSERT INTO sys_config (config_key, config_value, config_group, description, tenant_id) VALUES
('payment.wechat.app_id', '', 'payment', '微信支付 AppID', 'DEFAULT'),
('payment.wechat.app_secret', '', 'payment', '微信支付 AppSecret', 'DEFAULT'),
('payment.wechat.mch_id', '', 'payment', '微信支付商户号', 'DEFAULT'),
('payment.wechat.api_v3_key', '', 'payment', '微信支付 API v3 密钥', 'DEFAULT'),
('payment.wechat.serial_no', '', 'payment', '微信支付证书序列号', 'DEFAULT'),
('payment.wechat.private_key', '', 'payment', '微信支付商户私钥(PEM)', 'DEFAULT'),
('payment.wechat.notify_url', '', 'payment', '微信支付回调地址', 'DEFAULT'),
('payment.wechat.enabled', '0', 'payment', '微信支付是否启用(0/1)', 'DEFAULT'),
('payment.alipay.app_id', '', 'payment', '支付宝 AppID', 'DEFAULT'),
('payment.alipay.private_key', '', 'payment', '支付宝应用私钥', 'DEFAULT'),
('payment.alipay.enabled', '0', 'payment', '支付宝是否启用(0/1)', 'DEFAULT');
```

### 2.2 miniapp_config — 小程序平台配置

```sql
CREATE TABLE miniapp_config (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  platform    VARCHAR(20)  NOT NULL COMMENT 'WECHAT/ALIPAY/DOUYIN/KUAISHOU',
  app_id      VARCHAR(64)  NOT NULL DEFAULT '',
  app_secret  VARCHAR(512) NOT NULL DEFAULT '' COMMENT '加密存储',
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

### 2.3 miniapp_template — 模板仓库

```sql
CREATE TABLE miniapp_template (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(64)  NOT NULL COMMENT '模板名称',
  description  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '模板描述',
  thumbnail    VARCHAR(512) NOT NULL DEFAULT '' COMMENT '缩略图URL',
  preview_urls JSON         NULL     COMMENT '预览截图URL列表',
  style_config JSON         NOT NULL COMMENT '样式配置: {primaryColor, backgroundColor, fontFamily, borderRadius, tabBarStyle, ...}',
  page_config  JSON         NOT NULL COMMENT '页面配置: {homeLayout, productCardStyle, orderFlowStyle, ...}',
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  status       VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/inactive',
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序模板';
```

### 2.4 miniapp_publish_log — 发布历史

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

### 2.5 初始模板数据

```sql
INSERT INTO miniapp_template (name, description, style_config, page_config, sort_order, status) VALUES
(
  '经典蓝白',
  '蓝白配色，简洁大方，适合大多数酒水商家',
  '{"primaryColor":"#1677FF","secondaryColor":"#E6F4FF","backgroundColor":"#F5F5F5","fontFamily":"PingFang SC","borderRadius":"8px","tabBarStyle":"default"}',
  '{"homeLayout":"standard","productCardStyle":"grid","orderFlowStyle":"step","showBanner":true,"showCategoryNav":true,"showSearchBar":true}',
  1, 'active'
),
(
  '暖橙商务',
  '暖橙色调，温暖亲切，适合中高端酒水门店',
  '{"primaryColor":"#FA8C16","secondaryColor":"#FFF7E6","backgroundColor":"#FAFAFA","fontFamily":"PingFang SC","borderRadius":"12px","tabBarStyle":"rounded"}',
  '{"homeLayout":"featured","productCardStyle":"list","orderFlowStyle":"simple","showBanner":true,"showCategoryNav":true,"showSearchBar":true,"showPromotionBanner":true}',
  2, 'active'
),
(
  '深色臻品',
  '深色高级感，黑金配色，适合高端酒品专卖',
  '{"primaryColor":"#1A1A2E","secondaryColor":"#E8D5B7","backgroundColor":"#0D0D0D","fontFamily":"PingFang SC","borderRadius":"4px","tabBarStyle":"dark","darkMode":true}',
  '{"homeLayout":"premium","productCardStyle":"large","orderFlowStyle":"minimal","showBanner":true,"showCategoryNav":false,"showSearchBar":true,"showBrandStory":true}',
  3, 'active'
);
```

---

## 三、后端接口设计

### 3.1 支付配置服务 — PaymentConfigService

**文件：** `backend/src/services/admin/payment-config.service.ts`

```
PaymentConfigService:
  getPaymentConfig(tenantId, provider)   → 返回支付渠道配置(脱敏)
  savePaymentConfig(tenantId, provider, data) → 保存配置(加密敏感字段)
  isProviderReady(tenantId, provider)    → 检查是否已完成配置
  testConnection(tenantId, provider)     → 测试支付连接
```

**路由：** `backend/src/routes/payment-config.routes.ts`

```
GET    /api/admin/payment/configs              → 获取所有支付渠道配置
GET    /api/admin/payment/configs/:provider    → 获取指定渠道配置
PUT    /api/admin/payment/configs/:provider    → 保存指定渠道配置
POST   /api/admin/payment/configs/:provider/test → 测试连接
GET    /api/admin/payment/status              → 各渠道配置状态（是否已配置）
```

### 3.2 WechatPay 改造

**文件：** `backend/src/shared/wechat-pay.ts`

当前构造函数从 `env` 读取：
```ts
// 改造前
constructor() {
  this.config = {
    appId: env.WECHAT_APP_ID,
    mchId: env.WECHAT_MCH_ID,
    ...
  }
}
```

改造后：
```ts
// 改造后
constructor(config: WechatPayConfig) {
  this.config = config;
}

// 静态工厂方法
static async fromTenant(tenantId: string): Promise<WechatPay> {
  const config = await paymentConfigService.getPaymentConfig(tenantId, 'wechat');
  return new WechatPay(config);
}
```

### 3.3 支付触发检测

在支付业务代码中调用 `WechatPay` 前：
```ts
const ready = await paymentConfigService.isProviderReady(tenantId, 'wechat');
if (!ready) {
  return res.status(400).json({ 
    code: 'PAYMENT_NOT_CONFIGURED', 
    message: '请先配置微信支付',
    action: 'configure_payment',
    provider: 'wechat'
  });
}
```

前端收到 `PAYMENT_NOT_CONFIGURED` 错误码时弹窗引导配置。

### 3.4 小程序配置服务 — MiniappConfigService

**文件：** `backend/src/services/admin/miniapp-config.service.ts`

```
MiniappConfigService:
  listConfigs(tenantId)                    → 所有平台配置列表
  getConfig(tenantId, platform)            → 获取指定平台配置
  saveConfig(tenantId, platform, data)     → 保存配置
  getStatus(tenantId, platform)            → 配置状态
  listTemplates(platform)                  → 可用模板列表
  getTemplate(id)                          → 模板详情
  publish(tenantId, platform)              → 触发发布
  getPublishHistory(tenantId, platform)    → 发布历史
```

**路由：** `backend/src/routes/miniapp-config.routes.ts`

```
GET    /api/admin/miniapp/configs              → 列表
GET    /api/admin/miniapp/configs/:platform    → 获取
PUT    /api/admin/miniapp/configs/:platform    → 保存
GET    /api/admin/miniapp/templates            → 模板列表
GET    /api/admin/miniapp/templates/:id        → 模板详情
POST   /api/admin/miniapp/publish              → 一键发布
GET    /api/admin/miniapp/publish-logs         → 发布历史
```

### 3.5 发布引擎 — MiniappPublishService

**文件：** `backend/src/services/admin/miniapp-publish.service.ts`

发布流程：
```
1. 读取客户 miniapp_config (appId, appSecret, templateId)
2. 读取 miniapp_template (styleConfig, pageConfig)
3. 读取 sys_config (apiBaseUrl, companyName, companyLogo, themeColor)
4. 生成配置文件:
   - project.config.json → appid 替换
   - manifest.json → appid 替换
   - src/config.js → 注入 apiBaseUrl, tenantId, styleConfig, pageConfig
5. 执行编译: npx uni build -p mp-weixin
6. 调用 miniprogram-ci 上传
7. 记录发布日志
8. 返回版本号 + 体验码
```

---

## 四、前端页面设计

### 4.1 SystemConfigView.vue — 支付配置 Tab 改造

**现状：** 支付配置 Tab 只有三个开关（微信支付/支付宝/线下支付）

**改造后：**

```
┌─ 支付配置 Tab ──────────────────────────────────────────────┐
│                                                             │
│  ┌─ 微信支付 ──────────────────────────────────────────┐   │
│  │  [启用开关]                          [已配置 ✓]     │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │ AppID          [wx1234567890abcdef        ]     ││   │
│  │  │ AppSecret      [••••••••••••••••] [显示/隐藏]  ││   │
│  │  │ 商户号(MchID)  [1234567890              ]      ││   │
│  │  │ API v3 密钥    [••••••••••••••••] [显示/隐藏]  ││   │
│  │  │ 证书序列号     [ABC1234567890           ]      ││   │
│  │  │ 商户私钥       [上传 .pem 文件]                ││   │
│  │  │ 回调地址       [https://api.xxx.com/...]       ││   │
│  │  │                (自动生成，可修改)               ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │  [测试连接]  [保存配置]                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 支付宝 ────────────────────────────────────────────┐   │
│  │  [启用开关]                          [未配置 ⚠]     │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │ AppID          [____________________]           ││   │
│  │  │ 应用私钥       [____________________]           ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │  [保存配置]                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 线下支付 ──────────────────────────────────────────┐   │
│  │  [启用开关]                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [全部保存]                                                 │
└─────────────────────────────────────────────────────────────┘
```

**支付触发检测弹窗：**
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

### 4.2 /system/miniapp-config — 小程序配置页（新建）

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
│  │  基础信息                                            │   │
│  │  ┌──────────────────────────────────────────────────┐│   │
│  │  │ AppID         [wx1234567890abcdef        ]       ││   │
│  │  │ AppSecret     [••••••••••••••••] [显示/隐藏]    ││   │
│  │  │ 小程序名称    [智享全链                    ]     ││   │
│  │  │ 小程序图标    [上传 120x120px]                   ││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  │                                                      │   │
│  │  选择模板                                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │          │ │          │ │          │            │   │
│  │  │ [预览图] │ │ [预览图] │ │ [预览图] │            │   │
│  │  │          │ │          │ │          │            │   │
│  │  │ 经典蓝白 │ │ 暖橙商务 │ │ 深色臻品 │            │   │
│  │  │ 简洁大方 │ │ 温暖亲切 │ │ 高级质感 │            │   │
│  │  │   ✓ 已选 │ │  [选择]  │ │  [选择]  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  │                                                      │   │
│  │  [保存配置]  [一键发布]                              │   │
│  │                                                      │   │
│  │  发布历史                                            │   │
│  │  ┌──────────────────────────────────────────────────┐│   │
│  │  │ 2026-06-30  v1.2.0  发布成功  查看详情          ││   │
│  │  │ 2026-06-15  v1.1.0  发布成功  查看详情          ││   │
│  │  │ 2026-06-01  v1.0.0  发布成功  查看详情          ││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 系统菜单更新

在 `MainLayout.vue` 菜单中新增：
```
设置
├── 系统配置    /system
├── 参数配置    /system/config
├── 支付配置    /system/payment-config  ← 新增（或合并到参数配置）
├── 小程序配置  /system/miniapp-config  ← 新增
└── 角色权限    /system/roles
```

---

## 五、一键发布技术实现

### 5.1 编译时配置注入

代码仓库 `app-mobile/` 中新增 `src/config.template.js`：

```js
// 构建时被替换为实际值
export default {
  apiBaseUrl: '__API_BASE_URL__',
  tenantId: '__TENANT_ID__',
  appName: '__APP_NAME__',
  theme: {
    primaryColor: '__PRIMARY_COLOR__',
    secondaryColor: '__SECONDARY_COLOR__',
    backgroundColor: '__BACKGROUND_COLOR__',
    fontFamily: '__FONT_FAMILY__',
    borderRadius: '__BORDER_RADIUS__',
    tabBarStyle: '__TAB_BAR_STYLE__',
    darkMode: '__DARK_MODE__',
  },
  pageConfig: {
    homeLayout: '__HOME_LAYOUT__',
    productCardStyle: '__PRODUCT_CARD_STYLE__',
    orderFlowStyle: '__ORDER_FLOW_STYLE__',
    showBanner: '__SHOW_BANNER__',
    showCategoryNav: '__SHOW_CATEGORY_NAV__',
    showSearchBar: '__SHOW_SEARCH_BAR__',
    showPromotionBanner: '__SHOW_PROMOTION_BANNER__',
    showBrandStory: '__SHOW_BRAND_STORY__',
  }
};
```

### 5.2 发布脚本

`backend/scripts/publish-miniapp.ts`：

```ts
// 发布流程伪代码
async function publishMiniapp(tenantId: string, platform: string) {
  // 1. 读取配置
  const config = await miniappConfigService.getConfig(tenantId, platform);
  const template = await miniappTemplateService.getTemplate(config.templateId);
  
  // 2. 准备构建目录
  const buildDir = `/tmp/miniapp-build/${tenantId}_${platform}_${Date.now()}`;
  await copyDirectory('app-mobile/', buildDir);
  
  // 3. 注入配置
  replacePlaceholders(buildDir, {
    '__API_BASE_URL__': 'https://api.zhixiang-chain.com',
    '__TENANT_ID__': tenantId,
    '__APP_NAME__': config.appName,
    '__PRIMARY_COLOR__': template.styleConfig.primaryColor,
    // ... 其他替换
  });
  replaceFile(buildDir + '/project.config.json', { appid: config.appId });
  replaceFile(buildDir + '/manifest.json', { 'mp-weixin.appid': config.appId });
  
  // 4. 编译
  await exec(`cd ${buildDir} && npm install && npx uni build -p mp-weixin`);
  
  // 5. 上传
  const ci = require('miniprogram-ci');
  const project = new ci.Project({
    appid: config.appId,
    projectPath: buildDir + '/dist/build/mp-weixin',
    privateKeyPath: `/tmp/keys/${tenantId}_${platform}_private.key`,
    ignores: ['node_modules/**/*'],
  });
  const uploadResult = await ci.upload({ project, version: generateVersion(), ... });
  
  // 6. 记录日志
  await miniappConfigService.recordPublish(tenantId, platform, template.id, uploadResult);
  
  return uploadResult;
}
```

### 5.3 版本号生成规则

```
v{YYYY}.{MM}.{DD}.{seq}  例如: v2026.07.01.01
```

---

## 六、任务拆解 & 分派

### Phase A：支付配置改造（1-2天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| A1 | DB迁移 | 阿坚 | 新增 `payment.wechat.*` 和 `payment.alipay.*` 配置项到 sys_config，同时迁移现有 env 配置到 DEFAULT 租户 |
| A2 | PaymentConfigService | 后端 | 新建 `payment-config.service.ts`，实现 getConfig / saveConfig / isProviderReady / testConnection |
| A3 | WechatPay 改造 | 后端 | 构造函数改为接收 config 对象，新增 `fromTenant()` 静态工厂方法 |
| A4 | 支付配置路由 | 后端 | 新建 `payment-config.routes.ts`，注册到 server.ts |
| A5 | 支付触发检测 | 后端 | 所有调用 WechatPay 的地方增加 `isProviderReady()` 检测，未配置返回 `PAYMENT_NOT_CONFIGURED` 错误码 |
| A6 | 前端支付配置Tab | 前端 | 重写 `SystemConfigView.vue` 支付配置 Tab，按渠道卡片展示，含凭证输入 + 测试连接 + 开关 |
| A7 | 前端支付检测弹窗 | 前端 | 支付触发时收到 `PAYMENT_NOT_CONFIGURED` → 弹窗引导配置 |

### Phase B：小程序配置页面（1-2天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| B1 | DB建表 | 阿坚 | 执行 `miniapp_config` 建表 SQL |
| B2 | MiniappConfigService | 后端 | 新建 `miniapp-config.service.ts`，实现 listConfigs / getConfig / saveConfig / getStatus |
| B3 | 小程序配置路由 | 后端 | 新建 `miniapp-config.routes.ts`，注册到 server.ts |
| B4 | 前端小程序配置页 | 前端 | 新建 `/system/miniapp-config` 页面，平台Tab切换 + 凭证配置表单 |
| B5 | 菜单更新 | 前端 | `MainLayout.vue` 菜单增加"小程序配置"入口 |

### Phase C：模板系统（1-2天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| C1 | DB建表 | 阿坚 | 执行 `miniapp_template`、`miniapp_publish_log` 建表 SQL + 插入3套初始模板数据 |
| C2 | MiniappTemplateService | 后端 | 新建 `miniapp-template.service.ts`，实现 listTemplates / getTemplate |
| C3 | 模板路由 | 后端 | 注册模板相关路由 |
| C4 | 前端模板选择 | 前端 | 小程序配置页增加模板选择区域（卡片网格 + 选中态） |
| C5 | 模板预览 | 前端 | 模板卡片点击可查看大图/详情 |
| C6 | 模板可扩展设计 | 前端+后端 | 模板数据从数据库读取，`styleConfig` 和 `pageConfig` 为 JSON 字段，新增模板只需插入数据 |

### Phase D：一键发布（2-3天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| D1 | 配置注入模板 | 全栈 | `app-mobile/src/config.template.js`，占位符变量 |
| D2 | MiniappPublishService | 后端 | 新建 `miniapp-publish.service.ts`，实现完整的发布流程 |
| D3 | 发布路由 | 后端 | `POST /admin/miniapp/publish` 和 `GET /admin/miniapp/publish-logs` |
| D4 | 前端发布按钮 | 前端 | 小程序配置页增加"一键发布"按钮 + 发布状态弹窗 |
| D5 | 前端发布历史 | 前端 | 小程序配置页底部展示发布历史列表 |
| D6 | 端到端测试 | 全栈 | 配置 → 选择模板 → 一键发布 → 验证成功 |

### Phase E：联调 & 收尾（1天）

| 序号 | 任务 | 负责人 | 内容 |
|------|------|--------|------|
| E1 | 全流程联调 | 全栈 | 支付配置 → 小程序配置 → 模板选择 → 发布 |
| E2 | 边界情况处理 | 全栈 | 未配置时各入口的提示、密钥脱敏、错误处理 |
| E3 | 文档更新 | 全栈 | 更新 MEMORY.md / WORKING-MEMORY.md |

---

## 七、文件清单

### 新建文件

```
backend/
  src/services/admin/payment-config.service.ts
  src/services/admin/miniapp-config.service.ts
  src/services/admin/miniapp-template.service.ts
  src/services/admin/miniapp-publish.service.ts
  src/routes/payment-config.routes.ts
  src/routes/miniapp-config.routes.ts
  scripts/publish-miniapp.ts

admin-web/
  src/views/PaymentConfigView.vue        (新建，或合并到 SystemConfigView)
  src/views/MiniappConfigView.vue        (新建)

app-mobile/
  src/config.template.js                 (新建)

docs/
  sql/migrate_payment_miniapp.sql        (新建)
  design/miniapp-platform-plan.md        (本文档)
```

### 修改文件

```
backend/
  src/shared/wechat-pay.ts               (构造函数改造)
  src/server.ts                          (注册新路由)
  src/controllers/*.ts                   (支付触发点增加检测)
  src/services/admin/sys-config.service.ts (可能需扩展)

admin-web/
  src/views/SystemConfigView.vue         (支付配置Tab重写)
  src/layouts/MainLayout.vue             (菜单新增项)
  src/router/index.ts                    (新增路由)
  src/api.ts                             (新增API调用)
```

---

## 八、模板设计说明

### 模板1：经典蓝白

- **定位：** 默认模板，适合大多数酒水商家
- **主色调：** #1677FF（蓝）
- **布局：** 标准首页（Banner + 分类导航 + 搜索 + 商品网格）
- **卡片风格：** 圆角8px，白底阴影
- **下单流程：** 分步式（选商品 → 确认 → 支付）

### 模板2：暖橙商务

- **定位：** 中高端酒水门店，温暖亲切
- **主色调：** #FA8C16（暖橙）
- **布局：** 精选首页（大Banner + 促销区 + 商品列表）
- **卡片风格：** 圆角12px，大图卡片
- **下单流程：** 简化式（快速下单）

### 模板3：深色臻品

- **定位：** 高端酒品专卖，高级质感
- **主色调：** #1A1A2E（深黑） + #E8D5B7（香槟金）
- **布局：** 高端首页（全屏Banner + 品牌故事 + 商品大卡片）
- **卡片风格：** 直角4px，暗色背景
- **下单流程：** 极简式（一键下单）
- **特殊：** 暗色模式

### 模板扩展方式

新增模板只需：
1. 数据库 `miniapp_template` 插入一行数据
2. 上传缩略图到 CDN
3. 填写 `styleConfig` 和 `pageConfig` JSON
4. 前端自动识别并展示

**不需要修改任何代码。**

---

## 九、小程序价格展示逻辑

**核心原则：小程序不区分零售/批发/渠道版本，价格由客户类型驱动。**

```
客户登录小程序
  → 识别客户类型（绑定在 customer 表的 type 字段）
  → 不同类型对应不同价格：
    - RETAIL（零售客户）→ 零售价
    - WHOLESALE（批发客户）→ 批发价
    - CHANNEL（渠道客户）→ 渠道价
    - VIP → VIP价
  → 商品详情页展示对应价格
  → 下单时使用对应价格
```

**实现方式：**
- 后端 `GET /miniapp/products` 接口根据 `req.customer.type` 返回对应价格
- 前端不需要做任何版本区分，统一渲染

---

## 十、实施顺序

```
Phase A (支付配置) ──→ Phase B (小程序配置) ──→ Phase C (模板系统) ──→ Phase D (一键发布) ──→ Phase E (联调收尾)
      ↓                      ↓                      ↓                      ↓
   支付能配置            小程序能配置           模板能选择            一键能发布            全流程跑通
   未配置能检测          多平台能切换           模板能预览            发布能追踪            边界处理完
```

**Phase A 和 Phase B 可以并行开发**（后端不同服务、前端不同页面），Phase C 依赖 Phase B 的页面框架，Phase D 依赖 Phase C 的模板系统。