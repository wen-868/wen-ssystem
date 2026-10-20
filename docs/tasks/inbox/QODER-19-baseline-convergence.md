# QODER-19 · 四卡合并与门禁基线收敛

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-19`
> 分支：`chore/qoder-19-baseline-convergence`
> 基线：`21b465e5`（当前 main；代码面等同 dfeedbc0）
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、要合并的四张已验收代码卡

| 单 | 分支 | 尖端 |
|:--|:--|:--|
| QODER-14F1 | `fix/qoder-14f1-auth-cleanup-restack` | `e6801de0` |
| QODER-15F1 | `fix/qoder-15f1-price-compare-restack` | `316f2051` |
| QODER-16R | `fix/qoder-16r-permissions-restack` | `54ba998a` |
| QODER-17F1 | `fix/qoder-17f1-safe-top-viewport` | `47c737e8` |

## 二、动作

1. 从 `21b465e5` 建集成分支，依序合并四分支；保留证据/回传卡，合入后不重复造证据。
2. 只允许在集成结果上解决 `gates-baseline.json` 冲突，不得改写各业务实现。
3. 最终测试基线必须为：
   - `testFiles: 10`
   - `testCount: 184`
   - 组成：56 + QODER-14F1 14 + QODER-15F1 102 + QODER-16R 8 + QODER-17F1 4。
4. `note` 逐项列来源，禁止只写总数。

## 三、验收

- `npm --workspace app-mobile run type-check` EXIT=0。
- `npm --workspace app-mobile run lint` EXIT=0，error 20 / warning 12872，不劣化。
- `npm --workspace app-mobile run test`：10 文件 / 184 用例全过。
- `npm --workspace app-mobile run check:contract` EXIT=0。
- `build:h5`、`build:mp-weixin`、`build:app` 均 EXIT=0。
- `git diff 21b465e5..HEAD -- backend/src` = 0；`backend/` 仅允许四卡原有台账/证据变化。
- 工作树 clean。

## 四、回传

`docs/tasks/cards/R101-QODER-19-回传.md`（十项）+ 回执；逐项列 merge commit 与冲突处理；带 DSH-RECEIPT 区块。
