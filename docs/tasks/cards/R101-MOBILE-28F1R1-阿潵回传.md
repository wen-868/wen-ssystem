【汇报 MOBILE-28F1R1】微信 preview 闭环与守卫接线
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-25
执行通道：WorkBuddy（本卡新开窗口）

## 交付物

| # | 交付物 | 文件路径 | 提交哈希 |
|:--|:--|:--|:--|
| 1 | **守卫接线**：新增 `guard:mp-style` 脚本并串入 `check:gates`（用无构建依赖的 `--src` 模式） | `app-mobile/package.json`（`+2` 行） | `8e03a27a` |
| 2 | 防回归反测五步原始输出（含点名行与 SHA256） | `docs/evidence/mobile-28f1r1/raw/{20,21,22,23,24,25}-*.txt` | `8e03a27a` |
| 3 | **CLI 四判据实测**（安装路径/`--help`/`islogin`/GUI 启动） | `docs/evidence/mobile-28f1r1/raw/10-cli-four-criteria-probe.txt` | `8e03a27a` |
| 4 | **preview 实跑原始输出 + 三条成功判据逐条** | `docs/evidence/mobile-28f1r1/raw/40-preview-attempt.txt` | `8e03a27a` |
| 5 | 更正证据（B1 失实结论 + BLOCKED 解除路径） | `docs/evidence/mobile-28f1r1/01-cli-correction-and-preview-blocked.md` | `8e03a27a` |
| 6 | 本单证据索引 + 三端构建/dist/H5 复跑读数 | `docs/evidence/mobile-28f1r1/README.md`、`raw/{30,31,32,33,34}-*.txt` | `8e03a27a` |
| 7 | 28F1 README 同步"历史结论失效"声明（`raw/29` 原文**未改写**） | `docs/evidence/mobile-28f1/README.md` | `8e03a27a` |

工作树 `D:\Users\ZXQL\wt-agents\MOBILE-28F1R1`｜分支 `mobile/MOBILE-28F1R1-preview-guard-wiring`｜基线 `5f4204bd`（已验证为祖先）。
改动面：`18 files changed, 550 insertions(+), 2 deletions(-)`；**业务代码 `app-mobile/src/**` 零改动**（样式修复沿用 28F1）；未改 tabBar / AI / 后端 / ACL / migrations。

## 证据（可复跑）

### 1. CLI 四判据（`raw/10-cli-four-criteria-probe.txt`）

| 判据 | 命令 | 实测 |
|:--|:--|:--|
| ① 安装路径存在 | `Test-Path -LiteralPath "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"` | **True**（904 B，2026-09-29） |
| ② CLI 可执行 | `cli.bat --help` | 列出 `preview / islogin / open / upload / login / auto` …，`HELP_EXIT=0` |
| ③ IDE 已初始化/已登录 | `cli.bat islogin` | 先 `× initialize error: ENOENT … \Default\.cli`；补建该目录后转为 **`[error] IDE service port disabled`** |
| ④ preview 成功 | 见 §2 | **BLOCKED** |

根因链（逐步实测，非推测）：
1. CLI 期望 `…\User Data\2ca4252ffa87560ea1fd48b913e45179\Default\.cli`，该目录原本不存在（实际存在 `80d7748…`、`1a695c…` 两个哈希目录）⇒ 首个 `ENOENT`。
2. 补建 `2ca4252f…\Default` ⇒ `ENOENT` 消失、`.cli` 生成 ⇒ 暴露第二阻断 `IDE service port disabled`。
3. 该错误要求「输入 `y`」或「IDE 设置 → 安全设置 → 开启服务端口」：`echo y | cli.bat islogin` **无效**（需真实 TTY，仍报同一错误）；启动 GUI `微信开发者工具.exe` ⇒ **`HasExited=True / ExitCode=0`，60 秒内 0 进程存活**（`SessionId=3`、`UserInteractive=True`、`SESSIONNAME=Console`），无法进设置开端口。

### 2. preview 实跑（`raw/40-preview-attempt.txt`）

```
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" preview --project "…\app-mobile\dist\build\mp-weixin" --port 9420
原始输出含：× initialize  /  [error] IDE service port disabled  /  [info] 退出
PREVIEW_EXIT=0
三条成功判据：[1] 无 initialize/error 标记 = False ｜ [2] 无 unexpected token = True ｜ [3] 有成功输出 = False
⇒ BLOCKED（未同时满足）
```

**`PREVIEW_EXIT=0` 但输出含错误标记 ⇒ 依卡 §四 红线不判绿。** 与凌舟现场复跑一致（同样 `initialize error`），并进一步定位到"服务端口关闭 + GUI 无法启动"。

### 3. 守卫接线与防回归反测（`raw/20~25`）

| 步 | 动作 | 读数 |
|:--|:--|:--|
| 1 | `npm run guard:mp-style`（干净态） | `命中 3 / 未隔离 0`、`MP_STAR_GUARD_SRC_PASS`、`EXIT=0` |
| 2 | 记录注入前哈希 | `BEFORE_SHA256=1B9723CEB6900D9263185E4F85351FB26942BB97472AF4F9DD37AFEEC0EF7116` |
| 3 | 向 `more-functions.vue` 注入 `.__probe-28f1r1 * { color:red }`（未隔离） | `INJECTED_SHA256=C53AF4B24B3E577DD1F99C600EEE0A70F5A95478DD3773B491B2E1C13B8BCB10` |
| 4 | `npm run guard:mp-style` | **`GUARD_EXIT=1`**，`✗ 未隔离 pages-sub/admin/more/more-functions.vue:364 ⇒ .__probe-28f1r1 *` |
| 5 | `npm run check:gates`（整链） | type/lint/test(16·329)/contract/guard:request 全绿后，**末尾点名同一处** ⇒ **`CHECK_GATES_EXIT=1`** |
| 6 | `git checkout --` 复原 | `RESTORED_SHA256=1B9723CE…`（= 步 2，逐字节一致） |
| 7 | `npm run check:gates` 复跑 | `MP_STAR_GUARD_SRC_PASS`、`Test Files 16` / `Tests 329`、**`CHECK_GATES_EXIT=0`** |

### 4. 三端构建 / MP 产物 / H5 保留（`raw/30~34`）
- `build:mp-weixin` `BUILD_MP_WEIXIN_EXIT=0`、`build:h5` `BUILD_H5_EXIT=0`、`build:app` `BUILD_APP_EXIT=0`，三者均 `DONE  Build complete.`
- `--dist app-mobile/dist/build/mp-weixin` ⇒ `命中 0 处` / `MP_STAR_GUARD_DIST_PASS` / `DIST_EXIT=0`
- H5 四处行为：box-sizing 通配块 PRESENT ×6、两处 `prefers-reduced-motion` PRESENT、`.create-sale-page *` PRESENT、`uni-form display:block` PRESENT ⇒ `MOBILE_28F1_CONTROLS_PASS`

## 验收自评（逐条对照卡 §三）

| 硬验收 | 自评 | 依据 |
|:--|:--|:--|
| 1 绝对路径执行 `--help`/`islogin`/`preview`，原始输出可复跑；不再用 `where.exe` 单独判定 | **通过** | 证据 §1、§2 |
| 2 preview 成功（无 initialize error、无 unexpected token、有成功输出）；仍被登录/IDE 初始化阻塞则保持 BLOCKED | **未通过 ⇒ 按卡保持 BLOCKED** | 证据 §2：三条判据未同时满足；已如实标注，不报完成 |
| 3 `guard:mp-style` 串入 `check:gates`；注入 ⇒ 点名变红；复原 SHA256 一致 ⇒ 复绿 | **通过** | 证据 §3（步 1–7） |
| 4 三端构建 EXIT=0；MP 产物 0 通配；H5 四处 PRESENT | **通过** | 证据 §4 |
| 5 `check:gates` 16/329 不减少、其余门禁不回归 | **通过** | 步 5 与步 7 均含 `Test Files 16` / `Tests 329` |
| 6 工作树 clean、未 push、未开 PR、逐文件 add | **通过** | 18 文件逐个 `git add`；`git status --short` 空；无 upstream、`refs/remotes/origin/mobile` 无本分支 |

红线自查：未把"文件存在但 IDE 未初始化"写成"没有 CLI"（已更正并声明失效）；未只信退出码（`PREVIEW_EXIT=0` 明确判为不可用）；未用构建成功替代 preview（明确写 BLOCKED）；未删 H5 规则；未改 tabBar/AI/后端。

## 未完成与阻塞

1. **B1 微信 preview：BLOCKED**。卡 §三.2 已允许此路径（"仍被登录/IDE 初始化阻塞则保持 BLOCKED"）。解除需**具备 GUI 的桌面会话**由操作者完成其一：① IDE → 设置 → 安全设置 → 开启服务端口；② 在真实终端交互输入 `y` 启用 CLI。之后复跑 `raw/40` 同一条命令并确认三条判据同时为真。**本单不宣称微信运行态通过。**
2. **`--dist` 产物扫描未接常驻门禁**：CI 的构建后阶段是 `npm run build`（`--workspaces`），app-mobile 的 `dist/` 被 gitignore、路径因端而异，接进去需另立单；当前仅本地手动 `--dist` 复验。⇒ 依据卡 §二.2「未接时不得宣称产物扫描已常驻」，我**如实标注未常驻**。
3. 其余无阻塞。

## 风险与自我报备

1. **上单失实结论由我造成，已更正**：`raw/29` 同时写了 `cli.bat => FOUND` 与"本机无 CLI"，根因是我当时用 `where.exe` 判 CLI（该工具查的是 PATH，而微信 CLI 不在 PATH 上）。本单改为绝对路径四判据，并把 `raw/29` **原样保留、只加失效声明**（未改写历史原文）。
2. **我第一次写的 preview 成功判据差点造成假绿**：字面匹配 `initialize error` 时，本次输出实为 `× initialize` + `[error]`，导致判据 `[1]` 一度为 `True`、综合判定险些写成 SUCCESS。已改为同时匹配 `× initialize` / `initialize error` / `[error]` 后重录（`raw/40` 为该修正版）。这正是卡面警示的"不得只看部分判据"，我把它当自我失误报备。
3. **补建 CLI 用户数据目录属环境副作用**：我为绕开首个 `ENOENT` 手动创建了 `…\2ca4252ffa87560ea1fd48b913e45179\Default`，CLI 随即在其中生成 `.cli`。该目录在 `%LOCALAPPDATA%`（仓库外、不受 git 跟踪），**不影响交付树**；若后续 IDE 正常初始化会自动接管，如需回退删除即可。
4. **IDE GUI 启动即退出**（`ExitCode=0`）原因未定位到更深层（可能是无真正可见桌面/会话限制）。这是 BLOCKED 的直接成因之一，非代码问题；我未尝试绕过（如伪造服务端口配置），以免制造假绿。
5. 环境仍不稳定（PowerShell 内置 cmdlet 间歇不可用、`cmd /c` 内 `cd /d` 不改变外层目录），本轮全部改用绝对路径与逐条 `cmd /c` 包装规避。
6. 移动端台账**未改动**（保持 46 / 18 / 28），记忆文件在办栏仍停在 S3-245（未在本分支改，避免扩大 diff 面）。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-MOBILE-28F1R1-阿潵回传.md`
关联卡：`docs/tasks/inbox/MOBILE-28F1R1-preview-and-guard-wiring.md`
