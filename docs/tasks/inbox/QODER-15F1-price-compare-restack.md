# QODER-15F1 · 低价比较归一化 + 常驻门禁重栈

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-15`
> 新分支：`fix/qoder-15f1-price-compare-restack`
> 基线：`d1a6adcf`
> 红线：不得 push、不得开 PR、不得 `git add -A`；逐文件 add。

## 一、验收时发现的新缺陷

`price-anomaly.vue:63` 仍保留：

```vue
:class="{ 'price-danger': item.retailPrice < item.costPrice }"
```

当两个价格为字符串时按字符串比较，例如 `'9.00' < '12.00'` 会得到错误结果；null 语义也未显式处理。白屏虽已止血，但“低于成本”标红仍可能误判。该缺陷与 QODER-15 同页同源，本卡收口。

## 二、动作

1. 从 `24d109ab` 建新分支后 rebase 到 `d1a6adcf`。
2. 新增价格比较函数（可放 `utils/format.ts`，如 `isBelowCost(retail, cost)`），内部必须经 `toNum`，任一无效值返回 false。
3. 页面 `:class` 改为调用该函数，不得直接比较原始 API 值。
4. 增加用例：字符串 `'9.00' < '12.00'` 必须为 true；数字同值；null/undefined/空串/NaN 为 false；避免依赖 JS 隐式转换。
5. 更新 gates baseline：新增 2 个 spec 文件，tests `5/56 → 7/100`。

## 三、验收

- 常驻四门：lint 逐规则不劣化、type-check 0=0、test 7 文件 / 100 用例、contract EXIT=0；build:h5 EXIT=0。
- 反测：把比较函数改回原始 `<` ⇒ 字符串低价用例红；复原 SHA256 一致 ⇒ 绿。
- 浏览器渲染证据保留；PNG/登录态整页 E2E 未验必须继续如实登记。

## 四、回传

`docs/tasks/cards/R101-QODER-15F1-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
