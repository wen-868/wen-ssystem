# 工作区入口指令（仓库外关键文件的版本化副本）

> **用途**：本文件是 `D:\Users\ZXQL\AGENTS.md` 的副本。原件位于**仓库外的工作区根目录**，
> 不在 git 里，一旦丢失会导致文件信箱通道再次失效（子代理继承的工作目录是 `D:\Users\ZXQL`，
> 仓库内的 `AGENTS.md` 不在该目录链上，不会被自动加载）。**原件的建立与实测过程见踩坑日志 [51]。**
> 同步责任：凌舟。原件变更后必须同步回本文件。

## 一、开工第一条（无条件执行）

收到任何派工后，**先按顺序读这两个文件**，再动手：

1. `D:\Users\ZXQL\ZXQL-MS\wen-ssystem\AGENTS.md` — 项目级硬性规定（凌舟不写代码铁律、必读清单、派单协议）
2. `D:\Users\ZXQL\ZXQL-MS\wen-ssystem\docs\tasks\inbox\ACTIVE.md` — **当前活动任务卡**

**只要 `ACTIVE.md` 存在且非空，它就是你的任务**，不论你是否收到消息正文。
**禁止**在未读上述两个文件之前回答"未收到任务""没有任何任务正文"。
**禁止**把 `D:\Users\ZXQL` 下的其他目录（如 `ZXQL-AI`、`ZXQL-OPS`、`_cmp`、`r101-push`）当做本项目仓库——
本项目唯一仓库是 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem`。

## 二、本项目仓库

- 仓库：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`（所有任务一律在此目录内执行）
- 必读：`docs\项目规则.md`、`docs\项目统一标准.md`、`docs\tasks\current-tasks.md`、`docs\踩坑日志.md`
- 语言：简体中文；提交格式：`type: 中文描述`
- 硬约束：只改有问题的地方，禁止顺手重构、禁止改无关文件；禁止模拟/假数据进产品与验收证据

## 三、回传

完成后写 `docs\tasks\inbox\ACTIVE-回执.md`（改了什么 + 证据 + 阻塞点），
把 `ACTIVE.md` 移入 `docs\tasks\inbox\archive\`，并在最终回答中给出结论摘要（返回通道可用，消息正文通道不可用）。
