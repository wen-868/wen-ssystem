# 阿坚 · Phase 16 · 字段对齐修复 · 后端

**日期**：2026-07-02
**状态**：✅ 全部完成（已合并 main）
**来源**：Phase 15 字段级审计 — DDL vs Service vs 前端 三方对齐

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 重写 `miniapp-template.service.ts` 匹配 DDL 字段 | **P0** | ✅ |
| 2 | 修复 `wechat-pay.ts` `fromTenant()` 字段名 | **P0** | ✅ |
| 3 | 修复 `payment-config.service.ts` provider 校验 | **P0** | ✅ |
| 4 | 修复 `payment-config.service.ts` config_key 统一 snake_case | **P0** | ✅ |
| 5 | 修复 `miniapp-publish.service.ts` INSERT 缺失 `action`/`result` | **P0** | ✅ |
| 6 | 修复 `miniapp-config.service.ts` INSERT 缺失字段 | P1 | ✅ |
| 7 | 修复 `payment-config.service.ts` `is_encrypted` 硬编码 0 | P1 | ✅ |

---

## 详细说明

### 1. 重写 `miniapp-template.service.ts` 🔴 致命

- **文件**：`backend/src/services/admin/miniapp-template.service.ts`
- **问题**：整个文件使用了 5 个 DDL 不存在的虚构字段，INSERT 在严格模式下会直接失败
- **DDL 实际字段**：`name, description, thumbnail, preview_urls(JSON), style_config(JSON), page_config(JSON), version, status, sort_order, tenant_id`
- **当前代码使用的虚构字段**：`category`, `config_json`, `page_count`, `component_count`, `is_default`
- **修复**：全部重写，匹配 DDL。关键点：

```typescript
// listTemplates — SELECT 必须匹配 DDL 字段
export async function listTemplates(tenantId: string) {
  const rows = await queryWithTenant(tenantId,
    `SELECT id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order
     FROM miniapp_template WHERE (tenant_id = ? OR tenant_id = 'DEFAULT') AND status = 'active'
     ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );
  return rows.map(row => ({
    ...row,
    previewUrls: safeJsonParse(row.preview_urls, []),
    styleConfig: safeJsonParse(row.style_config, {}),
    pageConfig: safeJsonParse(row.page_config, {}),
  }));
}

// createTemplate — INSERT 必须包含 style_config 和 page_config (NOT NULL)
export async function createTemplate(tenantId: string, body: any) {
  const result = await queryWithTenant(tenantId,
    `INSERT INTO miniapp_template (tenant_id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, body.name, body.description || '', body.thumbnail || '',
     JSON.stringify(body.previewUrls || []),
     JSON.stringify(body.styleConfig || {}),
     JSON.stringify(body.pageConfig || {}),
     body.version || '1.0.0', body.status || 'active', body.sortOrder || 0]
  );
  return result.insertId;
}

// updateTemplate — 更新 map 必须匹配 DDL 字段
export async function updateTemplate(tenantId: string, id: number, body: any) {
  const map: Record<string, string> = {
    name: "name", description: "description", thumbnail: "thumbnail",
    previewUrls: "preview_urls", styleConfig: "style_config", pageConfig: "page_config",
    version: "version", status: "status", sortOrder: "sort_order",
  };
  // ... 构建 SET 子句
}
```

- **删除映射**：删除 `category`、`configJson`、`pageCount`、`componentCount`、`isDefault` 这些虚构字段
- **新增映射**：`previewUrls` → `preview_urls`、`styleConfig` → `style_config`、`pageConfig` → `page_config`

### 2. 修复 `wechat-pay.ts` `fromTenant()` 字段名 🔴

- **文件**：`backend/src/shared/wechat-pay.ts`
- **Bug 行**：第 39 行 `'private_key_path'`，第 56 行 `config.private_key_path`
- **DDL 实际值**：`migrate_v3_payment_miniapp.sql` 第 32 行 `('DEFAULT', 'wechat_pay', 'private_key', '', 1, '商户私钥(PEM)', 6)`
- **修复**：
  ```typescript
  // 第 39 行
  const keys = ['app_id', 'mch_id', 'api_v3_key', 'serial_no', 'private_key', 'notify_url'];
  // 第 56 行
  privateKeyPath: config.private_key || undefined,
  ```

### 3. 修复 `payment-config.service.ts` provider 校验 🔴

- **文件**：`backend/src/services/admin/payment-config.service.ts`
- **Bug 行**：第 77-82 行 `isProviderReady` 中检查 `provider === "wechat_pay"`
- **前端发送**：`provider = "wechat"`（小写，无 `_pay` 后缀）
- **修复方案**：统一使用 `"wechat"` 和 `"alipay"`（不带 `_pay`），同时迁移 DDL 种子数据

```typescript
// isProviderReady 中
const requiredKeys = provider === "wechat"
  ? ["enabled", "app_id", "mch_id", "api_v3_key", "serial_no", "private_key", "notify_url"]
  : provider === "alipay"
    ? ["enabled", "app_id", "private_key", "alipay_public_key", "notify_url"]
    : [];
```

- **同时修改 DDL 种子数据**：将 `provider = 'wechat_pay'` 改为 `provider = 'wechat'`

### 4. 修复 `payment-config.service.ts` config_key 统一 snake_case 🔴

- **文件**：`backend/src/services/admin/payment-config.service.ts`
- **Bug 行**：第 49 行 `saveChannelConfig` 直接使用前端 body 的 key 作为 `config_key`
- **前端发送的 key**：camelCase（`mchId`, `appId`, `apiV3Key`, `serialNo`, `privateKey`, `notifyUrl`）
- **DDL 种子数据和 `isProviderReady` 使用的 key**：snake_case（`mch_id`, `app_id`, `api_v3_key`, `serial_no`, `private_key`, `notify_url`）
- **修复方案**：在 `saveChannelConfig` 中添加 key 映射表

```typescript
const KEY_MAP: Record<string, string> = {
  appId: "app_id", mchId: "mch_id", apiV3Key: "api_v3_key",
  serialNo: "serial_no", privateKey: "private_key", notifyUrl: "notify_url",
  enabled: "enabled",
};

for (const [rawKey, value] of Object.entries(body)) {
  const key = KEY_MAP[rawKey] || rawKey;  // 映射 camelCase → snake_case
  // ... 继续存储
}
```

### 5. 修复 `miniapp-publish.service.ts` INSERT 缺失字段 🔴

- **文件**：`backend/src/services/admin/miniapp-publish.service.ts`
- **Bug**：`publish()`、`rollback()`、`submitAudit()` 三处 INSERT 遗漏 `action` 和 `result` 字段
- **DDL**：`action VARCHAR(20) NOT NULL`、`result VARCHAR(20) NOT NULL`（均无默认值）
- **修复**：

```typescript
// publish() 第 26 行 INSERT 添加
// action = 'publish', result = 'success'
INSERT INTO miniapp_publish_log (tenant_id, platform, template_id, action, version, result, remark, status)
VALUES (?, ?, ?, 'publish', ?, 'success', ?, 'published')

// rollback() 第 46 行
// action = 'rollback', result = 'success'
INSERT INTO miniapp_publish_log (tenant_id, platform, template_id, action, version, result, remark, status)
VALUES (?, ?, ?, 'rollback', ?, 'success', ?, 'rollback')

// submitAudit() 第 61 行
// action = 'submit_audit', result = 'pending'
INSERT INTO miniapp_publish_log (tenant_id, platform, template_id, action, version, result, remark, status)
VALUES (?, ?, ?, 'submit_audit', ?, 'pending', '提交审核', 'audit_submitted')
```

### 6. 修复 `miniapp-config.service.ts` INSERT 缺失字段

- **文件**：`backend/src/services/admin/miniapp-config.service.ts`
- **问题**：`saveConfig` INSERT 遗漏 `template_id`、`audit_reason`、`publish_version`、`published_at`
- **修复**：在 INSERT 列和 VALUES 中补充这些字段，使用默认值

### 7. 修复 `payment-config.service.ts` `is_encrypted` 硬编码 0

- **文件**：`backend/src/services/admin/payment-config.service.ts`
- **Bug 行**：第 67 行 INSERT 中 `is_encrypted` 硬编码为 `0`
- **问题**：首次保存敏感字段（如 `api_v3_key`、`private_key`）时不会加密
- **修复**：根据 key 名判断是否需要加密

```typescript
const SENSITIVE_KEYS = ["api_v3_key", "private_key", "app_secret"];
const isEncrypted = SENSITIVE_KEYS.includes(key) ? 1 : 0;
```

---

## 验收标准

1. `miniapp-template.service.ts` 所有 SQL 字段名与 DDL 完全一致，INSERT 包含 `style_config` 和 `page_config`
2. `wechat-pay.ts` `fromTenant()` 使用 `private_key` 而非 `private_key_path`
3. `payment-config.service.ts` 所有 provider 统一为 `"wechat"` / `"alipay"`
4. `payment-config.service.ts` `saveChannelConfig` 将 camelCase key 映射为 snake_case
5. `miniapp-publish.service.ts` 三处 INSERT 包含 `action` 和 `result`
6. 后端编译通过：`cd backend && npx tsc --noEmit` 无错误

---

## 文件清单

```
backend/src/
├── services/
│   └── admin/
│       ├── miniapp-template.service.ts    # 重写：虚构字段→DDL实际字段
│       ├── miniapp-publish.service.ts     # 修改：INSERT 补充 action/result
│       ├── miniapp-config.service.ts      # 修改：INSERT 补充缺失字段
│       └── payment-config.service.ts      # 修改：provider统一 + key映射 + is_encrypted
└── shared/
    └── wechat-pay.ts                      # 修改：private_key_path → private_key
```