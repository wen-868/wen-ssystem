# QODER-14 证据目录（401 重试只允许 GET + 清 CSRF）

> 执行方：Qoder（移动端）子代理｜日期：2026-10-20
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-14`｜分支：`fix/qoder-14-auth-retry-safety`｜基线：`321b4f6b`
> 本目录所有读数均为**自评**，不代表验收结论。

## 等价装置说明（基线无门禁设施）

`321b4f6b` 的 app-mobile 没有 `tests/`、`vitest.config.ts`、`.eslintrc.cjs`，`package.json` 也没有
`test` / `lint` / `type-check` 脚本，因此判据按共享协议 §2 用「借入 harness + junction 真实入口」跑：

```
git show 9fd90257:app-mobile/vitest.config.ts > app-mobile/vitest.config.ts
git show 9fd90257:app-mobile/.eslintrc.cjs    > app-mobile/.eslintrc.cjs
mkdir -p app-mobile/tests
```

- 工具入口一律走工作树根 `node_modules`（junction → 主仓），vitest 4.1.10 / eslint 8.57.1 / vue-tsc 2.2.12。
- **借入的两件不提交**，最后一轮读数取完后已删除；可按上面两条命令原地复现。

## 跑法（每条判据的原始命令，均在 `<worktree>/app-mobile` 内执行）

| 判据 | 命令 |
| --- | --- |
| test | `node ../node_modules/vitest/vitest.mjs run` |
| type-check | `node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit` |
| lint（全仓逐规则） | `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue -f json -o <scratch>/x.json` |
| build | 工作树根：`npm --workspace app-mobile run build:h5` |

`<scratch>` = `D:\Users\ZXQL\wt-agents\_qoder14-scratch`（工作树外，不入库），内含：
`baseline-eslint.json` / `post-eslint.json`（eslint 全量 json 报告）、`eslint-summary.mjs`（逐规则计数脚本）、
`inject.mjs`（反测注入器，latin1 读写保 CRLF，命中数≠1 直接 exit 9）、
`request.ts.orig` / `request.ts.orig-b`（反测复原备份）。

## 文件索引

| 文件 | 内容 |
| --- | --- |
| `raw/01-baseline-type-check.txt` | 基线 vue-tsc 原始输出 + EXIT |
| `raw/02-baseline-lint-counts.txt` | 基线 eslint files/error/warning 与逐规则计数 + EXIT |
| `raw/03-baseline-test.txt` | 基线 vitest（`No test files found`，既有用例 0）+ EXIT |
| `raw/04-baseline-build-h5.txt` | 基线 build:h5 原始输出 + EXIT=0 |
| `raw/05-post-type-check.txt` | 修后 vue-tsc 原始输出 + EXIT（0 错 = 基线 0 错） |
| `raw/06-post-lint-counts.txt` | 修后 eslint 逐规则计数 + EXIT |
| `raw/07-post-test.txt` | 修后 vitest 全绿原始输出（1 文件 / 14 用例）+ EXIT + request.ts SHA256 |
| `raw/08-post-build-h5.txt` | 修后 build:h5 原始输出 + EXIT=0 |
| `raw/09-lint-before-after-diff.txt` | 改前/改后逐规则计数 diff（无输出 ⇒ 完全一致，不劣化） |
| `raw/10-change-scope.txt` | 改动面自证（`git diff --name-only 321b4f6b..HEAD`、backend 计数 = 0） |
| `raw/11-closeout-checklist.txt` | 协议 §6 收尾自检逐条输出 |
| `anti/a-get-gate/**` | 反测 (a) 摘掉 GET 判定：00 注入前 SHA256 → 01 红 → 02 复原 SHA256 → 03 绿 |
| `anti/b-csrf-clear/**` | 反测 (b) 摘掉 CSRF 清理行：同上四段 |

ANSI 色码已在落盘前剥除（`sed -e 's/\x1b\[[0-9;]*m//g'`）；eslint 全量 json（约 2 MB）留在 scratch，
本目录只落计数摘要。
