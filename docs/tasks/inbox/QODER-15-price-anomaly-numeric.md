# QODER-15 · 价格异常页数值入口止血

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-20
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-15`
> 分支：`fix/qoder-15-price-anomaly-numeric`｜基线：`origin/main=321b4f6b`
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、已核实问题

后端 DECIMAL 可能以字符串/null 下发，但价格异常页直接对 `costPrice/retailPrice/storePrice/miniappPrice` 调 `.toFixed()`，页面可白屏或显示错误。

## 二、修复

1. 新增 `app-mobile/src/utils/format.ts`，至少提供：
   - `toNum(value): number | null`；
   - `fmtAmount(value): string`，无效值统一 `—`，有效 0 输出 `0.00`。
2. `app-mobile/src/api/modules/price.ts` 的价格异常出参字段改为 `number | string | null`。
3. 价格异常页四处金额显示改用格式化函数，模板不得再对原始 API 值直接 `.toFixed()`。
4. 不批量改其他页面；本卡只建立公共工具并修该白屏页。

## 三、验收

- 新增单元测试覆盖：`12.34`、`'12.34'`、`0`、`null`、`undefined`、`''`、`NaN`。
- 静态反测：在价格异常页重新插入一处裸 `.toFixed()` ⇒ 目标断言红；复原后 SHA256 一致。
- app-mobile `test` 不劣化、`type-check` 0=0、`build:h5` EXIT=0、lint 不劣化。
- 截图或浏览器实开证明页面不再白屏，`null` 显示 `—`、零价显示 `0.00`。

## 四、回传

`docs/tasks/cards/R101-QODER-15-回传.md`（十项）+ 回执；必须带 DSH-RECEIPT 区块。
