# QODER-27 · 四树 tests 基线收敛与联合集成

> 派单人：凌舟（总负责人）｜执行方：Qoder｜日期：2026-10-22

## 回传格式（照抄填满）

```
【汇报 QODER-27】QODER-27 四树基线收敛与联合集成
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含 merge 提交、文件路径>
证据（可复跑）：<命令 + 原始输出摘要 + 行号>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-27-回传.md
关联卡：docs/tasks/inbox/QODER-27-f1-baseline-convergence.md
```

## 一、固定输入与顺序

- 基座：当前 main；工作树 `D:\Users\ZXQL\wt-agents\QODER-27`
- 分支：`chore/qoder-27-f1-baseline-convergence`
- 固定合并序：
  1. QODER-23F1 `71b248c80cbc7e82b1b5ed78efd7097e6a1bc573`
  2. QODER-24 `dd44e32114141ebaaca94c3487eb1343d50c0ab1`
  3. QODER-25F1 `317e421d9b35e06014c8c6b5530bf69204252005`
  4. QODER-26 `1b6da0830a24ed7da09b6fc30b5d0dca6dcd8b1e`

保留真实 merge，不 rebase、不 squash、不改写来源支。

## 二、交付物

1. 四笔固定序 merge；除 `app-mobile/scripts/gates-baseline.json.tests` 外，不得手工改写业务实现。
2. `tests` 终值必须为 **15 文件 / 303 用例**；note 逐段保留四树来源，原文不得删。
3. 合并后静态检查：旧 `custom-tab-bar` 组件文件名/标签为 0；`aiMsg` 为 reactive；`ProductInfo.id` 与 skuId 分离；IV/tag 双守卫在位。
4. 全量四门、三端构建、backend 零 diff、工作树 clean。
5. 反测至少四路，分别打坏：IV 守卫、tabBar 保留名、reactive 代理、SKU 主键；每路都必须红并点名，复原 SHA 一致后绿。

## 三、硬验收

- `check:gates` EXIT=0，15/303。
- type 0、lint error 0/warning 12872、contract 差集 1 具名豁免 1。
- h5/mp-weixin/app build EXIT=0；MP 保留名警告 0。
- `git diff <main>..HEAD -- backend/` 0。
- 工作树 clean；未 push/未开 PR/逐文件 add。

## 四、红线

- 不得 push、不得开 PR、不得 `git add -A`。
- 不得把四段 note 覆盖成一段；不得调整 tests 数字以外的基线字段。
- 不得删除或跳过任卡测试，不得合并证据目录。
- 不得自行处理 MP/App 真机未验项；该未验保留给运行态卡。
