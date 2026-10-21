# QODER-22 · 移动端最终 main 收口

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-22`
> 分支：`chore/qoder-22-mobile-main-closeout`
> 基线：`cf9a98fa`（QODER-20 尖端，11/186）
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、并入

1. 从 `cf9a98fa` 建分支。
2. 合并 QODER-21 `2e8cde17`。
3. `gates-baseline.json` 最终必须同时满足：
   - `lint.errorBaseline = 0`
   - `errorsByFileRule = {}`
   - `tests.testFiles = 11`
   - `tests.testCount = 186`
   - 两段 note 都保留来源。

## 二、pin-ssl 静态扫描口径

QODER-13F2 当前 `headBlock()` 只守文件头。凌舟裁定使用**双范围**：

- 负向旧事实 `2026-09-15` / `TrustAsia`：扫描 **pin-ssl.ts 全文**；
- 正向现网日期 `2026-11-11` / `2026-12-22`：扫描 **文件头块**；
- `installSslPinning` 调用点：继续全 `src`。

只改 `tests/pin-ssl-static.spec.ts`，测试仍为 1 个 `it`，总用例数保持 186。

## 三、验收

- `npm --workspace app-mobile run check:gates` EXIT=0。
- lint error **0**，warning ≤12872；test **11 文件 / 186 用例**；type 0=0；contract EXIT=0。
- `build:h5` / `build:mp-weixin` / `build:app` 均 EXIT=0。
- `node backend/scripts/guard-rbac-wiring.mjs --strict` 与 `--strict --no-stale` 均 EXIT=0。
- `git diff 21b465e5..HEAD -- backend/src` = 0。
- request.ts 无 `upload` 导出；pin-ssl 未接线；工作树 clean。
- 反测：旧事实写回 pin-ssl 常量尾部也必须红（证明不是只看文件头）；port 常量：文件头缺新日期必须红。

## 四、回传

`docs/tasks/cards/R101-QODER-22-回传.md`（十项）+ 回执；列最终 baseline、两段冲突处理、四门/三构建/双守卫原始输出；带 DSH-RECEIPT 区块。
