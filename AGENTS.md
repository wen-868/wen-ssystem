# 智享全链 MS · 代码仓技术规则

> 本文件只承载 MS 代码仓的技术执行规则。任务、验收、角色、证据和记忆以中央工作区为准。
> 更新日期：2026-11-07

## 一、开工必读

1. `D:\Users\ZXQL\ZXQL-WORK\AGENTS.md`
2. `D:\Users\ZXQL\ZXQL-WORK\INDEX.md`
3. `D:\Users\ZXQL\ZXQL-WORK\registry\projects.yaml`
4. 中央权威任务卡 `D:\Users\ZXQL\ZXQL-WORK\projects\ms\tasks\inbox\ACTIVE-<taskId>.md`
5. 项目记忆 `D:\Users\ZXQL\ZXQL-WORK\projects\ms\memory.md`
6. 本人角色卡与 `D:\Users\ZXQL\ZXQL-WORK\people\<姓名>\memory.md`
7. 恢复现场：`node D:\Users\ZXQL\ZXQL-WORK\operations\bin\workctl.mjs memory resume project ms <姓名>`

## 二、仓库边界

- 本仓只保存源码、测试代码、配置、构建文件、可执行迁移和运维脚本。
- `docs/migrations/**` 与 `docs/ops/**` 中的可执行 SQL/脚本保留。
- 任务、回传、验收、证据、人员记忆、历史报告、设计工作文档只写中央工作区。
- 不得在本仓重新创建 `docs/tasks/**`、`docs/evidence/**`、`docs/memories/**`、
  `docs/reports/**` 或同类任务工作目录。
- 旧仓文档只读归档：
  `D:\Users\ZXQL\ZXQL-WORK\projects\ms\archive\repo-docs-20261107\`。

## 三、执行规则

- 只修改任务卡允许路径；越界即停止回传。
- 不覆盖他人未提交改动；不使用 `git add -A`。
- 不 push、不开 PR、不 merge、不 deploy，除非任务卡和业主明确授权。
- 测试证据、运行日志和一次性验证产物写入中央 evidence 或系统临时目录，不回流代码仓。
- 业务代码由执行方完成；凌舟只做规划、派单、审计、验收和中央记账。

## 四、技术资料

- 中央交付治理：`D:\Users\ZXQL\ZXQL-WORK\shared\protocols\交付治理与商用验收-v2.md`
- 中央派单规范：`D:\Users\ZXQL\ZXQL-WORK\shared\protocols\派单规范.md`
- 旧项目规则、API 文档、数据库清单和设计资料均已迁入中央只读归档。
