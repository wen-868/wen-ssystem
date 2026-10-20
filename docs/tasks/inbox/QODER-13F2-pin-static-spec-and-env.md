# QODER-13F2 · pin-ssl 静态断言独立 + env.ts 旧文案

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`
> 新分支：`fix/qoder-13f2-pin-static-spec-and-env`
> 基线：`61514b02`（QODER-13F1 尖端）
> 红线：不得 push、不得开 PR、不得 `git add -A`。

## 一、裁定 QODER-13F1 三点

1. **不认可**把 pin-ssl 三条静态断言塞入“GCM tag 校验”用例。测试名与断言对象不一致，失败时无法直观判断守护对象；卡内“56 不升不降”与新增断言确实矛盾，由凌舟修卡，执行方不应以语义错配换数字不变。
2. 第三笔把扫描移到 import 阶段，方向正确，作为必要性能修正接受。
3. `config/env.ts:8` 同源假话必须收口，并入本卡。

## 二、动作

1. 从 `61514b02` 建新分支。
2. 撤回 `storage-crypto.spec.ts` 中混入的 pin-ssl 三条断言与相关文件扫描代码，恢复该测试只测 AES/GCM 业务。
3. 新增 `app-mobile/tests/pin-ssl-static.spec.ts`，独立 `it` 断言：
   - pin-ssl 文件头不含 `2026-09-15`、不含 `TrustAsia`；
   - `installSslPinning(` 调用点仍为 0；
   - 文件头保留现网 api/m 叶子到期日期。
4. 修正 `src/config/env.ts:8` 的“指纹已过期”旧文案，指向当前有效 LE 指纹与“未接线”真实状态。
5. gates baseline：QODER-13F1 当前 `5/56`，本卡新增 1 个 spec、1 个 `it` ⇒ `6/57`。

## 三、验收

- `rg -in '2026-09-15|trustasia' app-mobile/src` = 0。
- `installSslPinning(` 调用点 0。
- type/lint/test/contract 四门 EXIT=0；test 6 文件 / 57 用例。
- 反测：恢复任一条旧文案、或加一处 install 调用，独立 spec 红；复原 SHA256 同形态一致后绿。
- 只改 pin-ssl 注释、env 注释、测试与 baseline；不改指纹常量和业务实现。

## 四、回传

`docs/tasks/cards/R101-QODER-13F2-回传.md`（十项）+ 回执；带 DSH-RECEIPT 区块。
