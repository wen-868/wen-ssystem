# 阿澈 · 销售管理模块 · 商户移动端

**日期**：2026-06-29
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | H5 支付页面 | P0⭐⭐ | ❌ |
| 2 | 分享链接管理 | P0 | ❌ |
| 3 | 销售报表 | P1 | ❌ |
| 4 | 收银台班结优化 | P1 | ❌ |

---

## 详细说明

### 1. H5 支付页面
- **文件**：新建 `merchant-mobile/src/views/SharePaymentView.vue`
- **路由**：`/share/payment/:token`（无需登录，客户通过分享链接打开）
- **功能**：
  - 页面加载时通过 token 获取链接详情（商品明细、金额、客户信息、过期时间）
  - 顶部：商家名称 + 门店名称
  - 中部：商品明细列表（商品名称/规格/数量/单价/小计）
  - 底部：金额汇总（商品金额/优惠/合计）+ 微信支付按钮
  - 过期/已支付/已撤销状态的对应展示
  - 倒计时：距链接过期剩余时间
  - 支付成功后跳转结果页
- **API**：`fetchCollectionLinkByToken`、`payCollectionByToken`
- **样式**：移动端优先，简洁清晰，突出支付按钮

### 2. 分享链接管理
- **文件**：修改 `merchant-mobile/src/views/SaleBillsView.vue`
- **功能**：
  - 销售单详情弹窗新增"生成收款链接"按钮（含金额输入）
  - 生成后可一键复制分享链接
  - 分享渠道选择（微信/复制链接）
  - 链接状态展示（已生成/已支付/已过期）
- **API**：`createCollectionLink`（复用现有）

### 3. 销售报表
- **文件**：新建 `merchant-mobile/src/views/SalesReportsView.vue`
- **路由**：`/reports/sales`
- **功能**：
  - 顶部：日期选择器 + 门店切换（如有权限）
  - 数据卡片：今日销售额/本月销售额/订单数/客单价
  - 销售趋势：7日/30日折线图（使用 Vant + ECharts 或简单Canvas）
  - 商品排行：Top 10 商品销量/销售额列表
  - 人员排名：销售额排名列表（如有权限）
- **API**：`fetchSalesTrend`、`fetchProductRanking`、`fetchSalesRanking`

### 4. 收银台班结优化
- **文件**：修改 `merchant-mobile/src/views/CreateSaleView.vue` + 新建 `merchant-mobile/src/views/ShiftSettlement.vue`
- **功能**：
  - 收银台顶部新增"班结"按钮
  - 班结页面（ShiftSettlement.vue）：
    - 当前班次信息（开始时间/已营业时长）
    - 收款汇总：现金/微信/其他，各渠道金额
    - 订单汇总：总订单数/现金订单/赊销订单/退货订单
    - 差异核对：系统金额 vs 实际金额
    - 班结确认：输入实际金额，系统计算差异，提交班结
  - 班结后自动打印班结小票（或生成班结记录）
- **API**：`fetchShiftSummary`、`submitShiftSettlement`、`fetchShiftHistory`
- **路由**：`/shift/settlement`