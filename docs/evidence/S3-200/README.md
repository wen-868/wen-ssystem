# S3-200 证据包（根 `npm run build` 口径 · 6 文件 65 处 U+FFFD 还原）

> 派单：`docs/tasks/inbox/ACTIVE-S3-200.md`（收口总清单第 62、61 项）
> 工作树：`D:\Users\ZXQL\wt-agents\S3-200`｜分支 `chore/s3-200-build-and-encoding`｜基线 `origin/main = fc6651a5`
> 依赖安装口径与 CI 相同：`npm ci --legacy-peer-deps`

## 一、本包覆盖的两件事

| 项 | 一句话 | 关键读数（本包内原始输出） |
|:--|:--|:--|
| 第 62 | 根 `build` 从 `npm --workspaces run build` 改为 `npm --workspaces --if-present run build`——**只链声明了 `build` 的工作区**（5 个），`miniapp` / `platform-miniapp` 不再撞 `Missing script` | 改前 `EXIT=1`（`01`/`10`）；改后 `EXIT=0`（`04`/`11`） |
| 第 61 | 6 个路由文件里 7 行被编码事故破坏的注释，**逐行按 git 历史原文还原**（共 65 处 U+FFFD → 0） | 改前 65 处（`03` 逐行码点）；改后 `guard:utf8-encoding` PASS（`07-guard-utf8-encoding.log`） |

## 二、目录

```
scripts/  restore-fffd-comments.mjs  —— 按 git 历史原文还原（逐行打印码点 + 前后 sha256）
          hash-artifacts.mjs         —— 各工作区产物「逐文件 sha256 + 汇总 sha256」，用于前后对照
          anti-test-61.mjs           —— 第 61 项反测（注入 U+FFFD ⇒ 判红；复原 ⇒ 判绿）
outputs/  01 基线根 build（改前，红）      02 基线产物哈希（改前）
          03 还原脚本逐行输出             04 修好后根 build（绿）
          05 产物哈希（改后）             06 tsc --noEmit
          07 四条 guard                  08 全量 vitest
          09 第 61 项反测                 10 第 62 项反测·红侧（临时回退脚本）
          11 第 62 项反测·绿侧（复原脚本）
```

## 三、复跑顺序（工作树根目录执行）

```powershell
npm ci --legacy-peer-deps
node backend/scripts/guard-utf8-encoding.mjs                      # 期望 EXIT=0
npm run build                                                     # 期望 EXIT=0（570 行，无 npm error）
npm --workspace backend run typecheck                             # 期望 EXIT=0
node backend/scripts/guard-route-auth.mjs                         # 期望 EXIT=0
node backend/scripts/guard-tenant-status.mjs                      # 期望 EXIT=0
node backend/scripts/guard-route-prefix.mjs                       # 期望 EXIT=0
npm --workspace backend test                                      # 期望 654 files / 0 failed
node <本包>/scripts/anti-test-61.mjs <工作树绝对路径>              # 期望 ANTI_TEST_61_OK
node <本包>/scripts/hash-artifacts.mjs <工作树绝对路径> backend/dist admin-web/dist saas-admin/dist website/dist app-mobile/dist
```

## 四、两个需要留意的地方（写在明处）

1. **`backend/dist` 的哈希会变**，其余 4 个产物哈希**逐字节一致**：`backend/tsconfig.json` 未设
   `removeComments`（TS 默认 `false`）⇒ 注释会进产物，注释还原后产物随之变化。
   字节账：5 行横幅 `65→49`（−16×5）、`stock-check` 的 Store 段标题 `67→63`（−4）、
   `miniapp-order-sync` 的标题 `68→68`（0） ⇒ 合计 **−84**，与实测 `4071753→4071669` 完全吻合。
2. **`--if-present` 是"静默跳过"**：若将来有人把某个工作区的 `build` 脚本删掉/改名，
   根 build 会**静默跳过**它而仍然绿。要把它变成"响亮失败"，需另加包装脚本或显式清单
   ——两者都超出本单（本单只改一个词），**留待凌舟裁定**。
