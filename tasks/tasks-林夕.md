# 林夕 · Bug修复 · 安全审计

**日期**：2026-07-02
**状态**：待开始
**来源**：全面审查报告 + WorkBuddy 测试报告交叉核对

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 修复微信支付回调签名验证（`verifyNotifySignature` 始终返回 true） | P0 安全 | ❌ |
| 2 | 清理冗余路由文件（instant-retail.routes.ts、menu-permission.routes.ts、quote.routes.ts） | P2 | ❌ |

---

## 详细说明

### 1. 修复微信支付回调签名验证 ⚡ P0 安全漏洞
- **文件**：`backend/src/services/admin/wechat-pay.ts`（第 181-194 行）
- **问题**：`verifyNotifySignature` 方法内部直接 `return true`，没有对微信支付回调做任何签名校验
- **风险**：任何人都可以伪造微信支付回调通知，篡改订单支付状态
- **修复方案**：
  1. 在 `wechat-pay.ts` 中实现真正的 RSA-SHA256 签名校验
  2. 使用微信支付平台公钥（从 `AP WechatPay-Serial` header 获取证书序列号，加载对应证书）
  3. 验证流程：
     ```
     signature = base64(sha256(with_rsa_private_key(sign_message)))
     其中 sign_message = "{timestamp}\n{nonce}\n{body}\n"
     ```
  4. 如果 RSA 校验不通过，返回 `false`
  5. 如果缺少必要的 header（Wechatpay-Timestamp、Wechatpay-Nonce、Wechatpay-Signature），也返回 `false`
- **参考文档**：微信支付 v3 API 签名验证规范
- **注意**：此修复需要使用 `node-rsa` 或 `crypto` 模块，确保已在 package.json 中

### 2. 清理冗余路由文件
- **文件**：
  - `backend/src/routes/instant-retail.routes.ts` — 已被 `instant-retail-new.routes.ts` 替代
  - `backend/src/routes/menu-permission.routes.ts` — 功能已合并到 `rbac.routes.ts`
  - `backend/src/routes/quote.routes.ts` — 功能可能已废弃
- **修复**：确认这些路由文件确实未被 `server.ts` 导入后，删除文件
- **验证**：删除后运行 `npx tsc --noEmit` 确保不影响编译
