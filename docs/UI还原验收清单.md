# 总后台 UI 还原验收清单（对齐设计稿 v1.6）

- **视觉权威**：`docs/智享全链_总后台UI设计稿_v1.6.html`
- **工程**：`saas-admin/`（Vue 3 + TypeScript + Element Plus）
- **负责人**：林夕（UI/UX）· **验收人**：凌舟
- **提交**：`b71c70ab`（还原收尾 21 文件）、`937f4e94`（商品详情弹窗 + 令牌审计）
- **验证证据**：`vite build` exit 0；令牌审计 0 处未定义；38 张真机截图

---

## 一、覆盖情况（17 板块 / 25 页面）

| 板块 | 页面文件 | 行数 | 状态 |
|---|---|---|---|
| 01 运营大盘 | views/Dashboard.vue | 527 | ✅ 已还原 |
| 02 租户管理 | views/tenant/TenantList.vue | 441 | ✅ 已还原 |
| 02 租户管理（弹窗） | views/tenant/TenantDetail.vue | 390 | ✅ 已还原 |
| 03 套餐管理 | views/Packages.vue | 378 | ✅ 已还原 |
| 03 套餐表单 | views/PackageForm.vue | 640 | ✅ 已还原 |
| 04 账单计费 | views/Reconciliation.vue | 591 | ✅ 已还原 |
| 05 AI 中心 ①模型接入 | views/ai-config/PlatformAiConfig.vue | 607 | ✅ 已还原 |
| 05 AI 中心 ②计费策略 ③额度包 ④积分抵扣 | views/ai-config/AiBillingConfig.vue | 507 | ✅ 已还原 |
| 05 AI 中心 ⑤计量流水 ⑥用量看板 | views/ai-config/AiUsageStats.vue | 288 | ✅ 已还原 |
| 06 渠道推广 | views/marketing/ChannelPromotion.vue | 297 | ✅ 已还原 |
| 07 管理员权限 | views/platform/AdminPermissions.vue | 450 | ✅ 已还原 |
| 08 系统配置 | views/Settings.vue | 480 | ✅ 已还原 |
| 09 模板中心 | views/platform/TemplateCenter.vue | 430 | ✅ 已还原 |
| 10 监控告警 | views/monitor/MonitorView.vue | 470 | ✅ 已还原 |
| 11 公告管理 | views/Announcements.vue | 611 | ✅ 已还原 |
| 12 工单系统 | views/ops/TicketSystem.vue | 180 | ✅ 已还原 |
| 13 版本发布 | views/AppVersions.vue | 568 | ✅ 已还原 |
| 14 开放平台（密钥） | views/open/ApiKeyList.vue | 240 | ✅ 已还原 |
| 14 开放平台（Webhook） | views/open/WebhookList.vue | 175 | ✅ 已还原 |
| 15 登录页 | views/login/PlatformLogin.vue | 356 | ✅ 已还原 |
| 16 推客代理 | views/marketing/AgentManagement.vue | 1045 | ✅ 已还原 |
| 17 商品库 · SPU 主数据 | views/library/LibrarySpus.vue | 861 | ✅ 已还原 |
| 17 商品库 · 类目/品牌 | views/library/LibraryBrands.vue | 449 | ✅ 已还原 |
| 17 商品库 · 评价/审核队列 | views/library/LibraryReviews.vue | 454 | ✅ 已还原 |
| 17 商品库 · 批量导入 | views/library/LibraryImport.vue | 450 | ✅ 已还原 |

设计稿中并排展示的弹层也已落到对应页面：

- 02 租户操作弹窗 → TenantDetail 内弹层
- 03 套餐表单（右侧滑出 486px）→ PackageForm 抽屉式卡片
- 17 商品详情 / 驳回原因 / 批量导入 → LibrarySpus 详情弹窗、LibraryReviews 驳回弹窗、LibraryImport 导入页

---

## 二、验收证据（均为实跑结果）

1. **构建**：`vite build` → `✓ 1662 modules transformed` / `✓ built in 35.95s` / exit 0
2. **令牌审计**（`token-audit.cjs` 递归扫全部页面）：未定义令牌 0 处（`var(--xxx)` 全部命中 tokens.css）
3. **真机截图**：dev server + Edge headless 经 CDP 批量截图 38 张，覆盖全部路由（含 10 个存量孤儿页）→ `D:/Users/ZXQL/ZXQL-MS/shots-verify/`
4. **本轮修复**：MonitorView 失效 import（`../api` 的 fetchApiStats/getErrorLogs 不存在 → 真实 `fetchMonitorData`）；LibrarySpus 旧 TypeError 随重写移除；PlatformReviews 失效令牌 `--brand-primary` → `--color-primary`

---

## 三、环境说明（非页面缺陷）

- 后端（localhost:8080）未启动时，全局请求拦截器会弹出 `Request failed with status code 500` 瞬时提示。页面自身已按「不造假数据」原则回落空态（如「暂无租户数据 · 待接入 GET /platform/tenants」）。**联调环境启动后端后该提示自然消失。**
- 截图为 headless 无后端状态，故列表中数据区呈空态。

---

## 四、待凌舟决策

1. **设计稿未给界面的 4 个入口**（套餐：升降级流向报表 / 配额详情 / 续费策略 / 复制套餐）—— 现为占位提示 + TODO，是否补设计？
2. **草稿状态落库**：套餐「草稿」映射为 `status=INACTIVE`（后端无 DRAFT 枚举），是否新增枚举？
3. **无界面规范的两项菜单**：优惠码、招商线索 —— 侧栏已置灰待补设计。
4. **10 个存量孤儿页面**（注册审核 / 订阅管理 / 订阅申请 / 平台评价 / 消息配置 / 错误日志 / 租户使用统计 / 移动端预览 / AI 租户配置 / 认知层）：设计稿未覆盖，路由保留但侧栏不可达，需确认处理策略（补设计 / 下线路由）。

---

## 五、下次复跑验证

```
node D:/Users/ZXQL/ZXQL-MS/audit-pages.cjs      # 还原覆盖盘点
node D:/Users/ZXQL/ZXQL-MS/token-audit.cjs      # 令牌合法性
node D:/Users/ZXQL/ZXQL-MS/verify-ui.cjs        # 起 dev+Edge 全量截图
```
