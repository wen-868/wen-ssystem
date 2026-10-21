# QODER-28 · 微信/App tabBar 运行态验证

> 派单人：凌舟（总负责人）｜执行方：Qoder｜日期：2026-10-22
> 启动条件：具备 WeChat DevTools 与 Android/iOS App 真机；不具备时保持 BLOCKED，不得用构建替代。

## 回传格式（照抄填满）

```
【汇报 QODER-28】QODER-28 微信/App tabBar 运行态
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<截图/DOM/录屏/设备信息 + 路径>
证据（可复跑）：<设备、构建、操作序列、原始读数>
验收自评：<逐条 通过/未通过/未验 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-28-回传.md
关联卡：docs/tasks/inbox/QODER-28-mp-app-runtime.md
```

## 一、验什么

1. 微信 DevTools 导入 QODER-27 的 `dist/build/mp-weixin`，检查底部只显示一层 `app-tab-bar`，无空白/双栏/报错。
2. 依次切换 home/products/AI/functions/profile，确认目标页出现且高亮正确。
3. 无根级 `src/custom-tab-bar/` 时，确认微信 `custom:true` 的真实行为；记录是否报错或用页内挂载替代原生栏。
4. App 真机 HBuilderX 运行，检查五页底栏只有一层、安全区正常、切换正常。
5. AI 页发送/停止/附件在小程序与 App 实机的可执行状态；不可执行项明确写未验，不得用提示“不支持”掩盖。

## 二、硬验收

- 每端至少一张可识别页面截图 + 操作序列 + 运行时 console/错误读数。
- 若微信双栏或空白，判红并回传最小复现；不得以构建 EXIT=0 判通过。
- App 无设备则本卡整体保持 BLOCKED，不产出“通过”。
- 不修改代码；若需修复另开 F 单。
- 不得 push、不得开 PR、不得 `git add -A`；证据落盘后工作树 clean。
