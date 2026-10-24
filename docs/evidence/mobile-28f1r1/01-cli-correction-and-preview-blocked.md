# MOBILE-28F1R1 · 更正证据：CLI 状态与 preview 结论

> 负责人：阿潵（移动端负责人）｜2026-10-25
> 派单卡：`docs/tasks/inbox/MOBILE-28F1R1-preview-and-guard-wiring.md`
> 上游裁定：`docs/tasks/cards/R101-MOBILE-28F1-凌舟验收与裁定-20261024.md` B1 / 裁定 3、4

## 一、更正：上一单"本机无微信 CLI"的结论**失实**

`docs/evidence/mobile-28f1/raw/29-wechat-cli-probe-not-run.txt` 中的两句话自相矛盾：

```text
PATH-CHECK C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat => FOUND
...
结论：本机无微信开发者工具 CLI ⇒ preview 未执行
```

**真实情况（本单实测，见 `raw/10-cli-four-criteria-probe.txt`）**：

| 判据 | 实测 | 结论 |
|:--|:--|:--|
| ① 安装路径存在 | `Test-Path -LiteralPath cli.bat` ⇒ **True**（904 字节，2026-09-29） | 已安装 |
| ② CLI 可执行 | `cli.bat --help` ⇒ 列出 `preview / islogin / open / upload / login …`（HELP_EXIT=0） | 可执行 |
| ③ IDE 已初始化 | `cli.bat islogin` ⇒ `× initialize error: ENOENT … Default\.cli` → 补建目录后变为 `[error] IDE service port disabled` | **未初始化/服务端口关闭** |
| ④ preview 成功 | 见 `raw/40-preview-attempt.txt` | **BLOCKED** |

根因链（逐步实测）：

1. CLI 期望用户数据目录 `…\User Data\2ca4252ffa87560ea1fd48b913e45179\Default\.cli`，该目录**原本不存在**（实际存在的是 `80d7748…` 与 `1a695c…` 两个哈希目录）⇒ 首个 `ENOENT`。
2. 补建 `2ca4252f…\Default` 后，`ENOENT` 消失、`.cli` 生成（`raw/10`），暴露出**第二个**阻断：`IDE service port disabled`。
3. 该错误提示两条出路：交互输入 `y`，或 IDE GUI → 设置 → 安全设置 → 开启服务端口。
   - 管道输入 `echo y | cli.bat islogin` **无效**（CLI 需要真实 TTY，实测仍报同一错误，见 `raw/10`）。
   - 启动 GUI `微信开发者工具.exe`：**进程启动即退出**（`HasExited=True / ExitCode=0`，60 秒内 0 进程存活；`SessionId=3`、`UserInteractive=True`、`SESSIONNAME=Console`）⇒ 无法进设置开端口。

## 二、preview 结论：**BLOCKED（未完成）**

`raw/40-preview-attempt.txt` 记录：

- 命令：`"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" preview --project "…\app-mobile\dist\build\mp-weixin" --port 9420`
- 原始输出含 `× initialize` 与 `[error] IDE service port disabled`
- **`PREVIEW_EXIT=0`**，但输出含错误标记 ⇒ 依卡 §四 红线「不得只看 CLI 退出码」，**不得判绿**
- 三条成功判据：`[1] 无 initialize/error 标记 = False`、`[2] 无 unexpected token = True`、`[3] 有成功输出 = False` ⇒ **未同时满足 ⇒ BLOCKED**

⚠️ 自我报备：我第一次写的判据用了字面 `initialize error` 匹配，而本次输出是 `× initialize` + `[error]`，导致 `[1]` 曾误判为 `True`。已改为同时匹配 `× initialize` / `initialize error` / `[error]` 后重录（同一 `raw/40` 已覆盖为该版本），结论从"疑似通过"纠正为 **BLOCKED**。

**因此：本单不宣称微信运行态通过**；「MP 产物 0 通配」只证明构建产物静态干净，不等于微信侧可预览（卡 §四 红线「不得用构建成功替代微信 preview」）。

## 三、历史证据处理

- `docs/evidence/mobile-28f1/raw/29-wechat-cli-probe-not-run.txt` **原样保留、未改写**（卡 §二.4 要求）。
- 该文件"本机无 CLI"的结论**自本单起不再作为验收依据**，以本目录 `raw/10` / `raw/40` 为准。
- 本单新增证据全部落 `docs/evidence/mobile-28f1r1/**`，不覆盖 28F1。

## 四、解除 BLOCKED 的操作路径（需具备 GUI 的环境）

以下任一条即可，均为**操作者**动作（非本会话可完成）：

1. 在能启动 GUI 的桌面会话打开「微信开发者工具」→ 设置 → 安全设置 → **开启服务端口** → 再跑：
   `cli.bat islogin`（应无 initialize error）→ `cli.bat preview --project <abs> --port 9420`（应出现 `✔` / 预览成功输出）。
2. 或在 CLI 提示交互确认时，由操作者在真实终端里输入 `y` 完成启用。

启用后须复跑 `raw/40` 的同一条命令，并确认三条成功判据同时为真，才能把本单从 BLOCKED 转完成。
