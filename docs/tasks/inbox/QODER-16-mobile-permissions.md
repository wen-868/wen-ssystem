# QODER-16 · iOS 隐私描述 + 小程序录音授权

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-20
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-16`
> 分支：`fix/qoder-16-mobile-permissions`｜基线：`origin/main=321b4f6b`
> 红线：不得 push、不得开 PR、不得 `git add -A`；不得改 appid。

## 一、已核实问题

- `app-mobile/src/manifest.json` 的 iOS `privacyDescription` 为空。
- `app-mobile/src/pages.json` 没有小程序录音授权 `scope.record`。
- `ai-chat.vue` 已使用录音能力。

## 二、修复

1. 在 `src/manifest.json` 的 `app-plus.distribute.ios.privacyDescription` 补真实用途中文描述，至少覆盖：
   `NSCameraUsageDescription`、`NSMicrophoneUsageDescription`、`NSPhotoLibraryUsageDescription`、
   `NSLocationWhenInUseUsageDescription`、`NSBluetoothAlwaysUsageDescription`、`NSSpeechRecognitionUsageDescription`。
2. `src/pages.json` 的 `mp-weixin.permission` 补 `scope.record` 中文说明；
   `requiredPrivateInfos` 只登记代码实际使用的隐私 API，不得整表照抄。
3. 若根 `manifest.json` 与 `src/manifest.json` 必须同改，先证明根文件仍被构建使用；否则只改 `src/`，在回传说明。
4. appid、支付、推送、插件配置一律不动。

## 三、验收

- 新增 JSON 权限断言测试，字段缺失或描述为空必须红；反测删任一描述后必红，复原 SHA256 一致。
- `JSON.parse` 两份配置文件通过。
- app-mobile `test` 不劣化、`type-check` 0=0、`lint` 不劣化、`build:h5` EXIT=0。
- 回传逐字段列值，不得只写“已补”。

## 四、回传

`docs/tasks/cards/R101-QODER-16-回传.md`（十项）+ 回执；必须带 DSH-RECEIPT 区块。
