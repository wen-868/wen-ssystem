# 设计稿 5/5：工作台首页

## 页面布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  侧边栏 (220px)  │  主内容区                                                  │
│                  │  ─────────────────────────────────────────────────────┐  │
│  ● 工作台        │  │  早上好，管理员                     [门店选择 ▼]   │  │
│    订单管理      │  │  2026年6月21日 星期日                   [刷新数据]   │  │
│    商品中心      │  ─────────────────────────────────────────────────────┘  │
│    客户管理      │                                                             │
│    库存管理      │  ──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│    财务报表      │  │  今日销售额    │ │  今日订单数    │ │  待处理订单    │     │
│    系统设置      │  │              │ │              │ │              │     │
│                  │  │  ¥12,580.00  │ │     28       │ │      12      │     │
│                  │  │              │ │              │ │              │     │
│                  │  │  ↑ 12.5% 昨日│ │  ↑ 8.3% 昨日 │ │  ↓ 3 较昨日  │     │
│                  │  └──────────────┘ └──────────────┘ └──────────────┘     │
│                  │                                                             │
│                  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│                  │  │  本月销售额    │ │  本月订单数    │ │  库存预警      │     │
│                  │  │              │ │              │ │              │     │
│                  │  │ ¥285,600.00  │ │    356       │ │      5       │     │
│                  │  │              │ │              │ │              │     │
│                  │  │  ↑ 15.2% 上月│ │  ↑ 10.1% 上月│ │  ⚠ 3项紧急   │     │
│                  │  └──────────────┘ └──────────────┘ └──────────────┘     │
│                  │                                                             │
│                  │  ┌──────────────────────────┐  ┌──────────────────────┐  │
│                  │  │  待办事项 (8)             │  │  快捷入口             │  │
│                  │  │                          │  │                      │  │
│                  │  │  🔴 12笔订单待付款        │  │  [📦 快速开单]       │  │
│                  │  │     最早: 06-20 16:30    │  │                      │  │
│                  │  │     [立即处理 →]         │  │  [📋 订单列表]       │  │
│                  │  │  ──────────────────────  │  │                      │  │
│                  │  │  🟡 8笔订单待配送         │  │  [📊 数据报表]       │  │
│                  │  │     最早: 06-21 09:00    │  │                      │  │
│                  │  │     [立即处理 →]         │  │  [🏪 门店管理]       │  │
│                  │  │  ──────────────────────  │  │                      │  │
│                  │  │   5笔订单配送中         │  │  [👥 客户管理]       │  │
│                  │  │     预计今日送达: 3笔    │  │                      │  │
│                  │  │     [查看物流 →]         │  │  [📁 库存管理]       │  │
│                  │  │  ──────────────────────  │  │                      │  │
│                  │  │  ⚠️ 3项库存预警           │  │  [️ 系统设置]       │  │
│                  │  │     茅台飞天 库存:2      │  │                      │  │
│                  │  │     剑南春 库存:0        │  │                      │  │
│                  │  │     [立即补货 →]         │  │                      │  │
│                  │  │  ──────────────────────  │  │                      │  │
│                  │  │   2笔应收账款到期       │  │                      │  │
│                  │  │     张三丰 ¥50,000       │  │                      │  │
│                  │  │     到期: 06-25          │  │                      │  │
│                  │  │     [立即催收 →]         │  │                      │  │
│                  │  └──────────────────────────┘  └──────────────────────┘  │
│                  │                                                             │
│                  │  ┌──────────────────────────────────────────────────┐    │
│                  │  │  销售趋势 (近7日)                                  │    │
│                  │  │                                                   │    │
│                  │  │     ¥15k ┤                              ╭──╮     │    │
│                  │  │     ¥12k ┤                    ╭──╮      │  │     │    │
│                  │  │      ¥9k ┤          ╭──      │  │  ╭──  ╰╮   │    │
│                  │  │      ¥6k ┤    ╭──╮  │  │  ╭──╯  ╰──╯       ╰─  │    │
│                  │  │      ¥3k ┤ ──╯  ╰──╯  ╰──╯                    │    │
│                  │  │        0 ┤──┴────┴────┴────┴────┴────┴────     │    │
│                  │  │           06-15 06-16 06-17 06-18 06-19 06-20 06-21 │    │
│                  │  │                                                   │    │
│                  │  │  柱状: 订单数  折线: 销售额                        │    │
│                  │  └──────────────────────────────────────────────────┘    │
│                  │                                                             │
│                  │  ┌────────────────────────────┐ ┌─────────────────────┐  │
│                  │  │  热销商品 TOP5               │ │  最近订单            │  │
│                  │  │                            │ │                     │  │
│                  │  │  1. 茅台飞天 53°   128瓶   │ │  MP26062100001      │  │
│                  │  │     ████████████ ¥163,840  │ │  张三丰  ¥9,300     │  │
│                  │  │  2. 五粮液普五 52°  96瓶   │ │  [待配送]  14:30    │  │
│                  │  │     ██████████   ¥86,304   │ │  ─────────────────  │  │
│                  │  │  3. 剑南春水晶剑    72瓶   │ │  MP26062100002      │  │
│                  │  │     ████████     ¥33,048   │ │  李四  ¥2,560       │  │
│                  │  │  4. 泸州老窖特曲    48瓶   │ │  [已完成]  13:15    │  │
│                  │  │     ██████       ¥14,352   │ │  ─────────────────  │  │
│                  │  │  5. 汾酒青花20      36瓶   │ │  MP26062100003      │  │
│                  │  │     ████         ¥10,764   │ │  王五  ¥1,377       │  │
│                  │  │                            │ │  [配送中]  11:20    │  │
│                  │  └──────────────────────────── └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 组件详细设计

### A. 页面头部 (`.dashboard-hero`)

```
背景: linear-gradient(90deg, var(--color-primary) 0 6px, transparent 6px),
      linear-gradient(180deg, var(--bg-card), var(--bg-soft))
圆角: var(--radius-lg)
内边距: 24px 28px
margin-bottom: 20px
box-shadow: var(--shadow-card)

左侧:
  - 问候语: "早上好，管理员" (var(--text-page-title), 600)
    · 时段判断:
      06:00-12:00 → "早上好"
      12:00-18:00 → "下午好"
      18:00-24:00 → "晚上好"
  - 日期: "2026年6月21日 星期日" (var(--text-caption), var(--text-muted))

右侧:
  - [门店选择] 下拉: el-select (width=160px, 默认"全部门店")
  - [刷新数据] 按钮: type=default, size=small, icon=Refresh
```

### B. 数据卡片 (6个, 2行 x 3列)

**第一行 - 今日数据**

| 卡片 | 数据源 API | 数值格式 | 对比 |
|------|-----------|---------|------|
| 今日销售额 | `fetchDashboardOverview().todaySales` | ¥X,XXX.XX (var(--text-amount-lg), 700) | 较昨日 ↑/↓ X% |
| 今日订单数 | `fetchDashboardOverview().todayOrders` | 整数 | 较昨日 ↑/↓ X |
| 待处理订单 | `fetchDashboardOverview().pendingOrders` | 整数 | 较昨日 ↑/↓ X |

**第二行 - 本月数据**

| 卡片 | 数据源 API | 数值格式 | 对比 |
|------|-----------|---------|------|
| 本月销售额 | `fetchDashboardOverview().monthSales` | ¥XXX,XXX.XX | 较上月 ↑/↓ X% |
| 本月订单数 | `fetchDashboardOverview().monthOrders` | 整数 | 较上月 ↑/↓ X% |
| 库存预警 | `fetchInventoryAlerts()` | 整数 | ⚠ X项紧急 |

**卡片样式** (`.dash-card`)

```
背景: var(--bg-card)
边框: 1px solid var(--border-normal)
圆角: var(--radius-md)
内边距: var(--space-card-padding)
box-shadow: var(--shadow-card)
hover: box-shadow 增强

结构:
  - 顶部色条: ::before (36px × 3px, border-radius=999px)
    · 销售额: var(--color-primary)
    · 订单数: #6366F1 (indigo)
    · 待处理: var(--color-warning)
    · 库存预警: var(--color-danger)
  - 标签行: flex, space-between
    · 标签: var(--text-caption), var(--text-muted)
    · 变化徽章: 12px, 600, padding=2px 8px, border-radius=4px
      - 上升: bg=#E6F9F1, color=#10B981
      - 下降: bg=#FEF0F0, color=#EF4444
  - 数值: var(--text-amount-lg), 700, var(--color-primary)
  - 描述: var(--text-hint), var(--text-muted)

点击交互:
  - 今日销售额 → 跳转报表页 (日期=今天)
  - 今日订单数 → 跳转订单列表 (筛选=今天)
  - 待处理订单 → 跳转订单看板
  - 库存预警 → 跳转库存预警页
```

### C. 待办事项 (`.todo-panel`)

```
容器: .card (bg=var(--bg-card), border=1px solid var(--border-normal), radius=var(--radius-md), shadow=var(--shadow-card))
宽度: 60% (与快捷入口 40% 并排)
内边距: 20px 24px

标题行:
  - "待办事项" (14px, 600, var(--text-primary))
  - 数量徽章: 圆形, 20x20, bg=var(--color-primary), text=white, 12px, 600

待办项 (每项):
  - 高度: 56px
  - 布局: flex, space-between, center
  - 左侧:
    · 优先级图标:
      - 🔴 紧急 (var(--color-danger))
      - 🟡 重要 (var(--color-warning))
      - 🟠 一般 (var(--color-primary))
      - ⚠️ 警告 (var(--color-warning))
      - 💰 财务 (var(--color-success))
    · 标题: 14px, 500, var(--text-primary)
    · 副标题: 12px, var(--text-muted)
  - 右侧:
    · [立即处理 →] 链接按钮: 13px, var(--color-primary), text-decoration=none
    · hover: text-decoration=underline

分隔线: 1px solid var(--border-normal) (每项之间)

待办类型:
  1. 待付款订单: 数量 + 最早时间 + [立即处理 →] → 跳转订单列表(待付款)
  2. 待配送订单: 数量 + 最早时间 + [立即处理 →] → 跳转订单看板(待配送)
  3. 配送中订单: 数量 + 今日送达预估 + [查看物流 →] → 跳转订单列表(配送中)
  4. 库存预警: 数量 + 紧急商品名 + [立即补货 →] → 跳转库存预警页
  5. 应收到期: 数量 + 客户名+金额+到期日 + [立即催收 →] → 跳转应收账款页
```

### D. 快捷入口 (`.quick-entry-panel`)

```
容器: .card (同待办事项样式)
宽度: 40%
内边距: 20px 24px

标题: "快捷入口" (14px, 600, margin-bottom=16px)

按钮网格: 2列 x 4行
  - 每个按钮:
    · 高度: 48px
    · 圆角: var(--radius-md)
    · 背景: var(--bg-soft)
    · 边框: 1px solid var(--border-normal)
    · 布局: flex, center, gap=8px
    · 图标: 20x20 emoji 或 icon font
    · 文字: 14px, 500, var(--text-primary)
    · hover: bg=var(--color-primary-soft), border=var(--color-primary), color=var(--color-primary)
    · active: bg=var(--color-primary), color=white

入口列表:
  1. 📦 快速开单 → /create-sale
  2. 📋 订单列表 → /orders
  3. 📊 数据报表 → /reports
  4. 🏪 门店管理 → /stores
  5. 👥 客户管理 → /customers
  6.  库存管理 → /inventory
  7. 📦 采购管理 → /purchase
  8. ⚙️ 系统设置 → /settings
```

### E. 销售趋势图 (`.sales-trend-chart`)

```
容器: .card (全宽)
内边距: 20px 24px

标题行:
  - "销售趋势" (14px, 600)
  - 时间范围切换: [近7日] [近30日] [本月] (el-radio-group, button style)

图表:
  - 类型: 组合图 (柱状 + 折线)
  - X轴: 日期
  - 左Y轴: 销售额 (¥)
  - 右Y轴: 订单数 (整数)
  - 柱状: 订单数, bg=var(--color-primary-soft), border=var(--color-primary)
  - 折线: 销售额, color=var(--color-primary), smooth=true
  - tooltip: 显示日期 + 销售额 + 订单数

数据源:
  - `fetchDashboardSalesTrend()` → { date, salesAmount, orderCount }[]
```

### F. 热销商品 TOP5 (`.top-products-panel`)

```
容器: .card
宽度: 50% (与最近订单并排)
内边距: 20px 24px

标题: "热销商品 TOP5" (14px, 600, margin-bottom=16px)

每项:
  - 高度: 44px
  - 布局: flex, align-items=center
  - 排名: 24px 宽, 14px, 700
    · 1-3名: 金色 #D4A574
    · 4-5名: var(--text-muted)
  - 商品名: flex=1, 14px, 500, 单行省略
  - 销量: 100px, 右对齐, 13px, var(--text-secondary)
  - 进度条: 120px, 高度=6px, bg=var(--bg-soft), 填充=var(--color-primary)
    · 宽度 = (当前销量 / 第一名销量) × 100%
  - 销售额: 100px, 右对齐, 13px, 600, var(--color-primary)

数据源: `fetchDashboardTopProducts()` → { skuName, totalQty, totalAmount }[]
```

### G. 最近订单 (`.recent-orders-panel`)

```
容器: .card
宽度: 50%
内边距: 20px 24px

标题行:
  - "最近订单" (14px, 600)
  - [查看全部 →] 链接: 13px, var(--color-primary)

每项:
  - 高度: 48px
  - 布局: flex, space-between, center
  - 左侧:
    · 订单号: 13px, 500, var(--color-primary), cursor=pointer
    · 客户名: 13px, var(--text-secondary)
  - 右侧:
    · 金额: 13px, 600, var(--text-primary)
    · 状态标签: .status-tag
    · 时间: 12px, var(--text-muted)

分隔线: 1px solid var(--border-normal)

数据源: `fetchOrders({ page: 1, pageSize: 5 })` → records
点击订单号 → 跳转订单详情页
```

## 布局规格

```
整体布局:
  - 侧边栏: 220px (固定)
  - 主内容区: flex=1, padding=var(--space-page-padding)

主内容区网格:
  - 数据卡片行: grid, 3列, gap=var(--space-card-gap)
  - 待办 + 快捷入口: grid, 60%/40%, gap=var(--space-card-gap)
  - 销售趋势: 全宽
  - 热销 + 最近订单: grid, 50%/50%, gap=var(--space-card-gap)

响应式:
  - ≤ 1200px: 数据卡片 2列, 待办/快捷入口 上下堆叠, 热销/最近订单 上下堆叠
  - ≤ 768px: 数据卡片 1列, 侧边栏折叠为抽屉
```

## 数据加载策略

```
1. 页面加载时并行请求:
   - fetchDashboardOverview() → 数据卡片
   - fetchInventoryAlerts() → 库存预警数
   - fetchDashboardSalesTrend() → 销售趋势图
   - fetchDashboardTopProducts() → 热销商品
   - fetchOrders({ page: 1, pageSize: 5 }) → 最近订单
   - fetchDashboardRecentAlerts() → 待办事项

2. 加载状态:
   - 卡片: skeleton 骨架屏
   - 图表: loading spinner
   - 列表: skeleton 行

3. 刷新:
   - 手动: 点击 [刷新数据] 按钮
   - 自动: 可选, 每60秒 (默认关闭)
```
