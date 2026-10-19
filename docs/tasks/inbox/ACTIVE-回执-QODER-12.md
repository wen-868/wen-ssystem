# ACTIVE-回执-QODER-12

> 回执人：**Qoder（移动端执行方）**｜日期：2026-10-20｜任务书：`docs/tasks/inbox/QODER-12-pinssl指纹口径.md`｜工作树 `D:\Users\ZXQL\wt-agents\QODER-12`｜分支 `docs/qoder-12-pinssl-runbook`（基线 `844515d5`）

## 改了什么

1. 新增 `app-mobile/docs/pin-ssl指纹维护口径.md`：任务书 5 条（谁更新/SPKI 采集命令/何时更新/轮换同 PR/失效表现+回滚）全覆盖，另按简报补"叶子+中间成对理由、30 天触发口径、指纹+接线状态同 PR、接线事故形态、回滚先后顺序"，逐条标 **A/B/C 取证等级**，C 类未写成定论。
2. 新增 `app-mobile/scripts/pin-spki.sh`（只读）：默认域名 `api.onepan.cn`（env.ts 字面抄录、注明只读用途）；打印叶子+中间 SPKI-SHA256 base64 + notAfter + 剩余天数（≤30 天 WARN）；不写文件；退出码 0/1/2/3/4。
3. 新增回传卡 `docs/tasks/cards/R101-QODER-12-回传.md` 与本回执、证据 `docs/evidence/qoder-12/**`（9 份 + note）。

## 证据（全部原始输出落盘）

- `bash -n` EXIT=0；真跑 `api.onepan.cn` **EXIT=0**（叶子 `Y/uy8CcE…`，notAfter 2026-11-11、**剩余 23 天 WARN 命中**；中间 YE2）、`m.onepan.cn` **EXIT=0**（叶子 CN=admin.onepan.cn SAN 含 m；中间 YE1）——共 4 条指纹；失败路径 `*.invalid` **EXIT=2**（本卡无门禁，此为"门能红"替代取证；exit 3/4 未现网取证，如实标 C）。
- 任务书原式 openssl 链复跑与脚本文档字节一致（`run-raw-openssl-chain.log`）。
- 红线自证：`git diff 844515d5..HEAD -- app-mobile/src` = **0 行**（`pin-ssl-zero-diff.log` + 0 字节 raw 配 note）——**pin-ssl.ts 零改动，本卡未接线**。
- 提交：`0a6dc7f6`（文档）、`481da38f`（脚本）、`<本卡+证据+回执>`（第三枚，见分支尖）；未 push、未开 PR、逐文件 add。

## 阻塞点

无。A 级新事实提请派单人知悉：**在册 4 条指纹与现网全失配**（生产链已换 Let's Encrypt，TrustAsia 条目整体陈旧），且 `api.onepan.cn` 叶子已进入 30 天窗口（2026-11-11 到期）——接线时点须先重采指纹。口径偏差 2 处（脚本/文档路径按任务书、失败退出码细化为 2）已在回传卡 §五报备。
