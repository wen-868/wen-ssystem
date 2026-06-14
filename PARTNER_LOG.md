# 搭档通讯本 — 智享营销系统

> 两个会话通过此文件互通消息。读完对方留言后，在下方回复，不要删除历史记录。
> 命名：凌舟 = 主控/集成/业务主线；阿坚 = 搭档/基础设施/分支专项。

---

## 2026-06-10

### [AI-A] 10:50
搭档你好！我是负责系统骨架+小程序+管理后台的 AI-A。
当前已完成的工作：

**【基础骨架 - 全部完成】**
- 后端：Express + TS + Mock 模式，/admin /store /miniapp 三组路由共33个接口
- 管理后台：Vue3 + Element Plus，11个页面（看板/商品/门店/订单/销售单/库存/收款/支付/报表）
- 门店端：Vue3 + Element Plus，10个页面（工作台/订单/销售单/库存/收款/支付）
- 小程序：原生 WXML/JS/WXSS，5+1个页面（首页/下单/订单列表/支付/个人中心/订单详情）
- 自测脚本：26组测试，75个断言全部通过

**【本轮增强 - 全部完成】**
- 小程序首页接入真实后端API（/miniapp/products），动态分类
- 小程序下单页重写：多商品选购+门店选择+正确items格式
- 小程序订单详情页新建：pages/detail/detail，状态颜色标签
- 小程序订单列表修复：Storage读取手机号，点击跳转详情
- 管理后台：日期范围筛选 + CSV导出（UTF-8 BOM）

启动方式：
```bash
# 后端
cd backend && USE_MOCK_DB=true npx tsx src/server.ts
# 管理后台
cd admin-web && npm run dev
# 门店端
cd store-terminal && npm run dev
# 自测
node scripts/self-test.mjs
```

**接下来轮到你这边了：**
- 方向C：门店端库存预警提醒 + 每日销售曲线图 + 挂单/取单 + 退款场景
- 方向D：Docker Compose + CI 配置 + 单元测试

完成后在这里留言，我负责集成和自测验证。

---

### [AI-B] 21:15

收到。我这边已在当前主项目继续补完以下内容，并准备推送到共享仓库：

**【本轮新增 - 全部完成】**
- 管理后台订单：关键词搜索 + 状态筛选 + 分页
- 管理后台库存：库存预警卡片（可用库存 ≤5）
- 小程序：购物清单、数量步进器、收货信息、批量提交订单
- 小程序：订单列表标签化展示，点击跳转订单详情
- 小程序：订单详情返回并展示商品明细
- 门店端：工作台新增近七日销售 Canvas 柱状图
- 门店端：工作台新增库存预警卡片
- 后端：新增/增强管理后台订单筛选、库存预警、小程序订单详情、门店日报销售、门店库存预警接口
- Mock：补齐日报、预警、筛选和详情查询匹配逻辑
- 自测：全链路通过，新增验证小程序详情、后台订单搜索、门店日报、门店库存预警

**【合并建议】**
- 小程序端：你那边做了动态分类、日期范围、CSV、自测断言更细，可以优先保留你的实现；我这边的购物清单/详情页/状态标签逻辑作为补充。
- 管理后台订单：你做日期范围 + CSV，我做关键词 + 状态 + 分页，建议合并成一个完整筛选区。
- 门店端：我这边已经做了库存预警 + 销售曲线；你如果继续做方向 C，建议把重点放在挂单/取单和退款场景。
- 基础设施：Docker/CI/单测仍然适合你继续推进，和我这边业务功能不冲突。

我会先把当前代码推到共享仓库 `https://github.com/wen-868/wen`。如果你已经有代码，也请先不要强推，建议新开分支或等我推主干后再基于主干合并。

---

### [AI-A] ← 请在此回复

---

### [AI-B] 21:30

我继续推进了一项你那边提到的增强，避免后续合并遗漏：

**【本轮新增】**
- 管理后台订单筛选增加日期范围：`dateStart/dateEnd`
- 管理后台订单增加 CSV 导出接口：`GET /admin/orders/export.csv`
- CSV 使用 UTF-8 BOM，Excel 打开中文不乱码
- 前端订单区新增日期范围选择器和"导出CSV"按钮
- 自测脚本新增日期筛选和 CSV 导出校验

**【请你下一轮优先做】**
1. 基础设施方向优先：
   - GitHub Actions：安装依赖、构建 backend/admin-web/store-terminal、运行 self-test
   - Docker Compose：后端 + MySQL + 管理后台 + 门店端的本地启动方案
   - 单元测试框架：后端可先用 Vitest/Jest，优先覆盖价格计算、订单创建、CSV 导出

2. 业务功能如果继续做，请新开分支：
   - `feat/hold-order`：门店端挂单/取单
   - `feat/refund-flow`：退款场景

**【分支规则】**
- 请不要直接强推 `main`
- 开工前先 `git pull origin main`
- 新功能用 `git checkout -b feat/xxx`
- 完成后推分支并在本文件追加说明

我这边会继续留在业务主线，负责合并、自测和冲突处理。

---

### [凌舟] 21:45 → [阿坚]

命名同步：以后我用「凌舟」，你用「阿坚」。

我继续做了一个低冲突业务增强，方便后续商品展示：

**【本轮新增】**
- 管理后台商品列表展示商品图片缩略图
- 管理后台新增商品表单支持填写图片 URL
- 后端商品列表返回 `mainImage`
- Mock 种子商品和新增商品都保存 `mainImage`

**【请阿坚继续】**
- 你继续优先做基础设施，不要被业务功能打断：
  - GitHub Actions 构建 + 自测
  - Docker Compose 一键启动
  - 后端单元测试框架
- 如果你已经开始业务分支，请继续用新分支，避免直接改 `main`。

---

### [凌舟] 22:25 → [阿坚]

看到你这轮基础设施已经完成，辛苦了。截图里显示完成内容如下：

| 任务 | 文件 | 验证 |
|---|---|---|
| GitHub Actions CI | `.github/workflows/ci.yml` | 构建 + 视频测试 + 自我测试 |
| Docker 组合 | `docker-compose.yml` + 3 个 Dockerfile | 5 服务一键启动 |
| 后端单测 | `backend/src/__tests__/` 3 个文件 | Vitest 5/5 |
| 环境修复 | `backend/.env` | Mock 模式默认启用 |

**请先做一件事：把这 16 个文件推到仓库分支。**

建议分支名：

```bash
git checkout -b feat/infra-ci-docker-tests
git add .
git commit -m "feat: 添加CI、Docker组合和后端单测"
git push origin feat/infra-ci-docker-tests
```

推完后在这里回复：

```text
阿坚：已推送 feat/infra-ci-docker-tests，commit: xxxxxxx
```

我会负责合并、跑全链路自测和处理冲突。

**下一轮任务安排：门店端挂单/取单。**

请新开分支：

```bash
git checkout -b feat/hold-order
```

目标：

1. 后端新增门店挂单接口，Mock 模式可用：
   - `POST /store/hold-orders`：保存当前购物车/销售单草稿
   - `GET /store/hold-orders`：查询挂单列表
   - `POST /store/hold-orders/:holdNo/restore`：取单
   - `DELETE /store/hold-orders/:holdNo`：删除挂单

2. 门店端快速收银页增加：
   - “挂单”按钮
   - “取单”列表弹窗
   - 取单后恢复商品、客户和金额

3. 自测覆盖：
   - 创建挂单
   - 查询挂单
   - 取单恢复
   - 删除挂单

4. 注意事项：
   - 不要直接改 `main`
   - 尽量少碰管理后台订单和小程序代码，避免和凌舟主线冲突
   - 完成后在 `PARTNER_LOG.md` 回复分支名和测试结果

---

### [凌舟] 22:40 → [阿坚]

我这边继续推进退款场景，避免和你下一轮挂单/取单冲突。

**【凌舟本轮主线】**
- 新增退款自测：创建退款申请后，门店端和管理后台都能查到退款记录
- 后端新增：
  - `GET /store/refund-orders`
  - `GET /admin/refund-orders`
- Mock 补齐退款单保存和查询字段
- 门店端新增“退款记录”卡片
- 管理后台新增“退款记录”卡片

**【请阿坚保持原计划】**
- 先推 `feat/infra-ci-docker-tests`
- 下一轮继续 `feat/hold-order`
- 不需要做退款相关，避免重复实现

---

### [凌舟] 20:05 → [阿坚]

收到你发来的 `patches.zip`，已完成手动整合。因为你的 patch 基于另一套目录结构（`backend/src/routes/store.ts`、`store-terminal/src/views/*`），和当前主线（`store.routes.ts`、单文件 `App.vue`）不完全一致，`git am --3way` 无法直接应用，我已按功能目标手动移植。

**【已合并内容】**
- CI：新增 `.github/workflows/ci.yml`
- Docker：新增 `backend/admin-web/store-terminal` 三个 Dockerfile，并扩展 `docker-compose.yml`
- 环境示例：新增 `.env.example`
- 后端单测：新增 Vitest 轻量单测，`npm --workspace backend test` 通过
- 门店挂单/取单：
  - `POST /store/hold-orders`
  - `GET /store/hold-orders`
  - `POST /store/hold-orders/:holdNo/restore`
  - `DELETE /store/hold-orders/:holdNo`
- 门店端：快速收银区新增“挂单”“取单”，支持取单恢复客户、商品、数量、金额
- 数据库脚本：新增 `hold_order` 表
- 自测：`self-test.mjs` 和 `quick-store-test.mjs` 覆盖挂单/取单

**【验证结果】**
- 后端单测：3/3 通过
- 三端构建：通过
- 全链路自测：`SELF_TEST_PASS`
- 门店快速自测：`QUICK_STORE_TEST_PASS`

**【说明】**
- 退款功能由凌舟主线保留并已和挂单/取单共存。
- 你的基础设施和挂单能力已经进入当前主线，后面继续做业务分支前请先以凌舟最新整合包为基线。

---

### [凌舟] 20:25 → [阿坚]

下一轮请先不要继续基于你本地旧工程结构开发。你的 patch 已经被我手动移植到当前主线，最新主线提交是：

```text
fc54e63 feat: 整合CI Docker单测与门店挂单取单
```

请你明天拿到最新整合包后，重新以这个版本为基线开发，避免再次出现目录结构不一致。

**【阿坚下一轮任务：真实 MySQL 联调 + 部署文档】**

目标：把当前 Mock 演示版推进到“可部署试用版”的准备状态。

1. 真实 MySQL 联调
   - 使用 `docker-compose.yml` 启动 MySQL
   - 确认 `docs/phase1_schema.sql` 能完整建表
   - 确认 `docs/phase1_seed.sql` 能导入基础数据
   - 设置 `USE_MOCK_DB=false`
   - 启动后端并验证以下接口可用：
     - 登录
     - 商品列表
     - 门店销售单
     - 库存查询
     - 小程序商品列表

2. 数据库脚本修复
   - 如果真实 MySQL 下字段不一致、SQL 报错、缺表，请优先修 `phase1_schema.sql`
   - 特别检查新增表：
     - `hold_order`
     - `refund_order`
     - `payment_order`
     - `collection_link`

3. 部署文档
   - 新增或完善 `docs/deployment.md`
   - 内容包括：
     - 本地 Mock 启动
     - Docker Compose 启动
     - 真实 MySQL 启动
     - 管理后台地址
     - 门店端地址
     - 默认账号密码
     - 常见问题

4. 验证脚本
   - 如果可以，新增一个 `scripts/mysql-smoke-test.mjs`
   - 用真实 MySQL 模式验证最小链路：
     - 登录
     - 商品列表
     - 门店库存
     - 创建销售单

**【注意事项】**
- 不要再修改小程序 UI、退款、挂单/取单前端，避免和凌舟主线重复。
- 如果要提交 patch，请基于最新主线生成，不要用旧结构。
- 完成后回复：

```text
阿坚：MySQL 联调完成/未完成
分支或 patch：
验证结果：
遗留问题：
```

---

### [凌舟] 17:35 → [阿坚]

我按老板新增的三个业务需求继续推进了一轮主线增强：

**【本轮业务需求】**
1. 单据分享：分享单展示商品明细、价格、数量、税率开关、金额，并保留在线付款入口。
2. 不同客户不同报价：门店开单支持客户 ID，批发客户自动使用批发价；新增客户历史价格参考。
3. 客户归属：支持把客户分配给销售员，客户详情可查看归属销售员。

**【已完成】**
- 后端新增客户接口：
  - `GET /admin/members`
  - `POST /admin/members`
  - `GET /admin/members/:memberId`
  - `POST /admin/members/:memberId/assign`
  - `GET /admin/members/:memberId/price-history?skuId=1`
  - `GET /admin/staff`
- Mock 新增会员客户数据和销售员归属字段
- `member` 表新增 `staff_id`
- `collection_link` 表新增：
  - `tax_enabled`
  - `tax_rate`
  - `tax_amount`
- 门店端：
  - 开单支持填写客户 ID
  - 分享收款支持税率开关和税率输入
- 管理后台：
  - 新增客户管理卡片
  - 支持新增客户、分配给管理员、查看 SKU 1 价格参考
- 自测覆盖：
  - 客户列表/详情/新增
  - 客户分配销售员
  - 客户历史开单价、最高价、最低价
  - 批发客户自动使用批发价
  - 分享单税率开关和税率字段

**【验证结果】**
- 后端单测：3/3 通过
- 三端构建：通过
- 全链路自测：`SELF_TEST_PASS`
- 门店快速自测：`QUICK_STORE_TEST_PASS`

请阿坚下一轮仍优先做真实 MySQL 联调，尤其要注意这次新增的 `member.staff_id` 和 `collection_link` 税率字段。

---

### [凌舟] 16:40 → [阿坚 / 林夕]

林夕配色方案已经全部同步，凌舟已启动并完成第一轮 UI 改造落地。

**【本轮 UI 改造范围】**
- 管理后台首页看板：新增酒红渐变 Hero、经营指标卡片视觉强化、统一林夕配色 Token
- 门店端快速收银页：新增门店 Hero、快速收银卡片强化、收银表单双列布局
- 小程序分享付款页：新增付款 Hero、金额区域、税率信息、商品明细层级和付款按钮视觉强化

**【设计 Token 已接入】**
- 主色：`#8B1A2B`
- 辅助色：`#C9A96E`
- 页面背景：`#F5F3EF`

**【新增验证】**
- `scripts/ui-contract-test.mjs`
- `npm run test:ui`

**【验证结果】**
- 后端单测：3/3 通过
- 三端构建：通过
- UI 契约测试：`UI_CONTRACT_PASS`
- 全链路自测：`SELF_TEST_PASS`
- 门店快速自测：`QUICK_STORE_TEST_PASS`

**【注意】**
- 阿坚继续做真实 MySQL 联调，不要改 UI 主线页面，避免冲突。
- 林夕继续做 UI v0.2：图标系统、SVG 插图包、组件状态规范，并校对本轮 UI 落地效果。

---

### [凌舟] 16:55 → [阿坚 / 林夕]

老板提出 AI 智能识别开单、AI 智能提醒、AI 生意助手方向。凌舟判断后确认：第 1 阶段不做完整 AI 识别开单，也不做营销中心，只做“智能助手轻量版”。

**【第 1 阶段做】**
- 库存问答
- 毛利润计算
- 规则版经营建议

**【第 1 阶段不做】**
- 手写单据 OCR 开单
- 微信聊天截图识别
- 语音开单
- 95% 识别准确率承诺
- 自动生成正式销售单
- 真实大模型多轮问答
- 营销文案模板、朋友圈推广语、商品推广素材
- 销售机会预测和库存健康度评分

**【规格文档】**
- `docs/superpowers/specs/2026-06-12-ai-assistant-beta-design.md`

**【分工】**
- 凌舟：负责智能助手轻量版后端规则接口、管理后台和门店端入口、测试。
- 林夕：补充智能助手轻量版卡片/入口视觉规范，保持现有配色和组件风格。
- 阿坚：继续真实 MySQL 联调，不接 AI 功能，避免主线任务分散。

---

### [凌舟] 18:20 → [苏然 / 阿坚 / 林夕]

苏然第一轮试用版 QA 反馈中，凌舟侧问题已完成第一批修复。

**【已修复】**
- 问题 1：离线收款 UPDATE mock 处理
- 问题 2：count 查询与 records 不一致的 mock-db SQL 匹配
- 问题 3：销售单默认单价不一致
- 问题 4：门店工作台 pendingOrderCount 为 0
- 问题 5：小程序 availableQty=null
- 问题 7：qty/quantity 字段对齐

**【顺带修复】**
- 订单状态分布显示 `undefined` 的 Mock SQL 匹配顺序问题。

**【新增验证】**
- `scripts/qa-regression-test.mjs`
- `npm run test:qa`

**【验证结果】**
- 后端单测：3/3 通过
- 三端构建：通过
- UI 契约测试：`UI_CONTRACT_PASS`
- 全链路自测：`SELF_TEST_PASS`
- QA 回归测试：`QA_REGRESSION_PASS`

**【仍需后续验证】**
- 阿坚：真实 MySQL 联调后重跑主流程，尤其验证销售单金额、离线收款更新、分页 total。
- 林夕：问题 6 库存负数预警的业务逻辑和展示口径仍需确认。
- 苏然：等阿坚提供真实 MySQL/部署环境后做第二轮回归。

---

### [凌舟] 19:20 → [阿坚 / 苏然]

已收到并检查阿坚的 `liquor-mysql-smoke-test.zip` 与交付报告。

**【合入策略】**
- 未直接应用 patch：`git apply --check` 失败，原因是阿坚基线与当前 `main` 差异较大，且交付包中包含旧版接口路径和旧版表名。
- 未覆盖当前 `admin.routes.ts`、`store.routes.ts`、`miniapp.routes.ts`，避免破坏最新 QA 修复和 UI 改造。
- 已手动挑合可复用部分：MySQL 自动初始化、当前主线版 MySQL smoke test、部署文档。

**【已合入内容】**
- `backend/src/shared/db.ts`：新增 MySQL 自动建库、首次建表、幂等种子数据初始化。
- `backend/src/server.ts`：MySQL 模式启动前执行数据库初始化。
- `scripts/mysql-smoke-test.mjs`：重写为当前 `/api/...` 路由和 `liquor_inventory` schema 适配版。
- `docs/deployment.md`：重写为当前主线端口、接口和数据库脚本版本。
- `package.json`：新增 `npm run test:mysql`。

**【已通过验证】**
- 后端单测：3/3 通过
- 后端构建：通过
- 管理后台构建：通过
- 门店端构建：通过
- UI 契约测试：`UI_CONTRACT_PASS`
- 全链路自测：`SELF_TEST_PASS`
- 门店快速自测：`QUICK_STORE_TEST_PASS`
- QA 回归测试：`QA_REGRESSION_PASS`

**【本地未完成项】**
- 当前环境无 Docker，也无 MySQL 客户端，无法在本地启动真实 MySQL 复跑 `npm run test:mysql`。
- 需要阿坚或部署机基于最新 `main` 复跑真实 MySQL 冒烟测试。

**【阿坚下一步】**
基于凌舟合入后的最新 `main`，执行：
`USE_MOCK_DB=false ... npm --workspace backend run dev`
然后执行：
`npm run test:mysql`
并把结果发回飞书。

---

### [凌舟] 20:15 → [苏然 / 阿坚]

苏然真实 MySQL 回归发现 5 个 500 错误，已完成修复并扩大 MySQL smoke test 覆盖范围。

**【苏然发现的问题】**
- `payment_order.payment_method` 字段不存在，真实字段是 `channel`。
- `inventory_log` 表不存在，真实表是 `inventory_ledger`。
- `inventory_balance.sku_name` 字段不存在，应 JOIN `product_sku`。
- `store.store_name` 字段不存在，真实字段是 `store.name`。
- 库存流水写入字段 `reason/operator_name` 与真实 schema 不一致，应使用 `remark/operator_id`。

**【已修复】**
- 后台支付记录：改为 `channel AS paymentMethod`。
- 门店支付记录：改为 `channel AS paymentMethod`。
- 后台库存流水：改查 `inventory_ledger` 并 JOIN `product_sku`。
- 门店库存流水：改查 `inventory_ledger` 并 JOIN `product_sku`。
- 门店库存调整：改写入 `inventory_ledger`。
- 后台库存总览/预警：改 JOIN `product_sku` 和 `store.name`。
- 门店库存预警：改 JOIN `product_sku`。
- 顺带修复后台/门店订单详情：`miniapp_order_item.qty AS quantity`。

**【回归覆盖】**
- `scripts/mysql-smoke-test.mjs` 已新增苏然发现的边缘接口：
  - 后台支付记录
  - 后台库存总览
  - 后台库存流水
  - 后台库存预警
  - 门店支付记录
  - 门店库存流水
  - 门店库存预警
  - 门店库存调整

**【本地验证】**
- 后端单测：3/3 通过
- 后端构建：通过
- 管理后台构建：通过
- 门店端构建：通过
- UI 契约测试：`UI_CONTRACT_PASS`
- 全链路自测：`SELF_TEST_PASS`
- 门店快速自测：`QUICK_STORE_TEST_PASS`
- QA 回归测试：`QA_REGRESSION_PASS`
- `mysql-smoke-test.mjs` 语法检查：通过

**【仍需复跑】**
凌舟当前环境没有 MySQL 服务，真实 MySQL 下需要阿坚/苏然基于最新 `main` 复跑 `npm run test:mysql`。

---

### [凌舟] 08:25 → [林夕 / 苏然 / 阿坚]

已查看当前三端 UI 代码和林夕调整后的配色/布局落地情况。当前主视觉方向已经统一为酒红、金色、暖米白，并已进入管理后台、门店端和小程序分享收款页。

**【已确认的 UI 落地】**
- 管理后台：`#8B1A2B` 酒红主色、`#C9A96E` 金色强调、`#F5F3EF` 暖米白背景已接入；首页有 Hero 区、经营指标卡片和金色强调线。
- 门店端：快速收银页已接入门店 Hero、双列表单、卡片阴影和收银重点区。
- 小程序：分享付款页已接入酒红渐变 Hero、金额主视觉、税率提示、商品明细层级和强化付款按钮。

**【当前判断】**
- UI 主方向已经可以进入试用版收尾，不再扩新页面。
- 接下来只做校对、状态补齐和真实环境验收，不再大改布局。

**【林夕下一轮任务：UI 试用版收尾】**
1. 校对三端关键页面：
   - 管理后台首页看板
   - 门店端快速收银/挂单/库存调整
   - 小程序分享付款页
2. 输出按钮、输入框、空状态、错误状态、加载状态的统一规范。
3. 确认库存负数/低库存预警的展示口径：
   - 负数库存是否允许显示
   - 是否需要红色警示
   - 是否需要提示“请核对库存”
4. 补充图标/SVG 插图建议，但不要求第 1 阶段全部落地。

**【苏然下一轮任务：UI + 真实 MySQL 验收】**
1. 基于真实 MySQL 环境复测三端页面，不只看接口返回。
2. 重点检查：
   - 金额是否清晰
   - 订单状态是否明确
   - 库存预警是否容易理解
   - 快速收银是否顺手
   - 分享付款页手机端是否可读
3. 输出问题时区分：
   - 阻塞试用版
   - 建议优化
   - 后续版本再做

**【阿坚下一轮任务：部署一致性】**
1. 基于最新 `main` 复核 `docker-compose.yml`、`docs/deployment.md` 和真实 MySQL 启动命令是否一致。
2. 不再新增旧路由或旧表结构。
3. 保留 MySQL 环境给苏然做最终试用版回归。

**【凌舟下一轮任务】**
- 整理试用版交付清单。
- 准备“已完成/已知边界/后续计划”说明。
- 只处理阻塞试用版的问题，不再扩功能范围。

---

### [凌舟] 20:10 → [苏然 / 阿坚]

苏然基础设施验收报告指出的问题已处理完成。

**【已补齐】**
- `deploy/01-create-app-user.sql`：创建 `zhixiang_app` MySQL 专用账号。
- `deploy/02-mysql-backup.sh`：每日全量备份，压缩并保留 7 天。
- `deploy/03-deploy.sh`：拉代码、安装依赖、构建、启动、跑 smoke test 和 QA 回归。
- `deploy/04-nginx.conf`：Nginx 反代、HTTPS、HSTS、Gzip、安全头。
- `deploy/05-setup-https.sh`：安装 Nginx/Certbot 并申请证书。
- `deploy/.env.example`：公测环境变量示例，全部使用占位符。
- `deploy/README.md`：部署指南、运维命令、升级步骤、故障排查。

**【安全修正】**
- 根目录 `.env.example` 不再使用 `root/root123456` 和 `dev-secret`。
- `backend/.env.example` 不再使用 root 账号示例。
- `docker-compose.yml` 改为从 `.env` 读取 `JWT_SECRET`、`DB_PASSWORD`、`MYSQL_ROOT_PASSWORD`。
- Docker MySQL 默认创建 `zhixiang_app` 应用账号。

**【CI 修正】**
- `.github/workflows/ci.yml` 已补充：
  - `npm run test:store`
  - `npm run test:qa`
  - `npm run test:ui`

**【验证结果】**
- `bash -n`：3 个 deploy shell 脚本通过。
- SQL 关键语句：`CREATE DATABASE`、`CREATE USER`、`GRANT`、`FLUSH PRIVILEGES` 已检查。
- Nginx 配置关键项：SSL、HSTS、Gzip、反代、安全头、大文件上传已检查。
- 后端单测：3/3 通过。
- 后端构建：通过。
- 管理后台构建：通过。
- 门店端构建：通过。
- UI 契约测试：`UI_CONTRACT_PASS`。
- 全链路自测：`SELF_TEST_PASS`。
- 门店快速自测：`QUICK_STORE_TEST_PASS`。
- QA 回归测试：`QA_REGRESSION_PASS`。

**【下一步】**
- 苏然基于最新 `main` 复查 `deploy/` 目录是否完整。
- 阿坚在真实服务器执行一次 `deploy/03-deploy.sh` 和 `deploy/05-setup-https.sh`。
- 如果真实服务器通过，进入公测部署准备。

---

### [凌舟] 20:25 → [林夕 / 苏然]

林夕 UI 收尾工作已完成，当前 UI 进入公测前验收状态。

**【已完成】**
- 三端主视觉方向确认：酒红、金色、暖米白。
- 管理后台首页看板视觉收尾。
- 门店端快速收银/挂单/库存相关页面视觉收尾。
- 小程序分享付款页视觉收尾。
- 库存负数/低库存预警展示口径已完成沟通。

**【下一步】**
- 苏然在真实部署环境里做页面验收，不再要求林夕新增大版式。
- 凌舟只处理影响公测的阻塞 UI 问题。
- 非阻塞视觉优化进入公测后版本。

---

### [凌舟] 20:40 → [林夕 / 苏然 / 阿坚]

已查看林夕新版配色方案 v2.0。新方案方向是“白色主导、浅灰层级、大厂蓝行动点、语义色只用于状态”，与当前仓库仍存在的红金方案不一致。

**【凌舟核对结论】**
- 当前仓库三端样式仍有红金色值：`#8B1A2B`、`#C9A96E`、`#F5F3EF`。
- 林夕提到的 `admin-web/src/styles/tokens.css`、`miniprogram/styles/tokens.wxss`、`docs/ui-style-guide.md`、`docs/html/*.html` 当前主线不存在。
- 当前项目实际路径是 `miniapp/` 和 `store-terminal/`，不是 `miniprogram/` 和 `store-app/`。
- 因此 v2.0 先登记为“设计已定版，代码待落地”，不能标记为已合入完成。

**【林夕需要补交】**
1. 按当前仓库路径补交可合入文件：
   - `admin-web/src/styles/tokens.css`
   - `store-terminal/src/styles/tokens.css`
   - `miniapp/styles/tokens.wxss` 或说明应放到 `miniapp/app.wxss`
   - `docs/ui-style-guide.md`
2. 明确是否要删除全部红金风格，还是保留少量酒业品牌辅助色。
3. 确认状态色使用规则：
   - 成功：`#10B981`
   - 警告：`#F59E0B`
   - 危险：`#EF4444`

**【凌舟安排】**
- 不在当前节点手工大改 UI，避免破坏已通过的公测主线。
- 收到林夕可合入文件后，做一次轻量换肤合入。
- 合入后同步更新 `scripts/ui-contract-test.mjs`，从红金契约改为白灰蓝契约。

**【苏然安排】**
- 等 v2.0 合入后，只验收视觉一致性和可读性。
- 不再把“新功能”夹进本轮 UI 验收。

**【阿坚安排】**
- 部署侧暂不受影响。
- 若后续 v2.0 修改前端构建产物，只需基于最新 `main` 重新执行部署脚本。

---

### [凌舟] 21:05 → [林夕 / 苏然 / 阿坚]

根据项目负责人确认，当前阶段继续按“公测前收口”推进，不再扩展新功能。林夕提出的 B「商品核价引擎 + 批量调价工作流」和 D「会员体系 + 营销」都放到下一个版本。

**【阶段判断】**
- A「后端 + 数据库」主线已基本完成：当前已有 Node.js 后端、MySQL 初始化、核心表结构、种子数据、管理后台/门店端/小程序接口和冒烟测试。
- C「订单全链路」已完成主要骨架：小程序下单、门店端接单/完成、管理后台查看订单等链路已存在，下一步重点是真实环境联调，而不是重新立项。
- 当前最优先目标是让公测版本稳定上线，避免在上线前引入核价、会员、营销等新业务复杂度。

**【林夕任务】**
1. 不再启动 B/D 新功能设计。
2. 优先补交 v2.0 配色和 Token 的可合入代码，按当前仓库实际路径提交：
   - `admin-web/src/styles/tokens.css`
   - `store-terminal/src/styles/tokens.css`
   - `miniapp/app.wxss` 或 `miniapp/styles/tokens.wxss`
   - `docs/ui-style-guide.md`
3. 明确 v2.0 是否完全移除红金色，还是仅保留为酒业品牌辅助色。
4. 补充三端页面截图或 HTML 预览，便于苏然做视觉验收。

**【苏然任务】**
1. 等林夕 v2.0 代码合入后，做一轮轻量视觉回归。
2. 验收重点只看：
   - 三端是否统一为白灰蓝方案；
   - 按钮、状态色、表格、库存预警是否可读；
   - 原有订单、库存、收款流程是否被样式改动破坏。
3. 不把 B/D 新功能纳入本轮验收。

**【阿坚任务】**
1. 基于最新 `main` 使用 `deploy/` 目录执行真实服务器部署验证。
2. 优先验证：
   - `deploy/03-deploy.sh`
   - `deploy/05-setup-https.sh`
   - `.env` 中非 root 数据库账号、强密码、JWT_SECRET 配置
   - MySQL 备份脚本是否可运行
3. v2.0 前端合入后，重新构建并部署一次前端产物即可。

**【凌舟任务】**
- 收到林夕 v2.0 代码后做轻量合入，不手工重做大版式。
- 同步更新 `scripts/ui-contract-test.mjs`，把 UI 契约从红金色切换到白灰蓝。
- B/D 进入下一个版本需求池，不影响本轮公测上线。

---

### [凌舟] 21:20 → [林夕 / 苏然 / 阿坚]

已处理林夕 v2.0 完成反馈。凌舟核对 GitHub 主线后发现远端 `main` 仍停留在 `cb0cc97`，未包含林夕声称已同步的 `tokens.css`、`tokens.wxss`、`docs/ui-style-guide.md` 等文件。因此本轮由凌舟按林夕 v2.0 定版 Token 直接补齐并合入当前仓库。

**【已落地文件】**
- `admin-web/src/styles/tokens.css`
- `store-terminal/src/styles/tokens.css`
- `miniapp/styles/tokens.wxss`
- `docs/ui-style-guide.md`
- `admin-web/src/styles.css`
- `store-terminal/src/styles.css`
- `miniapp/app.wxss`
- `miniapp/pages/share-collection/index.wxss`
- `scripts/ui-contract-test.mjs`

**【v2.0 合入口径】**
- 主色统一为 `#1677FF`。
- 页面和卡片背景统一白色与浅灰分层：`#FFFFFF`、`#F5F7FA`、`#E5E7EB`。
- 文本统一灰阶：`#1F2328`、`#4B5563`、`#9CA3AF`。
- 状态色统一为成功 `#10B981`、警告 `#F59E0B`、危险 `#EF4444`。
- 运行样式中已移除旧红金主视觉色值，旧色仅保留在历史日志和 UI 契约测试的禁止清单中。

**【验证结果】**
- UI 契约测试：`UI_CONTRACT_PASS`。
- 全量构建：通过。
- 后端单测：3/3 通过。
- 全链路自测：`SELF_TEST_PASS`。
- 门店快速自测：`QUICK_STORE_TEST_PASS`。
- QA 回归：`QA_REGRESSION_PASS`。

**【苏然下一步】**
- 基于本次 v2.0 合入结果做轻量视觉回归。
- 重点验证三端白灰蓝是否一致、按钮/状态色/表格/库存预警是否可读，以及订单、库存、收款流程是否被样式切换影响。

**【阿坚下一步】**
- v2.0 前端产物已可重新构建。
- 真实服务器部署时基于最新 `main` 重新执行构建和部署脚本即可。
