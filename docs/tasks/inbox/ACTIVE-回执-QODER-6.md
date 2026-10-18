# ACTIVE-回执-QODER-6 · S3-242 跨层漂移 16+1 条定性

> 执行人：**Qoder（移动端）**｜回执日期：2026-10-18
> 任务书：`docs/tasks/inbox/QODER-6-跨层漂移定性.md`｜回传卡：`docs/tasks/cards/R101-QODER-6-回传.md`（十项齐）
> 分支 `chore/qoder-6-crosslayer-drift`｜基线：**栈于卡 5 尖端 `ef0f990f`**（偏离裸 origin/main，理由与合并顺序见回传卡 §〇，待裁项 2）
> ⚠️ 未 push、未开 PR、未 `git add -A`；只动了本工作树与本分支。

## 状态：**已交付 · 判据自评全过 · 等凌舟验收/合并**

## 定性结果（17 行判定表全文在回传卡 §二）

- **16 条 = D1 真漂移**（15× 注册表多写 `/platform` 段 + 1× `deliveries/:deliveryId/status` 方法漂移 POST vs PUT）；每条指到后端 `file:line`（plat:16-49 / ops:61）。
- **追加 1 条（employees×5 wrapper）= D4 误报**：后端 0 注册属实，但 caller 闭包为 0（admin-web 全无引用，连 import 都无）⇒「前端在调/静默失效」前提不成立；D3 等价映射备用 `/api/admin/staff*`。
- **D2 = 0**；运行时实测：`/platform/` 在 app-mobile 仅存在于注册表 15 行，真实调用早已走正确路径 ⇒ 漂移实害是口径污染，非线上 404。

## 交付物

- `app-mobile/scripts/check-contract-drift.mjs`：只跑本清单的定性机（与 check:contract 同套抽取、逐字复制并说明原因）；
- `gates-baseline.json` 新段 `contractDrift`：debt=16（D1+D2，**只准降**）；employees 出现调用方将自动升 D2 ⇒ 21 ⇒ 转红；
- 反测：基线暂调 15 ⇒ EXIT=1 点名 ⇒ 复原 SHA256 一致（`c1fe10e9…`）；
- 证据 `docs/evidence/qoder-6/**`（判定表全文、后端行号、4 份 0-hit 各配 note、四门日志、merge-base 后端 0 改动）。

## 判据自评

test 5/53 全过不劣化｜type-check 0=0｜check:contract、lint 复跑绿｜backend `merge-base..HEAD` 0 文件｜16 条逐条有证据｜D4 盲区说明齐（注册表行对门 4 隐形 + wrapper 无 caller 闭包）⇒ **全过**。

## 待凌舟裁定（回传卡 §八）

1. 台账 §18.9-3「以哪层为准」（卡 A 前置，本卡建议以后端为准）；2. 基线偏离；3. employees 走下线还是改接 staff；4. 漂移机进 CI 是否排期。

## 坑登记（影响既往 rg 证据口径）

Git Bash 对以 `/` 开头的 rg 参数做 MSYS 路径转换 ⇒ **假 0 命中**；本单证据已全部在 `MSYS2_ARG_CONV_EXCL='*'` 态复跑，后续取证请默认带此环境。
