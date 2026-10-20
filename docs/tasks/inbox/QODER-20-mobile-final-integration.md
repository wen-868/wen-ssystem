# QODER-20 · 移动端最终集成与单基线

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-20`
> 分支：`chore/qoder-20-mobile-final-integration`
> 基线：`cdf16ce4`（QODER-19 尖端，10/184）
> 前置：QODER-13F2 已交付
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、合并

1. 从 QODER-19 尖端建分支。
2. 合并 QODER-13F2 新分支（含 QODER-13 与文件头/env 修正）。
3. 合并 QODER-18 `bd7e158f`。
4. 合并 QODER-11R `df583401`（docs-only）。
5. 冲突只允许落在 `gates-baseline.json.tests`；业务实现不得改写。

## 二、最终基线

- QODER-19：10 文件 / 184 用例。
- QODER-13F2：+1 spec 文件 / +1 用例 ⇒ 11 / 185。
- QODER-18：既有 request spec 内 +1 用例 ⇒ 11 / 186。
- QODER-11R：docs-only，0 用例。

最终 `gates-baseline.json` 必须是 **11 文件 / 186 用例**，note 逐项列 184 + 1 + 1 来源。

## 三、验收

- `npm --workspace app-mobile run check:gates` EXIT=0：type 0=0、lint error20/warn12872、test 11/186、contract EXIT=0。
- `build:h5`、`build:mp-weixin`、`build:app` 均 EXIT=0。
- `node backend/scripts/guard-rbac-wiring.mjs --strict` 与 `--strict --no-stale` 均 EXIT=0。
- `git diff 21b465e5..HEAD -- backend/src` = 0；backend 仅允许 QODER-13 原有 guard 脚本变化。
- `app-mobile/src/api/request.ts` 不再导出 upload；实际 `products.ts` / `profile.ts` 上传封装保留。
- 工作树 clean。

## 四、回传

`docs/tasks/cards/R101-QODER-20-回传.md`（十项）+ 回执；列 merge commits、最终 baseline 和全部原始输出；带 DSH-RECEIPT 区块。
