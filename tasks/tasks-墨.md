# 墨 · 即时零售模块 · 管理后台

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | InstantRetailConfig - 店铺配置+装修 | P0 | :x: |
| 2 | InstantRetailShelf - 商品货架管理 | P0 | :x: |
| 3 | InstantRetailOrders - 订单管理 | P0 | :x: |
| 4 | InstantRetailPlatform - 平台对接配置 | P0 | :x: |
| 5 | InstantRetailOrderBoard - 60秒接单看板 | P0 | :x: |
| 6 | InstantRetailReport - 零售经营分析 | P1 | :x: |

---

## 详细说明

### 1. InstantRetailConfig - 店铺配置+装修
- **文件**：`admin-web/src/views/InstantRetailConfig.vue`
- **关键字段**：shopName/shopLogo/shopDescription/contactPhone/businessHours/deliveryEnabled/pickupEnabled/minOrderAmount/deliveryFee/freeDeliveryAmount/deliveryRadius/estimatedDeliveryTime/announcement + 轮播图管理（bannerTitle/bannerImage/linkType/linkValue/sortOrder/startTime/endTime/status）+ 分类管理（categoryName/categoryIcon/parentId/sortOrder/status）
- **说明**：实现即时零售店铺配置页面，包含三个Tab：店铺信息（表单布局：店铺名称+Logo上传+描述+联系电话+营业时间，配送设置：配送开关+自提开关+最低起送金额+配送费+免配送费门槛+配送半径+预计配送时间，公告编辑区）、轮播图管理（卡片列表+拖拽排序+新增/编辑弹窗含标题/图片上传/链接类型下拉/链接值/时间段选择器/状态开关）、分类管理（树形表格+新增/编辑弹窗含分类名称/图标/上级分类/排序/状态）。所有操作调用 `api.ts` 中已有的 `/admin/instant-retail/configs` 和 `/admin/instant-retail/shelf` 系列接口。扩展现有占位文件 `InstantRetailConfig.vue`。

### 2. InstantRetailShelf - 商品货架管理
- **文件**：`admin-web/src/views/InstantRetailShelf.vue`
- **关键字段**：分类树筛选（categoryId）、商品表格（productName/skuCode/retailPrice/originalPrice/stock/salesCount/isRecommended/isHot/isNew/sortOrder/status）、批量操作（批量上下架/批量改价/批量修改分类/批量设置推荐/热销/新品标签）
- **说明**：实现商品货架管理页面，左侧分类树（从 `retail_category` 接口加载，点击筛选），右侧商品表格（分页列表，列：商品图片+名称+SKU编码+零售价+原价+库存+销量+推荐/热销/新品标签+排序+状态+操作），顶部操作栏（搜索框+分类筛选+状态筛选+添加商品按钮+批量操作按钮组），添加商品弹窗（从 `product_sku` 表选择商品+设置零售价+原价+库存+分类+标签+排序），编辑弹窗（修改价格/库存/标签/排序）。批量操作：选中多行后下拉菜单选择批量上架/下架/改价/修改分类/设置标签。扩展现有占位文件 `InstantRetailShelf.vue`。

### 3. InstantRetailOrders - 订单管理
- **文件**：`admin-web/src/views/InstantRetailOrders.vue`
- **关键字段**：订单筛选（orderStatus/paymentStatus/startDate/endDate/keyword）、订单表格（orderNo/userName/userPhone/totalAmount/discountAmount/deliveryFee/payAmount/deliveryType/paymentStatus/orderStatus/createdAt）、详情抽屉（订单基本信息+商品明细列表+支付信息+配送信息+操作日志）、状态流转操作（确认/取消/退款/完成）
- **说明**：实现即时零售订单管理页面，顶部筛选栏（订单状态下拉：PENDING/CONFIRMED/PREPARING/DELIVERING/COMPLETED/CANCELLED，支付状态下拉：UNPAID/PAID/REFUNDED，日期范围选择器，订单号搜索），订单表格（分页列表，列：订单号+用户+金额+优惠+配送费+实付+配送方式+支付状态+订单状态+时间+操作），行操作（确认接单/取消订单/标记完成/退款），详情抽屉（左侧：订单基本信息+收货信息+备注，右侧：商品明细表格含商品图/名称/单价/数量/小计，底部：支付信息+操作日志时间线）。订单状态流转需校验：PENDING->CONFIRMED->PREPARING->DELIVERING->COMPLETED，CANCELLED需填写取消原因。扩展现有占位文件 `InstantRetailOrders.vue`。

### 4. InstantRetailPlatform - 平台对接配置
- **文件**：`admin-web/src/views/InstantRetailPlatform.vue`
- **关键字段**：3个Tab（京东/美团/饿了么）、密钥配置表单（appKey/appSecret/merchantId/storeId/enabled/configJson）、连接测试（状态指示灯+测试结果）、Webhook地址展示、手动同步（同步订单/同步商品按钮+同步日志）
- **说明**：实现平台对接配置页面，顶部3个Tab（京东秒送/美团外卖/饿了么，带平台icon和连接状态指示灯：绿=已连接/红=连接失败/灰=未配置），每个Tab下：密钥配置表单（appKey输入框+appSecret密码框带显示/隐藏切换+merchantId输入框+storeId选择器+启用开关+configJson高级配置JSON编辑器），操作按钮（保存配置+测试连接），连接状态区（测试结果提示+最后连接时间+token过期时间），Webhook配置区（回调URL只读展示+复制按钮+验签说明），同步操作区（手动同步订单按钮+手动同步商品按钮+最近同步时间+同步日志列表）。调用 `api.ts` 中已有的 `/admin/instant-retail/platform/config` 系列接口。扩展现有占位文件 `InstantRetailPlatform.vue`。

### 5. InstantRetailOrderBoard - 60秒接单看板
- **文件**：`admin-web/src/views/InstantRetailOrderBoard.vue`
- **关键字段**：新订单倒计时（60秒倒计时+颜色渐变绿->黄->红）、订单卡片（平台来源/订单号/用户/金额/商品列表）、音效提醒（Web Audio API 新订单提示音+超时告警音）、批量操作（全选+批量接单+批量拒单）、订单分组（待接单/进行中/已完成）
- **说明**：实现60秒接单看板页面，核心功能：新订单到达时顶部弹出醒目卡片，60秒倒计时进度条（0-60秒颜色从绿渐变到黄到红，<10秒时闪烁+音效告警），卡片内容（平台来源icon+标签/订单号/用户姓名电话/金额/商品明细列表/备注），底部操作（绿色接单按钮+红色拒单按钮+拒单原因快捷选择）。页面主体：三列看板布局（待接单/进行中/已完成），每列卡片列表，支持卡片拖拽流转（从待接单拖到进行中=确认接单，从进行中拖到已完成=完成配送）。顶部工具栏：音效开关+自动接单开关+刷新按钮+批量操作按钮（全选+批量接单+批量拒单）。需使用 WebSocket 或轮询（每3秒）获取新订单。扩展现有占位文件 `InstantRetailOrderBoard.vue`。

### 6. InstantRetailReport - 零售经营分析
- **文件**：`admin-web/src/views/InstantRetailReport.vue`
- **关键字段**：销售概览（今日销售额/订单量/客单价/毛利）、趋势图（日销售额趋势/订单量趋势）、平台对比（京东/美团/饿了么销售占比饼图+对比表格）、商品排行（热销商品TOP20/毛利商品TOP20）、导出功能（Excel导出）
- **说明**：实现零售经营分析页面，顶部概览卡片（今日销售额/环比增长率/今日订单量/客单价/毛利率，带趋势箭头），中部趋势图（折线图：近30天销售额趋势+订单量趋势，支持切换日/周/月维度），平台对比区（饼图：各平台销售占比，柱状图：各平台销售额/订单量对比，表格：平台名称/销售额/订单量/客单价/佣金/净收入），商品排行（两个Tab：热销TOP20表格含商品名/销量/销售额/占比，毛利TOP20表格含商品名/毛利额/毛利率/销量），底部导出按钮（导出Excel报表）。调用 `api.ts` 中已有的 `/admin/instant-retail/reports/summary` 和 `/admin/instant-retail/reports/trend` 接口。扩展现有占位文件 `InstantRetailReport.vue`。