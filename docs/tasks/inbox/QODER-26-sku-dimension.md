# QODER-26 · SKU/SPU 维度与路径参数（MO-22/23）

【派单 QODER-26】商品行按 SKU 唯一，详情按 SPU，改价/追溯按真实 id
派单人：凌舟（总负责人）｜2026-10-21
执行方：Qoder（移动端；`D:\Users\ZXQL\wt-agents\QODER-26`）
优先级 / 时间盒：P1 · 一天

## 回传格式（照抄填满）

```
【汇报 QODER-26】QODER-26 SKU/SPU 维度与路径参数 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-26-回传.md
关联卡：docs/tasks/inbox/QODER-26-sku-dimension.md
```

## 一、基线与根因

- 基线：QODER-22 尖端 `bc1087ee`；分支：`fix/qoder-26-sku-dimension`。
- 后端商品列表是 **SKU 粒度**：`backend/src/services/admin/product.service.ts:259-273` 同查 `spuId` 与 `skuId`。
- `app-mobile/src/api/modules/products.ts:289-291` 却把 `id = r.spuId ?? r.id`，导致同 SPU 多 SKU 使用同一 `id`。
- 商品页 `:key`/详情、销售页加购去重、批量改价均消费 `ProductInfo.id`，形成重复 key、跨规格合并与写错对象。
- `products.ts:355-357` 的 `batchTrace(batchNo)` 路径却要求批次数字 id，且当前全仓无调用。

## 二、交付物

1. `ProductInfo` 明确区分 `id`（SKU 行主键）、`spuId`、`skuId`；列表映射不得再用 SPU 顶替 SKU。
2. 商品列表 `:key`、加购去重、待选数量、销售明细 `productId` 全部使用 SKU `id`。
3. 点商品卡/扫码详情仍使用 `spuId`，保持详情接口 `/admin/products/:spuId` 语义。
4. 批量改价 `updateSkuPrice` 必须拿到真实 `skuId`，不得传 SPU；加日志/守卫防 `id/spuId/skuId` 混用。
5. `batchTrace` 要么删除无调用死包装，要么改名为按数字 `batchId` 的明确接口；禁止继续收 `batchNo` 却塞进 `:id`。若保留，必须与 `api/modules/batches.ts` 的既有正确封装去重。
6. 增加映射单测：同一 SPU 两个 SKU 生成两个不同 `id`，`spuId` 相同，`skuId` 各自正确。
7. 反测：把 `id` 改回 `spuId` ⇒ 多 SKU 用例红；把改价参数改回 SPU ⇒ 路径断言红；把 batchNo 注回数字 id 路径 ⇒ 红。每轮复原后绿。

## 三、硬验收

- `npm --workspace app-mobile run check:gates` EXIT=0。
- `build:h5` / `build:mp-weixin` / `build:app` 均 EXIT=0。
- H5 至少用两个同 SPU 不同 SKU 的确定性夹具完成：列表两行、两行可独立加购、详情仍打开同一 SPU。
- 批量改价请求路径逐条记录为真实 `skuId`；不得只看 UI 成功提示。
- `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean。

## 四、红线

- 不得 push、开 PR、`git add -A` 或改后端。
- 不得改后端字段名来迁就前端；本单原则是前端按既有契约修正。
- 不得用空格、名称或条码作为唯一身份替代 SKU 主键。
- 不得把静态类型通过当多规格运行通过；必须有映射测试与请求路径证据。
