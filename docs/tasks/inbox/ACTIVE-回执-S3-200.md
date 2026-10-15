# ACTIVE 回执 · S3-200（工具与卫生：根 `npm run build` 口径 ＋ 6 文件 65 处 U+FFFD）

```
【汇报 R101-S3-200】第 62 项根 build 口径已修（`--if-present`，只链有 build 的 5 个工作区）：改前 EXIT=1 → 改后 EXIT=0，反测两侧齐（临时回退 ⇒ 又红）；第 61 项 6 文件 65 处 U+FFFD 全部按 git 历史原文还原（逐处给 commit+行、前后 sha256、复扫 0 处），并新增可独立复跑的编码守卫 `backend/scripts/guard-utf8-encoding.mjs`（注入 ⇒ 红 / 复原 ⇒ 绿）；门禁全绿：tsc --noEmit 0、四条 guard 0、全量 vitest 654 files / 7718 tests / 0 failed
汇报对象：凌舟（总负责人）
汇报人：阿坚（构建/前端 · 本地子代理通道 /root/s3203_ajian）｜2026-10-14
交付物：工作树 D:\Users\ZXQL\wt-agents\S3-200｜分支 chore/s3-200-build-and-encoding｜基线 origin/main = fc6651a5｜HEAD = 2b6bb160（e4d868f5 + 2b6bb160；本地提交，未 push、未开 PR）
  ① package.json（+1/−1）②~⑦ 6 个路由文件（+7/−7）⑧ backend/scripts/guard-utf8-encoding.mjs（新增 153 行）⑨ docs/evidence/S3-200/（README + 3 脚本 + 14 组原始输出）
证据（可复跑）：docs/evidence/S3-200/README.md §三 逐条命令；关键原始读数见本回执 §三 / §四
验收自评：卡面 §三（三条判据）、§四（两条反测）—— 逐条见 §四 / §五
未完成与阻塞：无阻塞；有 3 项需你裁定（见 §六）
风险与自我报备：见 §七（含 1 处**误改主检出**的主动交代）
回传要求：本汇报已落卡：docs/tasks/cards/R101-S3-200-阿坚-回传.md
关联卡：docs/tasks/inbox/archive/ACTIVE-S3-200-20261014.md
```

派单人：凌舟（总负责人）｜2026-10-14
汇报人：阿坚（构建/前端）｜2026-10-14

---

## 一、交付物（逐文件 + 哈希 + 状态）

工作树 `D:\Users\ZXQL\wt-agents\S3-200`｜分支 `chore/s3-200-build-and-encoding`｜基线 `origin/main = fc6651a5`｜HEAD = `2b6bb160`。
提交：**`e4d868f5`**（`chore: 根 build 改为只链有 build 的工作区（--if-present）（S3-200，收口总清单第 62 项）`）+ **`2b6bb160`**（`fix: 还原 6 文件 65 处 U+FFFD 注释（按 git 历史原文）+ 新增编码守卫（S3-200，收口总清单第 61 项）`）；**均为本地提交，未 push / 未开 PR**；`git status` 干净。

| 文件 | sha256(16) 前 → 后 | numstat | 改动 |
|:--|:--|:--|:--|
| `package.json` | `C232B3303A210679` → `3FCD2274C96F0F78` | +1 / −1 | `"build": "npm --workspaces run build"` → `"npm --workspaces --if-present run build"` |
| `backend/src/routes/alert.routes.ts` | `E8674D271BEDDC19` → `4F2646F302DA4A92` | +1 / −1 | L14 注释还原 |
| `backend/src/routes/customer-merge.routes.ts` | `FACEAD1101C54F1B` → `D18D20246399DBAD` | +1 / −1 | L11 注释还原 |
| `backend/src/routes/export.routes.ts` | `A555263F524BF8D7` → `F70E8C388AD4D800` | +1 / −1 | L19 注释还原 |
| `backend/src/routes/sys-config.routes.ts` | `7C0A90E38890F8AC` → `BFC46E634B1CD1FE` | +1 / −1 | L19 注释还原 |
| `backend/src/routes/stock-check.routes.ts` | `6A7EC58F6052E6D1` → `C93CB0013E40B8C6` | +2 / −2 | L19、L27 两处注释还原 |
| `backend/src/routes/miniapp-order-sync.routes.ts` | `DFE0E51CC22E0C9E` → `B9248A5C0B35CFF0` | +1 / −1 | L9 注释还原 |
| `backend/scripts/guard-utf8-encoding.mjs` | （新增） → `E217F2E4034533F2` | +153 / −0 | 新增编码守卫（纯 node、零依赖） |
| `docs/evidence/S3-200/` | — | 新增 18 文件 | README + 3 复跑脚本 + 14 组原始输出 |

**未动**：`.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/数据库变更清单.md`、`docs/踩坑日志.md`、`docs/tasks/inbox/ACTIVE.md`（路由表）、`docs/memories/**`、业务逻辑（7 行改动**全是注释行**，无一行代码）。生产库零写操作、未删任何工作树。
**行尾**：6 个路由文件改后仍 `i/lf w/crlf`（`git ls-files --eol` 逐文件复核），未发生整文件行尾漂移。

---

## 二、第 61 项：65 处 U+FFFD 的"能不能恢复"与恢复来源（**全部可恢复**）

### 2.1 影响面（技术债铁律②：给数字）

全仓扫描（排除 `node_modules/.git/dist/coverage/test-results/storage/logs`，含 `.md`）：**6 个文件 / 65 处**，与卡面给的数字**完全一致**，**无遗漏文件**。源码之外（`docs/**` 等）**0 处**。

### 2.2 破坏机理与"为什么不能自恢复"

事故是**有损**转换（非法字节 ⇒ 容错替换成 U+FFFD ⇒ 写回），文件此后是**合法 UTF-8**，故 `git`/`node`/编辑器全不报错。以 `alert.routes.ts:14` 为例，损坏行 39 个码点里只剩 `·`(U+00B7) 与 `Զ`(U+0536) 两个残留字符，中文原文（8 字）**已不可能从损坏文本自身推出** ⇒ 必须去 git 历史 / 同款完好文件取原文。

### 2.3 逐处恢复来源（commit + 行）

| 处 | 文件:行 | 还原后文本 | 来源（commit:行） | 独立旁证 |
|:--:|:--|:--|:--|:--|
| 1 | `alert.routes.ts:14` | `// ========== 路由自动发现配置 ==========` | `ba7b2aa7:14` | 现存完好件 `backend/src/routes/payment.routes.ts:24` **逐字相同** |
| 2 | `customer-merge.routes.ts:11` | 同上 | `ba7b2aa7:11` | 同上 |
| 3 | `export.routes.ts:19` | 同上 | `ba7b2aa7:19` | 同上 |
| 4 | `stock-check.routes.ts:27` | 同上 | `ba7b2aa7:29` | 同上 |
| 5 | `sys-config.routes.ts:19` | 同上 | `ba7b2aa7:12` | 同上 |
| 6 | `stock-check.routes.ts:19` | `// ==================== Store 盘点路由 ====================` | `ba7b2aa7:21` | **同文件同类先例**：`82e8f347`（R47-05）已把同一次事故毁掉的 Admin 段标题按同款口径修好，HEAD `L5` 现存 `// ==================== Admin 盘点路由 ====================` 与历史**一字不差** |
| 7 | `miniapp-order-sync.routes.ts:9` | `// ========== 订单同步日志列表（分页+筛选） ==========` | `b33ffaaf:8` | — |

**逐文件汇总：可恢复 65 处 / 不可恢复 0 处** ⇒ 按卡面 §二.5 全量还原；**没有一处需要"凭空重写"**，也没有进入"等裁定"的不可恢复清单。

### 2.4 事故来源与"损坏行此后未被再动过"的证明

- 事故提交：`b33ffaaf`（2026-07-13 R25-A5）一次毁掉 5 个文件；`miniapp-order-sync.routes.ts` 是 `ab826ef0`（2026-07-16 R40-07）。
- 逐行比对"事故当次 blob"与 HEAD：5 个文件**逐行完全相同**（损坏行自那次起没人再动）；`stock-check.routes.ts` 事故时 3 行 ⇒ 现在 2 行，差的那条**正是 `82e8f347` 修好的 Admin 行** ⇒ 反证"损坏行 ↔ 历史行"的对应关系成立。

---

## 三、第 62 项：`miniapp` / `platform-miniapp` 为何没有 `build`，以及本单为何取 (b)

### 3.1 现状核实（原始输出）

`package.json` 的 `build` = `npm --workspaces run build`；7 个工作区里 **5 个**有 `build`（`backend`/`admin-web`/`saas-admin`/`website`/`app-mobile`），**`miniapp`/`platform-miniapp` 没有**：

```
miniapp            build=<MISSING>     # 只有 build:weapp / build:weapp:a|b|c / build:weapp:all / build:h5
platform-miniapp   build=<MISSING>     # 只有 build:weapp / build:h5
```

两处证据说明它们**不是"漏配"**，而是"构建方式就不是单一 `build`"：

1. `miniapp` 的规范化构建是**端＋主题**矩阵：`build:weapp`（默认主题 a）、`build:weapp:all`（a/b/c 三主题 → `miniapp/template-dist/{a,b,c}`，**服务器生成租户小程序代码包的前置**，见 `current-tasks.md` R96 段与 `backend/src/services/admin/miniapp-package.service.ts:123`）；`docs/部署链路对照表.md:42` 记 **「小程序 miniapp … 不上服务器」**。
2. `platform-miniapp` 是 R98-01（`73cd2e1a`）新增的小程序工程，同样只有 `build:weapp` / `build:h5`。
3. `git log -p -- miniapp/package.json` 显示该文件**从未出现过 `build` 脚本**；根脚本自引入起就与它不兼容 ⇒ 这是**长期存量**（S3-190/193/194、S3-139 都已如实报过红），非任一单引入。
4. CI 从不跑根 build：`.github/workflows/ci.yml` 只逐工作区构建 `backend` / `admin-web` / `saas-admin`（`rg '\-\-workspace' ci.yml`）⇒ 根 build 是**开发者便利口径**。

### 3.2 选择与理由（**取 (b)**）

取 **(b) 根 build 只链"确实有 `build` 的工作区"**，不取 (a) 给两个小程序补 `build`。理由：

- **`miniapp` 没有"单一 build"可补**：补 `build:weapp` 只代表"主题 a 的 weapp"、不产 `template-dist`；补 `build:weapp:all` 则是三套 Taro 构建，等于把服务器前置构建塞进每个人的根 build。任选其一都是**把任意口径写成"标准"**，反而会让人误以为"根 build 过了 ⇒ 小程序产物齐了"。
- CI 口径、部署事实（不上服务器）、历史（从未有 `build`）三者一致指向同一结论：这两个工程按端/主题单独构建，(b) 与真实语义最贴合。
- **不硬编码 5 个 workspace 名单**：本仓第 22 项已登记"G2 域文件清单硬编码 4 条 ⇒ 域扩张无感"这一缺陷形状；`--if-present` 自动涵盖"将来新增且确有 `build`"的工作区，**改动面只有 1 个词**（最小改动）。

### 3.3 产物正确性（前后哈希对照）

| 工作区产物 | 文件数 / 字节 | 改前汇总 sha256 | 改后汇总 sha256 | 结论 |
|:--|:--|:--|:--|:--|
| `admin-web/dist` | 418 / 5174076 | `a4df56e682d5ad48…` | `a4df56e682d5ad48…` | **逐字节一致** |
| `saas-admin/dist` | 90 / 3334687 | `5e9c3a700f7c2e6e…` | `5e9c3a700f7c2e6e…` | **逐字节一致** |
| `website/dist` | 8 / 277213 | `25b3acd1b04316ed…` | `25b3acd1b04316ed…` | **逐字节一致** |
| `app-mobile/dist` | 465 / 2926574 | `e697ce85d77630e0…` | `e697ce85d77630e0…` | **逐字节一致** |
| `backend/dist` | 799 / 4071753 → 4071669 | `14494f6a82206ae2…` | `705a54593ada413c…` | **变化 84 字节，且已被注释改动解释干净** |

`backend/dist` 变化的机理与字节账（不是行为变化）：`backend/tsconfig.json` **未设 `removeComments`**（TS 默认 `false`）⇒ 注释会进产物；`backend/dist/routes/alert.routes.js` 里能直接看到还原后的 `// ========== 路由自动发现配置 ==========`。字节差 = 5 行横幅（65→49，−16×5）+ Store 段标题（67→63，−4）+ 订单同步标题（68→68，0）= **−84**，与实测 `4071753 − 4071669 = 84` 完全吻合。

---

## 四、验收自评（逐条对照卡面）

| 卡面判据 | 结果 | 依据（原始输出） |
|:--|:--|:--|
| §三.1 根 `npm run build` EXIT=0（含选 (b) 的输出原文） | ✅ | `outputs/04-after-root-build.log`（570 行）：5 个工作区依次 `> backend/admin-web/saas-admin/onepan-website/zhixiang-app-mobile … build`，`DONE Build complete.`，无一行 `npm error`；`EXIT=0` |
| §三.2 65 处逐处判定 + 恢复来源 + 前后 sha256 + 语义 diff 规模 | ✅ | 本回执 §一（sha256 表）、§二（7 处逐条来源）；还原脚本逐行输出 `outputs/03-restore-log.txt`（含改前码点、改后文本、前后 sha256）；语义 diff = **7 行注释、0 行代码**（`git show --numstat` = +7/−7） |
| §三.3 门禁：`vitest run` 0 failed、`tsc --noEmit` 0、三条 guard EXIT=0 | ✅ | `outputs/08-vitest-full.log` = **654 files / 7718 tests / 0 failed**（202.12s，EXIT=0）；`outputs/06-tsc-noemit.log` = EXIT=0；`guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` 均 EXIT=0（`outputs/07-*.log`） |
| 现况核实（§二.1）：说清为何没有 `build` | ✅ | 本回执 §三.1（四条证据） |
| 影响面数字（技术债铁律②） | ✅ | 全仓 **6 文件 / 65 处**，无遗漏、无第二处语料（§二.1） |

---

## 五、反测（两侧齐）

| 项 | 红侧（故意制造失败） | 绿侧（复原） | 结论 |
|:--|:--|:--|:--|
| **第 62 项** | 把根脚本**临时回退**成 `npm --workspaces run build` ⇒ `npm run build` **EXIT=1**，`npm error workspace miniapp@0.1.0 / Missing script: "build"`、`npm error workspace platform-miniapp@0.1.0 / Missing script: "build"`（`outputs/10-anti-test-62-red.log`，584 行） | 复原为 `--if-present` ⇒ 同一命令 **EXIT=0**（`outputs/11-anti-test-62-green.log`，570 行） | 两侧齐：**同一棵树、只差那一个词 ⇒ 1 变 0** |
| **第 61 项** | 把已还原的 `alert.routes.ts:14` **按历史损坏行的真实 65 字节**重新注入 ⇒ 守卫 **EXIT=1** 并点名 `backend/src/routes/alert.routes.ts:14`（`outputs/09-anti-test-61.log`） | 复原 ⇒ 守卫 **EXIT=0**，且文件 sha256 回到 `4f2646f302da4a92…`（与改前一致） | 两侧齐：`ANTI_TEST_61_OK`（复跑脚本 `scripts/anti-test-61.mjs`） |

---

## 六、未完成与阻塞

**阻塞：无。** 下列 3 项是**权限内做不了 / 需要你裁定**的事，本单未擅自代裁：

1. **`--if-present` 的"静默跳过"边界要不要收口**：若将来有人把某工作区的 `build` 删掉/改名，根 build 会**静默跳过**它而仍然是绿的（这是本方案的唯一残留风险）。收口办法（包装脚本列出"构建/跳过"两张清单，或显式 workspace 清单）都**超出"改一个词"的卡面范围**，故未做，请你定口径。
2. **新增守卫是否接进 CI**：`backend/scripts/guard-utf8-encoding.mjs`（纯 node、零依赖、可独立复跑）能防这类"合法 UTF-8 但内容残缺"的复发，但**接线要改 `.github/**`，那是本单红线**，未动。
3. **是否把 `82e8f347` 那种"同款先例修法"与本次"65 处自 2026-07-13 躺了 3 个月"写进 `docs/踩坑日志.md`**：本单未改该文件（不在卡面范围，避免越界）。

---

## 七、风险与自我报备

1. **（主动交代，做错过一次）** 我第一次改根 `build` 时**误改到了主检出** `D:\Users\ZXQL\ZXQL-MS\wen-ssystem\package.json`（应为工作树）。发现后**立即用反向 patch 原样还原**，并以两条只读命令双证为空：`git status --porcelain -- package.json`（无输出）与 `git diff -- package.json`（无输出）。此后所有改动均在 `wt-agents/S3-200` 内完成，最终 `git status` 只有本单的 8 项改动。
2. **`--if-present` 的静默跳过**已写进 `docs/evidence/S3-200/README.md` §四.2 与本回执 §六.1，**没有藏在"全绿"里**。
3. **我把证据包提交进了分支**（`docs/evidence/S3-200/`，约 235 KB，含 build 日志与测试日志全文）。若你希望证据不入库，我可把该目录从提交中摘掉，只留回执里的读数。
4. **我未改 `docs/tasks/inbox/ACTIVE.md`（路由表）**：它现在被 11 个并行会话共用（s3190~s3203），删/归档它会**打断 s3201/s3202 同伴**。工作区入口指令里"把 `ACTIVE.md` 移入 archive"是**单卡时代的写法**，本次按"只归档**我自己的卡**"执行（`archive/ACTIVE-S3-200-20261014.md`）。这是**有意偏离**，请你知悉。
5. **卡面未内嵌回传格式（派单规范 R8 要求）**：本卡无「回传格式」块，我按 `docs/tasks/派单规范.md` §三 十项**自我对齐**，故本回执含全部十项。若口径不同请指出。
6. **未做生产/数据库任何操作**（本单不涉及）；**未 push、未开 PR、未删工作树**。
7. **同署名并发**：`docs/memories/阿坚-记忆.md` **未改**（本轮多个"阿坚"本地子代理并行，改同一记忆文件会互相覆盖），请按你既有做法统一落一笔。
