# QODER-14F1 · 401 清态补全 + 常驻门禁重栈

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-14`
> 新分支：`fix/qoder-14f1-auth-cleanup-restack`
> 基线：`dfeedbc0`（#368 合并后的 main）
> 红线：不得 push、不得开 PR、不得 `git add -A`；逐文件 add。

## 一、裁定

QODER-14 的 GET-only 与 CSRF 清理方向通过；因基线缺常驻门禁，不能按现分支直接合入。

## 二、动作

1. 从 `7137ab06` 建新分支后 rebase 到 `dfeedbc0`，保留原 14 用例。
2. 401 清态补删 `merchant_tenant`；它与 `merchant_tenant_id` 是两个不同的敏感键。
3. 测试⑫扩展到 `enc_merchant_tenant`，断言 token/user/tenant/tenant_id/csrf 五个敏感键均无残留。
4. 更新 `app-mobile/scripts/gates-baseline.json`：新增本单 1 个 spec 文件，tests `5/56 → 6/70`；不得把其它测试数量写错。
5. `upload()` 另单处理，本卡不碰。

## 三、验收

- 常驻门禁四道全部从 `d1a6adcf` 的可执行入口运行，不得再借入后删除 harness。
- lint 逐规则不劣化；type-check `0=0`；test 6 文件 / 70 用例；contract EXIT=0；build:h5 EXIT=0。
- 反测：摘 GET 判定与摘 `merchant_tenant` 清理分别红；cp 复原 SHA256 一致后复绿。
- `git diff d1a6adcf..HEAD -- backend/` = 0。

## 四、回传

`docs/tasks/cards/R101-QODER-14F1-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
