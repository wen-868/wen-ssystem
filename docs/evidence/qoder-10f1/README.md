# QODER-10F1 证据索引 · 横幅 × 的 lint 基线返工

> 执行人：Qoder（移动端）｜日期：2026-10-20
> 工作树 `D:\Users\ZXQL\wt-agents\QODER-10F1`｜分支 `fix/qoder-10f1-lint-closeout`｜基线 `9fd90257`
> 工具：node_modules 以 junction 指向主仓（root / app-mobile / backend ×3），主仓未被写入。

## raw/（判据读数）

| 文件 | 内容 |
|---|---|
| `00-two-files-before.json` | 修前 eslint `-f json` 仅扫两页：`functions.vue` html-indent **72**、`more-functions.vue` **62**（合计 134）；× 行分别为 `functions.vue:21`、`more-functions.vue:14`，报「Expected indentation of 12 spaces but found 6 spaces」 |
| `01-lint-after-fix.txt` | `npm --workspace app-mobile run lint` 原始输出：error 20（基线 20）、warning 12872（基线 12872）、`LINT_EXIT=0` |
| `02-rule-count-after-fix.txt` | 全仓 eslint json 逐规则计数：files=187、error=20、warning=12872、**vue/html-indent = 12299**（= 基线，未超），「所有规则 warning ≤ 基线」 |
| `03-test-gate.txt` | `npm --workspace app-mobile run test`：5 文件 / 56 用例全过，`TEST_EXIT=0`（含 × 挂载点两条静态断言） |
| `04-type-check.txt` | `npm --workspace app-mobile run type-check`：vue-tsc EXIT=0，当前错误 0 条 / 基线 0 条 |
| `05-scope-and-diff.txt` | 面自证：两文件各 1 行、`git diff --ignore-all-space` 为空（纯空白改动）、`gates-baseline.json` 改动文件数 0、`backend/` 面 0 |
| `06-two-files-after-fix.json` | 修后同口径复扫两页：html-indent 71 / 61（合计 132），× 行不再出现在告警列表 |

## anti/（反测五件套 + 位置点名）

| 文件 | 内容 |
|---|---|
| `00-pre-sha256.txt` | 注入前 `functions.vue` SHA256 = `ea8a45c855ab966576ba3c9c3af56509f5e892841c8b0070b5d5904ef2959861` |
| `functions.vue.orig` | 注入前逐字节备份（复原用 `cp`，不用 sed，避免 CRLF 归一） |
| `01-inject-red.txt` | 把 `:21` 的 12 空格改成 14 空格 ⇒ lint 门 `RED_EXIT=1`，点名「vue/html-indent: 当前 12300 条 > 基线 12299 条」 |
| `04-inject-position-eslint.txt` | 同一注入态下 eslint 原始告警的位置级点名：`21:1 Expected indentation of 12 spaces but found 14 spaces` |
| `02-restore-sha256.txt` / `05-restore-sha256-again.txt` | `cp` 复原后 SHA256 与 `00` 逐字节一致（两轮循环各验一次） |
| `03-restore-green.txt` | 复原后复跑 lint 门 `GREEN_EXIT=0` |

全部门禁读数均为执行方**自评**，验收结论归凌舟。
