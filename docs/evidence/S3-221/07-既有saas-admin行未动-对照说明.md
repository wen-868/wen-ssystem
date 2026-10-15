# S3-221 · 「既有 saas-admin 行一条未动」对照（判据 §三.4）

## 一、逐行比对（自动，非人眼）

把**基线 `295ab488` 版脚本**原样取出到独立小树（`git show HEAD:scripts/contrast-check.cjs` +
该提交的 `saas-admin/src/styles/tokens.css` / `admin-web/src/styles/theme.ts`），跑出基线输出
`07b-HEAD脚本-扩面前输出.txt`（EXIT=0），再与扩面后的 `01-baseline-after-extend.txt` 逐行对比：

```
$ $head = @(Get-Content 07b-HEAD脚本-扩面前输出.txt | ? { $_ -like "|*" })
$ $new  = @(Get-Content 01-baseline-after-extend.txt   | ? { $_ -like "|*" })
$ Compare-Object -ReferenceObject $head -DifferenceObject $new
HEAD 行数=33  扩面后行数=50
仅扩面后新增行=17   仅HEAD有(被改动或删除的行)=0
```

- 33 行 = 31 条既有数据行 + 2 行表头；50 行 = 48 条数据行 + 2 行表头（31 + 17）。
- **「仅 HEAD 有」的行数 = 0** ⇒ 既有 31 条断言行的**文本逐字节未变**（取值、比值、PASS/FAIL 全同）；
- 新增 17 行 = 13 条 `admin-web token`（纳入失败判定）+ 4 条 `admin-web token (登记·未纳入失败判定)`。

## 二、代码层：只有 2 行「修改」，且都在打印层，不在断言层

```
$ git diff -U0 -- scripts/contrast-check.cjs    （删除行 = 2）
-  console.log(`| ${x.group} | ... | ${x.ok ? PASS : FAIL} |`);
+  console.log(`| ${x.group} | ... | ${x.ok ? PASS : FAIL}${x.pending ? '·登记(未纳入失败判定)' : ''} |`);

-  console.log(`✅ 对比度矩阵全部达标：共 ${rows.length} 个 token×surface 组合（文本 ≥ 4.5:1，非文本 UI ≥ 3:1）`);
+  console.log(`✅ 对比度矩阵全部达标：共 ${enforcedRows} 个 token×surface 组合（文本 ≥ 4.5:1，非文本 UI ≥ 3:1）`);
```

1. 第 1 行：给**登记行**加结论后缀（既有行不带 `pending`，输出不变）。
2. 第 2 行：✅ 汇总的计数改为**只数纳入失败判定的组合**（`enforcedRows`），
   否则会把「登记项（不达标但不判红）」也数进"全部达标"，口径自相矛盾。

除这 2 行外，其余 137 行全部是**新增**（`137 insertions(+)`）：
新增 4 个 admin-web 相关定义块 + 2 个判定块 + 登记打印函数 + 缺失兜底循环。

## 三、既有断言未被删除/放宽的证据

- `git diff` 全量见 `07a-脚本diff.txt`；
- 既有 31 行文本零差异（见 §一）；
- 未出现 `continue-on-error`、未放宽任何阈值（`TEXT_THRESHOLD=4.5` / `NON_TEXT_THRESHOLD=3.0` 未动）；
- `.github/**`、`deploy/**`、`docs/migrations/**`、后端代码**零改动**（`git diff --name-only` 只有 `scripts/contrast-check.cjs`）。
