# QODER-16R · 隐私权限交付重栈到常驻门禁

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-16`
> 新分支：`fix/qoder-16r-permissions-restack`
> 基线：`d1a6adcf`
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、裁定

QODER-16 的源码落点纠正**认可**：

- iOS 隐私描述与小程序录音授权写入 `src/manifest.json`；
- `pages.json` 不承载已证明不进入产物的重复配置；
- app.json 产物与注入反测作为主证据；
- 作废的 PROBE B 已具名隔离，不据此判绿。

本卡不改业务方案，只解决基线栈偏离。

## 二、动作

1. 从 `d7dafec5` 建新分支并 rebase 到 `d1a6adcf`。
2. 保留原 8 个权限断言用例，接入常驻 vitest。
3. 更新 gates baseline：新增 1 个 spec 文件，tests `5/56 → 6/64`。
4. 不修改 appid、支付、推送、插件；不向 `pages.json` 补死配置。

## 三、验收

- lint 逐规则不劣化；type-check 0=0；test 6 文件 / 64 用例；contract EXIT=0。
- build:h5 / build:mp-weixin 均 EXIT=0；产物 app.json 中 permission、requiredPrivateInfos 读数保持。
- 反测删一个隐私键必红，复原 SHA256 一致后复绿。

## 四、回传

`docs/tasks/cards/R101-QODER-16R-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
