# QODER-17F1 · safe-top 补 viewport-fit + 常驻门禁重栈

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-17`
> 新分支：`fix/qoder-17f1-safe-top-viewport`
> 基线：`dfeedbc0`（#368 合并后的 main）
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、裁定

`--safe-top: env(safe-area-inset-top)` 修复本身正确，但 `app-mobile/index.html` 缺少 `viewport-fit=cover`，iOS 真机仍会得到 0。两处同属安全区根链，本卡必须一起收口。

## 二、动作

1. 从 `3f301248` 建新分支并 rebase 到 `dfeedbc0`，保留 3 个 safe-top 用例。
2. `index.html` viewport 补 `viewport-fit=cover`，不得改其它 meta。
3. 增加断言：viewport 同时含 `width=device-width` 与 `viewport-fit=cover`。
4. 更新 gates baseline：新增 1 个 spec 文件，tests `5/56 → 6/59`。

## 三、验收

- 常驻四门通过：lint 不劣化、type 0=0、test 6/59、contract 0；build:h5 EXIT=0。
- 静态反测：删 `viewport-fit=cover` ⇒ 红；恢复 SHA256 一致 ⇒ 绿。
- H5 computed 取证保留；App 真机无设备仍标未验，不写通过。

## 四、回传

`docs/tasks/cards/R101-QODER-17F1-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
