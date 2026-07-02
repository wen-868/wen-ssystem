# 墨 · Phase 16 · 字段对齐修复 · 管理后台前端

**日期**：2026-07-02
**状态**：待开始
**来源**：Phase 15 字段级审计 — 前端表单字段 vs 后端 DDL/API 对齐

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 修复 `PaymentConfigView.vue` provider 统一为 `"wechat"` | **P0** | ❌ |
| 2 | 修复 `PaymentConfigView.vue` enabled 值类型 | **P0** | ❌ |
| 3 | 修复 `setDefaultBankAccount` HTTP 方法为 PUT | **P0** | ❌ |
| 4 | 修复 `PaymentConfigView.vue` 银行表单 `bankBranch` → `branchName` | P1 | ❌ |
| 5 | 补充 `MiniappConfigView.vue` 表单字段 | P1 | ❌ |

---

## 详细说明

### 1. 修复 `PaymentConfigView.vue` provider 统一为 `"wechat"` 🔴

- **文件**：`admin-web/src/views/PaymentConfigView.vue`
- **Bug**：前端使用 `provider = "wechat"`（小写），后端 DDL 种子数据使用 `provider = "wechat_pay"`
- **修复**：后端已统一为 `"wechat"` / `"alipay"`，前端无需修改，但需确认 `api.ts` 中所有支付 API 路径中的 provider 参数为 `"wechat"`（不带 `_pay`）
- **验证**：检查 `api.ts` 中所有 `/admin/payment/configs/` 路径，确认 provider 参数名

### 2. 修复 `PaymentConfigView.vue` enabled 值类型 🔴

- **文件**：`admin-web/src/views/PaymentConfigView.vue`
- **Bug**：`el-switch` active-value 为 `true`（boolean），但 DDL 中 `config_value` 是字符串类型，后端 `isProviderReady` 检查 `！== "1"`
- **修复**：

```html
<!-- 修改前 -->
<el-switch v-model="paymentForm.enabled" active-value="1" inactive-value="0" />

<!-- 或者更直接：v-model 绑定后用计算属性转换 -->
```

- **具体做法**：在保存时将 `enabled` 转换为字符串 `"1"` / `"0"`：

```typescript
// 在 savePaymentConfig 函数的 payload 构建中
const payload = {
  ...paymentForm.value,
  enabled: paymentForm.value.enabled ? "1" : "0",
};
```

### 3. 修复 `setDefaultBankAccount` HTTP 方法为 PUT 🔴

- **文件 1**：`admin-web/src/api.ts` 第 2123 行
- **文件 2**：`admin-web/src/views/PaymentConfigView.vue` 第 614 行
- **Bug**：前端使用 `api.post()`，后端路由匹配 `router.put()`
- **修复**：将 `api.post` 改为 `api.put`

```typescript
// api.ts 第 2123 行
export async function setDefaultBankAccount(id: number) {
  return api.put(`/admin/payment/bank-accounts/${id}/default`);  // post → put
}
```

### 4. 修复 `PaymentConfigView.vue` 银行表单 `bankBranch` → `branchName`

- **文件**：`admin-web/src/views/PaymentConfigView.vue`
- **Bug 位置**：第 227、374、546、570 行
- **问题**：表单字段名为 `bankBranch`，后端期望 `branchName`
- **修复**：全局替换 `bankBranch` → `branchName`

```html
<!-- 修改前 -->
<el-form-item label="开户支行">
  <el-input v-model="bankForm.bankBranch" />
</el-form-item>

<!-- 修改后 -->
<el-form-item label="开户支行">
  <el-input v-model="bankForm.branchName" />
</el-form-item>
```

- 同时修改 `bankForm` 初始化对象中的 `bankBranch: ''` → `branchName: ''`

### 5. 补充 `MiniappConfigView.vue` 表单字段

- **文件**：`admin-web/src/views/MiniappConfigView.vue`
- **问题**：当前表单仅覆盖 5 个字段，DDL 有 30+ 字段
- **修复**：补充以下关键字段：
  - `appDescription`（应用描述）— 对应 DDL `app_description`
  - `appIcon`（应用图标上传）— 对应 DDL `app_icon`
  - 移除 `enabled` 字段（DDL 和后端 service 均不存在此字段），改用 `status` 字段（`draft` / `published`）

---

## 验收标准

1. `PaymentConfigView.vue` 中 `enabled` 保存时转为字符串 `"1"` / `"0"`
2. `setDefaultBankAccount` API 调用使用 `api.put()`
3. 银行表单中 `bankBranch` 全部替换为 `branchName`
4. `MiniappConfigView.vue` 移除 `enabled` 字段，改用 `status`
5. 编译通过：`cd admin-web && npx vue-tsc --noEmit` 无错误

---

## 文件清单

```
admin-web/src/
├── views/
│   ├── PaymentConfigView.vue    # 修改：enabled值类型 + bankBranch→branchName
│   └── MiniappConfigView.vue    # 修改：移除enabled→status + 补充字段
└── api.ts                       # 修改：setDefaultBankAccount post→put
```