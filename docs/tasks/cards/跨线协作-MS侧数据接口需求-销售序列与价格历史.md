# 跨线协作需求单：MS 侧数据接口（支撑 AI 销售预测与价格走势）

> 提出方：凌舟（AI 底座线）｜2026-10-15
> 依据：业主原则「要分清是哪一端应该去做的工作，就安排给哪一边去做」
> 背景：AI 底座要做**销售预测**与**价格走势分析**（业主点名的数据链路重点），
>       但两项的**数据都在管理系统**（业务真源），AI 侧不应自建数据表 ⇒ 需 MS 侧提供接口。
> 协作模式：同 S3-181-C 跨线缺陷模式（MS 仓提单、MS 线实施）

---

## 需求 1：按商品/SKU 的销售时间序列接口（支撑销售预测）

### 为什么需要
- 现有 `api_get_sales_trend` 入参只有 `period / start / end` ⇒ **只能出整体趋势**
- 销售预测需要**按商品/SKU/品类/客户**的时间序列（否则只能预测大盘，业务价值低）

### 建议契约
```
GET /api/store/... （由 MS 定路径）
入参：
  - dimension: product | sku | category | customer
  - targetId: number
  - granularity: day | week | month（默认 month）
  - start: YYYY-MM-DD
  - end: YYYY-MM-DD
出参（按期序列）：
  [{ period: '2026-09', qty: 120, amount: 96000, orderCount: 34 }]
```
### 验收
- 按指定商品能返回近 12 期序列
- 数据与实际销售单一致（可用 `querySaleBills` 交叉验证）

---

## 需求 2：价格历史记录 + 查询接口（支撑价格走势分析）

### 为什么需要
- 现有价格能力**只有写**：`updateProductPrice`（改价）
- **无任何价格读接口 / 无调价历史** ⇒ 价格走势分析**完全无法做**（无数据可依）

### 建议实现（两部分）
**① 调价时落历史记录**
- 触发点：任何改价成功执行后（含 MS 后台改价、AI 改价）
- 记录字段：`sku_id / price_level（零售/批发/门店/进价/小程序）/ old_price / new_price / changed_at / operator / source（admin|ai）`

**② 价格时间序列查询接口**
```
入参：skuId、priceLevel（可选，不传则返回全部等级）、start、end
出参：[{ date, priceLevel, price }]
```

### 验收
- 改价后历史表有记录（含旧值/新值/时间/来源）
- 查询接口按 SKU 能返回价格时间序列

---

## 影响与优先级

| 项 | 说明 |
|---|---|
| 阻塞关系 | **MS 侧接口先行**（AI 侧工具依赖）；接口契约确定后 AI 侧可并行开发（按契约 mock）|
| AI 侧承诺 | 接口就位后 ≈ 1.5 人日完成两个工具（预测 + 走势）|
| 业务价值 | 直接支撑业主点名的「销售预测 + 价格走势」，并衔接到「定价建议闭环」（走势+毛利 ⇒ 建议 ⇒ 用户确认 ⇒ 改价，过写全审核）|

---

## 备注（避免越界）
AI 侧**不会**自建价格表或销售明细表 —— 按「哪一端数据归哪一端」原则，
业务真源始终在管理系统，AI 只做**消费 + 分析 + 自然语言结论**。

---

## 补充需求（2026-10-15 凌舟追加）：demo 租户基础数据缺失，阻塞真实验收

### 现象（生产实测，证据在案）
- `api_query_inventory` ⇒ `{"total":0,"records":[]}`（demo 租户无商品）
- AI 对话链路："系统里目前没有商品信息"
- 连锁影响：`createProduct` 必失败（"系统中暂无商品分类"）⇒ **开单闭环走不通**
- 影响我方验收：销售预测 / 价格走势两个新工具的**真数据实测无法进行**
  （我尝试用 demo 跑真实字段解析，但无 SKU 可查）

### 建议（MS 侧，可选其一）
1. 为 demo 租户补**基础数据种子**：商品分类 → 若干商品/SKU → 库存 → 1~2 张历史销售单
   （用于演示、E2E 验收、AI 新功能的真数据验证）
2. 或提供一个**含基础数据的测试租户凭据**（AI 侧用于真实数据实测）

### 备注
这不是 MS 代码缺陷（接口都正常），是**演示环境的数据准备**问题；
但它是当前阻塞"核心业务闭环演示 + AI 新功能真实验收"的最高优先级项。

---

## 补充需求 2（2026-10-15 凌舟，源自 R101-AI-34 P1-3 探活）：销售单取消端点缺失

### 探活结论（AI 侧查 MS 仓路由，证据链）
- `routes/store-sale-bill.routes.ts` 全部端点：GET/POST sale-bills、overdue、:billNo 详情、
  collection-link、offline-payment、payment、pay-by-code、payment/channels —— **无 cancel/void/revoke**
- 唯一 "revoke" 是 `revokeCollectionLink`（撤销**收款链接**，非销售单取消）
- 现有 `POST /api/admin/orders/:orderNo/cancel` 只覆盖 **ORD 即时零售订单**，不覆盖 SO/SB 销售单
⇒ 能力矩阵「P04 取消销售单」这一格**仍缺**；AI 侧未硬造工具（不猜路径、不硬适配）

### 建议契约（措辞可直接用）
```
POST /api/admin/sale-bills/:billNo/cancel
语义：销售单作废/冲销（非删除）
入参（建议）：{ reason?: string, source?: 'ai'|'admin' }   ← 与已交付的 P0-3 同口径（AI 发起须可追溯）
要求：
  1. 仅允许特定状态作废（如 UNPAID/PARTIAL_PAID；已结清/已开票需明确策略）
  2. 原子性：作废 + 库存回滚 + 应收/提成调整在同一事务
  3. 幂等：重复取消返回既有结果（不二次回滚库存）—— 便于 AI 侧走幂等闸门
  4. 权限：requirePermission('sale:cancel')；带租户隔离
  5. 出参：{ billNo, status:'CANCELLED', reversedStock:boolean, ... }
  6. 错误：字段级 errors（AI 侧 R101-AI-27 已支持透传）
```
AI 侧已就绪（端点到位后一步可做）：`cancelSalesOrder`（写工具、preview→confirm 只经确认通道、反测含 mutation）。
