# QODER-18 · `upload()` 死导出处置

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-18`
> 分支：`fix/qoder-18-upload-dead-code`
> 基线：QODER-14F1 验收后的尖端（卡面由凌舟后续补 SHA）
> 状态：**等待 QODER-14F1 完成**，与 14F1 同改 `request.ts`，禁止并行抢文件。
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、已核实

- `app-mobile/src/api/request.ts:211` 导出 `upload()`；
- `app-mobile/src` 与 `app-mobile/tests` 无任何调用/import；
- 实际上传均走 `api/modules/products.ts` 与 `api/modules/profile.ts` 的独立封装。

## 二、动作

1. 删除死导出 `upload()` 及仅它使用的分支；不得顺手改实际上传封装。
2. 增加静态断言：`request.ts` 不再导出 `upload`，全仓不存在从 request 导入 upload。
3. 若删除会影响任何 type/contract 读数，必须举证并更新基线。

## 三、验收

- 常驻四门绿；build:h5 EXIT=0；backend 0 行。
- 反测重新导出死函数 ⇒ 断言红；复原 SHA256 一致 ⇒ 绿。
- 回传明确此卡关闭移动端 MO-10，而不是改写实际上传链路。

## 四、回传

`docs/tasks/cards/R101-QODER-18-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
