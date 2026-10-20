# QODER-13F1 · pin-ssl 文件头过期文案修正

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`
> 新分支：`fix/qoder-13f1-pin-comment-refresh`
> 基线：`597230c4`（QODER-13 尖端）
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、裁定

并入 QODER-13 追加一笔，不另开长期任务。常量已换现网 Let's Encrypt，文件头仍写“2026-09-15 已过期”会误导后续维护者，必须同步改真。

## 二、动作

1. `pin-ssl.ts:6`：删除“叶子证书已于 2026-09-15 过期”表述，改为“在册指纹已更新为 2026-10-21 现网 Let's Encrypt 值；仍未接线”。
2. `pin-ssl.ts:28`：删除“2026-09-15 到期”，改为当前 api/m 叶子的实际到期日期和轮换提醒口径。
3. 只改注释，不改指纹值、不调用 `installSslPinning()`。

## 三、验收

- `rg -i '2026-09-15|TrustAsia' app-mobile/src/utils/pin-ssl.ts` = 0。
- `installSslPinning(` 调用点仍为 0。
- type-check/lint/test/contract 四门 EXIT=0；test 5/56 不升不降。
- 反测恢复旧文案 ⇒ 静态断言红；复原 SHA256 一致后复绿。

## 四、回传

`docs/tasks/cards/R101-QODER-13F1-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
