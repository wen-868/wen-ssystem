# WORKBENCH-07 mutation 反测记录（四类）

> 被测用例：`admin-web/tests/dashboard-contract.spec.mjs`
> 装置：`admin-web/tests/dashboard-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）

| 反测 | 目标 | 注入 | EXIT | FAIL | 点名 | 复原恒等 |
|:--|:--|:--|--:|--:|:--:|:--:|
| M1-flat-fields-only | `src/utils/dashboard-contract.ts` | 适配器改回只读扁平字段（去掉嵌套优先） | 1 | 3 | ✅ | ✅ |
| M2-fail-as-empty | `src/utils/dashboard-contract.ts` | 把接口失败映射为空数组（失败伪装成空态） | 1 | 1 | ✅ | ✅ |
| M3-store-bypass-adapter | `src/views/pos/StoreDashboardView.vue` | 门店工作台绕开共享适配器（手写字段映射） | 1 | 1 | ✅ | ✅ |
| M4-dead-link | `src/views/dashboard/Dashboard.vue` | 入口改回死链 /customer/members | 1 | 1 | ✅ | ✅ |

## 逐条 FAIL 原文

### M1-flat-fields-only（适配器改回只读扁平字段（去掉嵌套优先））

```text
FAIL  嵌套契约：today.* / month.* 正确读取（WB-AUDIT-01/08 主修复）  ← 今日销售额应读 today.salesAmount
FAIL  嵌套优先：嵌套与扁平同时存在时，**以嵌套为准**  ← 嵌套优先，扁平不得覆盖
FAIL  边界：嵌套字段为 null / 字符串数字 / NaN  ← 字符串数字应转为 12
```

### M2-fail-as-empty（把接口失败映射为空数组（失败伪装成空态））

```text
FAIL  alerts：平铺数组解析 + 失败与空可区分  ← Expected values to be strictly equal:
```

### M3-store-bypass-adapter（门店工作台绕开共享适配器（手写字段映射））

```text
FAIL  共用（强断言）：两页**不得**自建指标对象绕过适配器  ← views/pos/StoreDashboardView.vue 不得自建 {ok:true,data:{...}} 伪装适配器结果（绕过共享契约）
```

### M4-dead-link（入口改回死链 /customer/members）

```text
FAIL  入口：两处客户会员均指向 /customers（源码字符串断言）  ← Dashboard 不得再出现 /customer/members 死链
```

## 复原后复跑

```text
PASS  嵌套契约：today.* / month.* 正确读取（WB-AUDIT-01/08 主修复）  ← today=12345.67/42 · month=98765.43/321
PASS  嵌套契约：毛利来自 reports/profit（overview 无此字段）  ← today.grossProfit=88.88（外部注入）
PASS  毛利：未取到 ⇒ null（**绝不填 0**）  ← 缺字段全 null，不伪造 0
PASS  扁平兼容：仅扁平字段时兜底可读（旧夹具不炸，但不冒充主路径）  ← 扁平兜底 555 / 6666（嵌套缺失时才生效）
PASS  嵌套优先：嵌套与扁平同时存在时，**以嵌套为准**  ← 嵌套 100/200 胜过扁平 999/888
PASS  边界：嵌套字段为 null / 字符串数字 / NaN  ← 字符串→数字、NaN→0
PASS  失败态：overview 形状异常 ⇒ ok:false（不返回 0 指标）  ← 5 种异常载荷 + 缺主体 全部 ok:false
PASS  todos：**真实形状 {total,items}** 可渲染（运行态抓包口径）  ← {total:2,items:[2]} ⇒ ready（3笔订单待付款）
PASS  todos：平铺数组形态亦兼容（未来简化/旧缓存容忍）  ← 平铺兼容 1 条 ⇒ ready
PASS  todos：空 ⇒ empty（真空结果，不是失败）  ← {total:0,items:[]} 与 [] 均 ⇒ empty
PASS  todos：**失败态与空态必须可区分**（形状异常 ⇒ ok:false）  ← 6 种异常载荷 ok:false；合法空态 {total:0,items:[]} ⇒ empty（二者可区分）
PASS  todos 分组：按 type 归组、按 priority 排序、未知类型不丢  ← 3 组（含未知类型）+ 优先级排序 urgent→important→normal
PASS  alerts：平铺数组解析 + 失败与空可区分  ← 1 条 ready / [] empty / 字符串 ok:false
PASS  四态：resolveDataState 严格区分 loading/empty/ready/error  ← 6 组真值表全符合
PASS  入口：两处客户会员均指向 /customers（源码字符串断言）  ← 死链 0 处；共享常量引用 3 处
PASS  入口：/customers 路由真实存在（静态路由表断言）  ← 嵌套 path:'customers' → CustomersView.vue（解析为 /customers）
PASS  共用：管理 Dashboard 与门店工作台均 import 同一适配器  ← 两页均 import 并调用同一适配器
PASS  共用（强断言）：两页**不得**自建指标对象绕过适配器  ← 两页零自建指标对象 / 零伪装适配器结果
PASS  共用（负断言）：两页不得再手写**后端原始字段**路径  ← 两页零后端原始字段直读；均消费适配器输出
PASS  共用（负断言）：门店页不得再静默吞掉失败  ← 空 catch 0 处；metricsError 在位
PASS  API：todos/profit 端点与后端路由逐字对齐  ← 两条端点 + 日期参数齐备
PASS  API（负断言）：不得重复定义同名导出（fetchReportProfit ×2 已合并）  ← 62 个导出函数，无重名
PASS  区间：todayRange / monthRange 正确  ← 今日 10-28/10-28；本月 10-01/10-28
小结：23 passed / 0 failed
```
