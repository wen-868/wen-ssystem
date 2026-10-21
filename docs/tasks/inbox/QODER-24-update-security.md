# QODER-24 · 热更新安全（MO-14）

【派单 QODER-24】热更版本、下载域、摘要与跳转全部失败关闭
派单人：凌舟（总负责人）｜2026-10-21
执行方：Qoder（移动端；`D:\Users\ZXQL\wt-agents\QODER-24`）
优先级 / 时间盒：P0 · 一天

## 回传格式（照抄填满）

```
【汇报 QODER-24】QODER-24 热更新安全 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号 + SHA256>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-24-回传.md
关联卡：docs/tasks/inbox/QODER-24-update-security.md
```

## 一、基线与证据

- 基线：QODER-22 尖端 `bc1087ee`；分支：`fix/qoder-24-update-security`。
- `app-mobile/src/utils/update.ts:42-80` 下载 `.wgt` 后直接 `force:true` 安装，无摘要。
- `update.ts:131` 只做版本名等值比较。
- `update.ts:106` 对后端下发的 `updateUrl` 直接 `plus.runtime.openURL`。
- 后端当前 `LatestAppVersion` 无摘要字段；移动端必须失败关闭，不得把“无摘要”当通过。后端补字段另记外部前置，不在本单改后端。

## 二、交付物

1. 增加纯函数版本比较：仅当远端版本为合法 semver 且严格高于当前版本才提示；降级、等值、非法版本均不提示。
2. `packageUrl` 仅接受 `https:`、无用户名/口令、主机与 API 基址同源、路径以 `.wgt` 结尾；其余拒装。
3. `LatestAppVersion` 支持后端未来下发的 `packageSha256`；缺失、格式非 64 位 hex 或下载后实算不一致时，删除临时文件并拒绝安装。
4. 下载后用项目已有能力计算文件 SHA-256；不得只校验长度或首尾片段。若 uni/plus 能力不足，给出可复跑的替代证据并如实标未完成，不得假绿。
5. `updateUrl` 仅允许 `https:` 且主机命中显式白名单；白名单至少覆盖 API 主机和官网下载主机，值必须集中配置，不得散落页面。
6. 增加可单测的 URL/版本/摘要校验用例；反测分别去掉 semver 判断、同源判断、摘要比较、白名单，各轮目标用例必须红并点名，复原后绿。

## 三、硬验收

- `npm --workspace app-mobile run check:gates` EXIT=0。
- `build:h5` / `build:mp-weixin` / `build:app` 均 EXIT=0。
- 四组反测证据完整：`INJECT_EXIT=0`、注入回读、目标测试红、SHA_BEFORE=SHA_AFTER、复跑绿。
- `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean。

## 四、红线

- 不得 push、开 PR、`git add -A` 或改后端。
- 不得信任缺失摘要、HTTP 明文、IP 地址、非标准端口、带凭据 URL。
- 不得继续 `force:true` 直装未验包；不得用 toast“提示不支持”冒充摘要校验已完成。
- 不得把无后端摘要字段的联调写成“通过”；应明确阻塞为后端契约待补。
