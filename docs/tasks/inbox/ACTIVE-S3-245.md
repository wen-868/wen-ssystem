# ACTIVE-S3-245 · `crypto.ts` 重复声明根治 + `vue-tsc` 进 CI

> 派单人：凌舟｜端：**移动端**｜执行/回传：**阿潵**（角色卡 `docs/团队角色卡/阿潵-角色卡.md`）
> ⚠️ 你不是凌舟；不得写「凌舟裁定/验收结论」；只动自己的分支；**不得 push、不得开 PR、不得 `git add -A`**。
> 依据：`docs/tasks/cards/R101-手机端收口-五条裁定与派单-凌舟-20261017.md` §一.4

## 一、问题（凌舟亲跑原始输出）

`npx vue-tsc --noEmit`（app-mobile）报 **12 处**：

```
src/utils/crypto.ts(825,17): error TS2323: Cannot redeclare exported variable 'setSecureStorage'.
src/utils/crypto.ts(825,17): error TS2393: Duplicate function implementation.
… getSecureStorage(837) / removeSecureStorage(858) 同上，共 3 个函数 × 2 类 = 12 处
```

根因：uni-app **条件编译分支**（平台分支）两边都被 tsc 看见 ⇒ 同一导出被声明两遍。
**仓内已有先例**：`app-mobile/src/api/request.ts:9-10` —— "使用 IIFE 包裹避免 vue-tsc 误报重复声明"。

## 二、交付（两件）

1. **根治**：`app-mobile/src/utils/crypto.ts` 照 `request.ts` 的 IIFE/条件编译形态收敛为**单一可见声明**（不得靠 `@ts-ignore`/`skipLibCheck` 掩盖）；
2. **门禁**：把 `vue-tsc --noEmit`（working-directory: `app-mobile`）接进 CI 阻断步骤，口径 = **0 新增**（与既有基线**逐条比对**，不许只比总数）。

## 三、判据（逐条给原始输出）

1. `cd app-mobile && npx vue-tsc --noEmit` ⇒ **12 处全部消失**（贴原文；若仍有其它错误须逐条说明是既存还是新引入）；
2. **反测**：把 crypto.ts 的 IIFE 还原成"双声明"形态 ⇒ `vue-tsc` **必红**（12 处或至少 2 处）且点名 `crypto.ts`；复原后逐字节一致（给 SHA256）；
3. `npm --workspace app-mobile run build:h5` ⇒ EXIT=0；
4. CI 改动：`ci.yml` 新增步骤（阻断）＋ 本机 YAML 校验通过；
5. 不回归既有 CI 三门禁（后端 RBAC/迁移清单/证据密钥守卫仍 EXIT=0）。

## 四、红线

不得改后端与 `admin-web/**`；不得改 `.github/workflows/` 以外的东西去"绕过"；证据不得含口令明文；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-S3-245-阿潵回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-245.md`；分支 `feat/s3-245-crypto-iife-tsc-gate`。
