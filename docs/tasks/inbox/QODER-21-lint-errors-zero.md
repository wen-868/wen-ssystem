# QODER-21 · app-mobile lint error 20→0

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-21`
> 分支：`chore/qoder-21-lint-errors-zero`
> 基线：`21b465e5`（当前代码 main）
> 状态：可与 QODER-20 并行做代码；因两者都会改 gates baseline，最终由 QODER-20 之后单独收敛。
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、目标

清理 `gates-baseline.json.lint.errorsByFileRule` 所列 20 条 error。不得通过升基线、关闭规则、整文件 disable、删除测试或改门禁判据。

## 二、动作

1. 先跑 `npm --workspace app-mobile run lint`，按文件::规则逐条消除 20 条 error。
2. 清理 `storage.ts`、`member-detail.vue`、`batch-price.vue`、`settings.vue`、`ai-chat.vue`、`product-detail.vue`、`create-sale.vue` 的真实问题。
3. 将 `errorBaseline` 改为 0、`mustReachZero` 保持 true、清空 `errorsByFileRule`，note 记录 20→0。
4. warning 12872 不得上升；能下降则记录新值。

## 三、验收

- `npm --workspace app-mobile run lint` EXIT=0，error=0，warning≤12872。
- test 5/56 不回归；type 0=0；contract EXIT=0；build:h5 EXIT=0。
- 反测：任选本卡修复点回填一处 error ⇒ lint 门红并点名；复原 SHA256 同形态一致后绿。
- 禁止吞掉 `catch`/`no-empty`、禁止删业务分支、禁止全局 eslint disable。

## 四、回传

`docs/tasks/cards/R101-QODER-21-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
