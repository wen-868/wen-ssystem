# QODER-5 · S3-247：三兄弟落地（pin-ssl 口径 / 离线链二选一 / BanksCard 撤销定性）

> 派单人：凌舟｜端：**移动端 → Qoder**｜回传人：Qoder 执行人
> 依据：`R101-手机端收口-五条裁定与派单-凌舟-20261017.md` §一.1（第 81 项，凌舟已亲核）
> ⚠️ 不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-5`｜分支 `fix/qoder-5-orphans`｜基线：`origin/main`

## 一、事实（凌舟实测，勿重查）

| 对象 | 实测 | 定性 |
|:--|:--|:--|
| `BanksCard.vue` | `pages-sub/product/suppliers/detail.vue:255` 真 import、`:137` 有用法 | **在用** ⇒ 撤销"孤儿"，**本单不动它** |
| `pin-ssl.ts` | 全仓**零调用点**，唯一提及是 `config/env.ts:8` 注释；`installSslPinning(` 0 命中；指纹已于 2026-09-15 过期 | **未接线**（不是死代码） |
| `sync-manager.ts` / `local-db` | `sync-manager` 零外部调用点；但 `api/sync.ts`、`native/scan.ts` 引 `local-db` ⇒ **半接线** | 未接线待补 or 下线，**二选一** |

## 二、交付（三件，逐条）

1. **pin-ssl**：给出"**证书指纹维护口径**"（谁在什么时候更新、从哪取指纹、过期如何告警）+ **接线或明确暂不接线**的决定与理由；
   - 若暂不接线：把 `env.ts:8` 的误导性注释改成"**当前未接线**（指纹口径未定，见本卡）"，并在 `pin-ssl.ts` 文件头标注状态；
   - 若接线：必须带**反测**（指纹不匹配 ⇒ 请求失败，不许静默放行）。
2. **离线链**：在"**接线**（补 `onAppLaunch` 调用 + 初始化 local-db + 端到端验收）"与"**下线**（删除 `sync-manager`，并清掉 `scan.ts`/`api/sync.ts` 对 `local-db` 的引用）"之间**二选一**；
   - **禁止保持半接线**（有人引数据层、无人初始化同步链 = 最难查的形态）；选择"下线"时必须给出"删除后无引用残留"的 `rg` 输出。
3. **BanksCard**：不动作，只在回传卡登记"在用（撤销孤儿定性）"。

## 三、判据（逐条给原始输出）

1. `rg -n "installSslPinning|sync-manager|local-db" app-mobile/src` 的**改前/改后**对照；
2. 若选下线：`rg` 残留 **0 命中**；`vue-tsc --noEmit` 0 新增；`npm --workspace app-mobile run test` 全过；`build:h5` EXIT=0；
3. 若选接线：给**端到端**证据（真实发起一次同步 + 一次 pin 校验），并给"摘掉调用 ⇒ 用例必红"的反测；
4. `backend/` 零改动（`merge-base..HEAD` 口径）。

## 四、红线

只改 `app-mobile/**` + 证据/回传卡；不得动后端/迁移/权限码；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-QODER-5-回传.md`（十项），必须含"三对象 × 决定 × 理由 × 判据"总表。
