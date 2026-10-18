# ACTIVE-回执-QODER-5 · S3-247 三兄弟落地

> 执行人：**Qoder（移动端）**｜回执日期：2026-10-18
> 任务书：`docs/tasks/inbox/QODER-5-三兄弟落地.md`｜回传卡：`docs/tasks/cards/R101-QODER-5-回传.md`（十项齐）
> 分支 `fix/qoder-5-orphans`｜基线：**栈于卡 4 尖端 `5e546899`**（偏离裸 origin/main，理由与冲突面见回传卡 §〇，待裁定项 4）
> ⚠️ 未 push、未开 PR、未 `git add -A`；只动了本工作树与本分支。

## 状态：**已交付 · 判据自评全过 · 等凌舟验收/合并**

## 三对象决定（总表在回传卡 §一）

- ① **BanksCard.vue：不动**，撤销孤儿定性（detail.vue:255 真 import / :137 用法，原始输出落盘）；
- ② **pin-ssl.ts：暂不接线**——指纹 2026-09-15 已过期（接线＝APP-PLUS 全量拒连事故）；`installSslPinning` 的证书回调本体在原生层、JS 侧是接口预留（接线即静默放行，违反反测要求）。env.ts 误导注释已改「当前未接线」，pin-ssl.ts 文件头标注状态；**指纹维护口径**（谁更新/从哪取/何时/过期告警/接线前置清单）在回传卡 §二；
- ③ **离线链：下线**——删 `utils/sync-manager.ts`（−653 行）；`scan.ts` 摘本地分支改纯网络（本地表从未写入，行为等价）；`api/sync.ts` 类型内联自持有、`local-db.ts` 反向复用其类型；按任务书字面**保留** local-db/api-sync/sqlite 为零消费能力件（§九-① 待裁是否整链删除）。

## 关键读数（原始输出在 `docs/evidence/qoder-5/`）

- rg 全口径改前 **13**→改后 **5**（5 处全为保留文件 pin-ssl.ts 自身）；离线下划线口径 `sync-manager|local-db` 改前 10→**改后 0 命中**（0 字节日志+note.txt）；
- 四道门：type 0=0、lint error 20=20 / warning 12872（删码 −8，按「只准降」调基线留痕）、**test 5 文件/53 用例全过**（tests 基线代执行裁定②上调 5/53）、contract EXIT=0（读数与基线一致）；
- `build:h5` EXIT=0；`guard:logout` GREEN；
- 后端零改动：`git diff 3fa138e7(merge-base)..HEAD -- backend/` = **0 行**。

## 待凌舟裁定（回传卡 §九 全列）

① 保留件 vs 整链删除；② 离线开单是否仍为产品需求（是⇒接线卡须原生端到端+反测）；③ pin-ssl 接线卡排期（新指纹+原生回调两前置齐后再立）；④ 基线偏离（栈于卡 4 尖端，沿用裁定⑤先例）。

## 红线自查

改动面 = `app-mobile/**` + 证据/回传卡/回执；未动后端/迁移/权限码/CI；BanksCard 零改动；未 push、未开 PR、未 `git add -A`；零字节证据配 note.txt；本回执无「凌舟裁定/验收结论」字样（引用裁定编号仅为依据）。
