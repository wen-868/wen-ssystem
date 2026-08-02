# 任务信箱(inbox)说明

> 建立人:凌舟 | 日期:2026-08-03 | 用途:子代理消息通道降级协议

## 为什么存在

Codex 桌面端协作系统存在平台级故障:spawn_agent / followup_task / send_message 的消息正文无法送达子代理(见 docs/reports/R73-05-代理消息通道诊断.md)。为保证团队协作不被阻塞,启用文件信箱作为任务投递通道。

## 使用规则

1. 父代理(凌舟)派发任务时,把完整任务正文写入 inbox/<系统标识>.md,例如 inbox/ajian_r73_02.md。
2. 子代理启动后,即使收不到消息正文,也会按全局指令(C:\Users\XIONG\.codex\AGENTS.md 的"团队协作与文件信箱协议")读取 inbox/<自己的系统标识>.md 获取任务。
3. 子代理最终回复必须复述任务标识与关键内容,作为"收到"的验收证据。
4. 任务完成后,子代理把任务卡移到 inbox/archive/,并在 docs/tasks/current-tasks.md 更新状态。
5. inbox 仅用于消息投递,不替代 current-tasks.md 的唯一任务文件地位。

## 归档

已完成任务卡统一移入 inbox/archive/,按轮次保留备查。
