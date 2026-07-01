# 智享全链管理系统正式壳第二阶段打磨设计

## 背景

第一阶段 A 方案"正式可用壳"已上线 `admin.onepan.cn` 和 `store.onepan.cn`，登录、菜单切换、退出登录、9+6 个模块切换都已生效，三道生产验收（QA_REGRESSION_PASS / PRODUCTION_DEPLOY_CONTRACT_PASS / ACCEPTANCE_PRODUCTION_PASS）全部通过。

但用户体验上仍有"还不完善"的明显手感问题：
1. token 过期后接口持续 401，前端不会自动登出，用户只看到 toast 报错却又点不回登录页。
2. 后台和门店端到处是"新增演示商品""演示客户 13900000000""演示新门店"等开发期占位文案，正式上线后看起来不专业。
3. 新增商品、新增客户、新增门店、库存调整等关键表单都没有任何校验，价格为 0 / 手机号为空 / 库存调整变化量为 0 都能直接提交。
4. 改价、上架、下架、退出登录这些会影响经营数据或登录态的操作没有二次确认，误点即生效。
5. 销售单、订单、库存等模块的金额展示是裸数字（`128.00` / `1280`），没统一的 `¥` 和千分位，肉眼难辨数量级。
6. 除"订单"模块外，"商品""销售单""客户""门店"这些列表都没有关键字搜索和分页，数据一多就找不到。

第二阶段在不引入路由、不重写状态管理、不动后端的前提下，把这些"明显不完善"的体验点逐一补上。

## 目标

1. 任意接口返回 401 时，前端自动清掉本地 token、回到登录页，并给一次明确提示。
2. 所有面向终端用户的文案中不再出现"演示""示例"字眼，默认填充值改为留空或专业占位。
3. 关键表单（商品、客户、门店、库存调整、改价）有 Element Plus 的 `el-form` 校验：必填、长度、价格 > 0、手机号格式、变化量非 0。
4. 改价、上架、下架、退出登录、库存调整都要走 `ElMessageBox.confirm` 二次确认。
5. 所有金额展示走统一的 `formatYuan(value)`，输出 `¥1,280.00` 格式；后台、门店端、销售单、订单、报表都使用同一个工具函数。
6. 后台的"商品""销售单""客户""门店"四个列表，门店的"销售单""库存查询"两个列表，统一接入"关键字搜索 + 分页"的简单分页条（沿用订单模块已有 UX）。

## 非目标

1. 不引入 Vue Router、不拆多文件页面、不引入 Pinia/Vuex。
2. 不做权限分级、菜单按角色显隐。
3. 不做 ECharts 等图表升级，仍沿用 canvas 简易绘制。
4. 不动后端 SQL/接口形态，沿用现有分页参数 `page` / `pageSize` / `keyword`。
5. 不做小程序新功能。

## 方案

整体仍走"单文件 SFC + activeNav 分区"模式，6 个打磨点对应 6 个独立 task，互相解耦：

### 1. Token 401 自动登出（admin + store）

`admin-web/src/api.ts` 和 `store-terminal/src/api.ts` 各自添加 `api.interceptors.response.use`：
- 收到 `error.response.status === 401` 时，移除对应 token（`admin_token` / `store_token`），用 `window.dispatchEvent(new Event("auth:logout"))` 通知 App。
- App 监听 `auth:logout`，重置 `token.value = ""`、`activeNav.value = "首页" / "工作台"`，并 `ElMessage.warning("登录已过期，请重新登录")`。

### 2. 去演示硬编码文案

后台：
- 商品弹窗标题"新增演示商品" → "新增商品"。
- `productForm` 默认值清空（`name: ""`、`skuName: ""`、`barcode: ""`、`mainImage: ""`、`retailPrice: 0`、`wholesalePrice: 0`，`boxRatio: 6` 保留）。
- 门店表单 `name: "演示新门店"` → ""，`address: "示例地址"` → ""，`phone: "13800000001"` → ""。
- 客户表单 `name: "演示新客户"` → ""，`mobile` 默认空。

门店端：
- `saleForm.customerName = "演示客户"` / `customerMobile = "13900000000"` → 默认空。
- 收银面板 placeholder "散客/客户姓名" 保留。

### 3. 表单校验

引入 `el-form` 的 `rules` 和 `ref`，对以下表单加校验：
- 后台 `productForm`: `name` required、`skuName` required、`retailPrice > 0`、`wholesalePrice > 0`。
- 后台 `storeForm`: `code` required + 长度 2-32、`name` required、`phone` required + `/^1[3-9]\d{9}$/`（如填）。
- 后台 `memberForm`: `name` required、`mobile` required + 手机号格式。
- 后台 `priceForm`: `price > 0`。
- 门店 `invForm`: `change !== 0`。
- 表单提交前 `formRef.value?.validate()`，校验失败给错误提示并阻止提交。

### 4. 二次确认

引入 `ElMessageBox.confirm`：
- 后台改价：`确认调整 [SKU] 的[价格类型] 为 ¥xx ?`
- 后台上架/下架：`确认[上架/下架] [商品名] ?`
- 后台/门店退出登录：`确认退出当前登录 ?`
- 门店库存调整：`确认对 [SKU] 的[库存类型] 库存调整 [+N] ?`

用户取消则不做任何操作。

### 5. 金额格式化工具

新增 `admin-web/src/utils/format.ts` 和 `store-terminal/src/utils/format.ts`（内容相同）：

```ts
export function formatYuan(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0.00";
  return "¥" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
```

后台 `payableAmount / receivableAmount / receivedAmount / unreceivedAmount / amount / paidAmount / subtotalAmount / unitPrice / retailPrice / wholesalePrice`，门店端同理，全部改用 `formatYuan(row.xxx)` 渲染。

### 6. 列表搜索 + 分页

后台四个新增分页：
- 商品：`productsKeyword` + `productsPage` + `loadProducts(page, keyword)` + `<el-pagination>` 简单按钮组。
- 销售单：`saleBillsKeyword` + 同上。
- 客户：`membersKeyword` + 同上。
- 门店：`storesKeyword` + 同上。

门店端两个：
- 销售单：`storeSaleBillsKeyword` + 分页。
- 库存查询：`inventoryKeyword`（前端过滤即可，后端无 keyword 参数则保留空入参）。

API 函数加可选 `params: { page, pageSize, keyword }`，沿用已有的 `params: { page: 1, pageSize: 20 }`。

## 测试策略

- `scripts/ui-contract-test.mjs` 增加每个 task 的契约断言（`formatYuan`、`auth:logout`、`ElMessageBox`、`rules` 等关键字）。
- `npm run test:backend`：保证后端单测仍 11/11 通过。
- `npm run test:acceptance:admin` / `npm run test:acceptance:store`：保证后台和门店关键链路通。
- 浏览器实测：登录 → 故意篡改 token 触发 401 → 自动登出；新增商品空名 → 校验拒绝；改价 → 弹确认框；金额带 `¥` 和千分位。

## 部署策略

沿用第一阶段流程：
1. 本地 `npm run test:ui` / `test:backend` / `test:acceptance:admin` / `test:acceptance:store` 全绿。
2. 打 `tar.gz` → temp.sh 中转 → 服务器 `SKIP_GIT_PULL=true bash deploy/03-deploy.sh`。
3. 服务器 `npm run test:production-deploy` + `test:acceptance:production`。
4. 浏览器人工验收两个域名。
