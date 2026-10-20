# QODER-17 · `--safe-top` 自引用修复

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-20
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-17`
> 分支：`fix/qoder-17-safe-top`｜基线：`origin/main=321b4f6b`
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、已核实问题

`app-mobile/src/App.vue:54` 写成 `--safe-top: var(--safe-top);`，自引用无效；H5/小程序无法得到安全区高度，APP-PLUS 另有覆盖。

## 二、修复

1. 默认值改为 `--safe-top: env(safe-area-inset-top);`。
2. 保留 `#ifdef APP-PLUS` 覆盖为 `var(--status-bar-height)`。
3. 不修改各页面 `var(--safe-top)` 使用点；本卡只修根变量定义。
4. 不改布局数值、页面结构或导航组件。

## 三、验收

- 新增静态断言：`App.vue` 不得出现 `--safe-top: var(--safe-top)`；默认分支必须含 `env(safe-area-inset-top)`；APP-PLUS 覆盖仍在。
- 反测：恢复自引用 ⇒ 断言红；复原 SHA256 一致 ⇒ 绿。
- app-mobile `test` 不劣化、`type-check` 0=0、`lint` 不劣化、`build:h5` EXIT=0。
- H5 浏览器 computed 值取证：根节点 `--safe-top` 可解析，不为空；桌面为 0 属正常。
- App 真机如无设备，如实标“未验”，不得写通过。

## 四、回传

`docs/tasks/cards/R101-QODER-17-回传.md`（十项）+ 回执；必须带 DSH-RECEIPT 区块。
