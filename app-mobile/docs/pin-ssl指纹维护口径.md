# pin-ssl 证书指纹维护口径（QODER-12 交付①）

> 派单卡：`docs/tasks/inbox/QODER-12-pinssl指纹口径.md`｜执行：**Qoder（移动端执行方）**｜日期：2026-10-20
> **本卡口径为「不接线」**：`app-mobile/src/utils/pin-ssl.ts` 零改动（`git diff` 见 `docs/evidence/qoder-12/pin-ssl-zero-diff.log`）；接线与否由后续卡另行处理。
> 本口径是 R101-QODER-5-回传.md §二（S3-247 雏形）的扩写与定稿；两处冲突以本文为准并留痕。
> 取证等级标注：**A** = 本机 2026-10-20 亲手复跑命令（原始输出见 `docs/evidence/qoder-12/`）；**B** = 读码/读档定位（给出文件行号）；**C** = 待核实（不得当定论用）。

---

## §一 谁负责更新（在册角色，非"相关人员"）

| 职责 | 角色（在册） | 依据与取证 |
|:--|:--|:--|
| 采指纹、改 `PINNED_CERTS`、提更新 PR | **移动端执行方（Qoder，移动端 agent）** | B：`R101-QODER-5-回传.md` §二"谁更新"既立口径；`pin-ssl.ts` 历史署名 @author 阿澈（该行属存量代码，非职责变更） |
| 证书轮换**生效前**知会并把新证书链送达移动端；轮换日期/CA 选择归口 | **运维/后端侧（证书轮换执行人）** | B：`R101-QODER-5-回传.md` §二；后端与部署归口见 `docs/项目规则.md` 派单体系 |
| 派单、审计与合并落地（PR merge 执行方） | **凌舟（主代理/派单人）**——本文不代其作任何裁定 | B：根 `AGENTS.md` 铁律"凌舟只做四件事：规划、契约维护、派单、审计与验收" |
| 提醒触发后的督办（30 天窗口内确认 PR 已出） | **派单人侧（凌舟会话）**向移动端催办 | C：目前**无自动告警装置**（见 §三-4），督办机制待接线卡或门禁卡落地，不得写成定论 |

**硬性口径**：指纹维护责任**不因"未接线"而豁免**。未接线只是"不发作"（见 §五-1），注释与指纹一旦腐化，接线时点就会踩 MO-13 事故形态——本轮已实际发生一次（见 §三-5 实测读数）。

## §二 从哪取指纹：SPKI 采集命令 + 叶子/中间双指纹成对

### 2.1 指纹格式与采集命令（可复制粘贴）

现 `PINNED_CERTS` 格式为 `sha256/<Base64(SPKI 的 SHA-256)>`（B：`app-mobile/src/utils/pin-ssl.ts:70-83`）。采集链 = `s_client 取证书 → 提取公钥 → 公钥 DER → SHA-256 → base64`：

```bash
# ① 叶子证书 SPKI（任务书原式；2026-10-20 本机复跑 EXIT=0，见 run-raw-openssl-chain.log）
openssl s_client -servername api.onepan.cn -connect api.onepan.cn:443 </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64

# ② 中间证书 SPKI（链内第 2 张，awk 取 PEM 块；同场复跑 EXIT=0）
openssl s_client -showcerts -connect api.onepan.cn:443 -servername api.onepan.cn </dev/null 2>/dev/null \
  | awk '/-----BEGIN CERTIFICATE-----/{n++} n==2' \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64

# ③ 到期日（与指纹同批采集，供 §三 30 天口径判断）
openssl s_client -servername api.onepan.cn -connect api.onepan.cn:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -enddate
```

**推荐入口（本卡交付②）**：`bash app-mobile/scripts/pin-spki.sh [域名]`——只读，一次打印叶子+中间两条 SPKI base64 + `notAfter` + 剩余天数（≤30 天自动 WARN），**不写任何文件、不做接线**。默认域名 `api.onepan.cn` 系字面抄录自 `app-mobile/src/config/env.ts:16` 的 `API_BASE_NATIVE` 回退值 `https://api.onepan.cn/api`（只读取参考）。A：2026-10-20 对 `api.onepan.cn`、`m.onepan.cn` 真跑 EXIT=0，失败路径（不可解析域）EXIT=2，原始输出 `docs/evidence/qoder-12/run-*.log`。

**格式一致性要求**：粘贴进 `PINNED_CERTS` 时须为 `sha256/<上面输出>`（含末尾 `=`），与 `validateCertificate` 的**字符串全等比较**口径一致（B：`pin-ssl.ts:168-173`——比对是 `fingerprint === pinned`，不做大小写/编码归一）。

### 2.2 为什么"叶子 + 中间 CA"双指纹必须成对

1. **中间证书轮换期不断连**：叶子证书短周期轮换（如 Let's Encrypt 约 90 天，A：本次实测 `api.onepan.cn` 叶子剩余仅 23 天）时，只要新叶子仍由**同一中间 CA** 签发，客户端凭中间指纹即可直接连通，**无需等发版**；只 pin 叶子则每次换证书都是一次"全客户端失联倒计时"。B：`pin-ssl.ts:72/:77` 既有注释"中间证书指纹用于轮换兜底"即此设计。
2. **CA 整体切换的过渡**：换中间 CA 时，先在**下一版 App** 内置新中间指纹（旧叶子+旧中间+新中间并存），旧链失效前保留旧指纹，实现无感切换（流程见 §四）。
3. **单 pin 根证书不可取**：根 CA 被多家终端共用、且根周期极长，pin 根会把信任面扩大到攻击者可申领的同根证书；本仓口径固定为**链内第 1 张（叶子）+ 第 2 张（中间）**，不 pin 根。
4. **实测佐证"两条都可能不同"**：`api.onepan.cn` 与 `m.onepan.cn` 当前中间分别是 Let's Encrypt **YE2 / YE1** 两条不同指纹（A：`run-api.onepan.cn.log`、`run-m.onepan.cn.log`）——按域名各自成对维护，**禁止跨域名抄同一条**。

### 2.3 在册条目与现网对照（2026-10-20 读数，A 级；数值会随轮换漂移，引用前先重跑脚本）

| 域名 | 在册指纹（`pin-ssl.ts:74-83`） | 现网实测 | 状态 |
|:--|:--|:--|:--|
| api.onepan.cn 叶子 | `SS6pnMVjm…`（注释：2026-09-15 到期） | `Y/uy8CcEO5D3HHhBa8iBqWJu3uEQwuA1bwRCpuVfcHs=`（LE，notAfter 2026-11-11） | **已过期失配**：现网早已换成 Let's Encrypt 链，在册 TrustAsia 条目整体陈旧 |
| api.onepan.cn 中间 | `X4AGLwdqSLc…`（TrustAsia DV TLS RSA CA 2024） | `s/tdAOmUzd8syaTuqfgGvFcn6DzA5Cmb+Vby1ST+U3Y=`（Let's Encrypt YE2，notAfter 2028-09-02） | **已失配**（CA 已换） |
| m.onepan.cn 叶子 | `JKxBAU4tJIz…`（2026-09-15 到期） | `rH0oqsRgfu1hGtbs10FXorbhao99FC99nqVBGmWA1M4=`（CN=admin.onepan.cn，SAN 含 m.onepan.cn，notAfter 2026-12-22） | **已失配**；叶子与 admin 共用一张证书属正常 SAN 泛化，接线时以指纹全等为准 |
| m.onepan.cn 中间 | `X4AGLwdqSLc…`（TrustAsia） | `sha256/brzvtCELCIZUo4sD/qPX0ccRtPsd3DY6RfmxpOU9oB4=`（Let's Encrypt YE1） | **已失配** |

> 读数结论（A）：**四条在册指纹与现网全部不匹配**。这正是"当前未接线所以不发作"的实例（§五-1）；也证明 30 天提醒口径必须盯**叶子 `notAfter`**（api 叶子 2026-11-11 到期，距采集日 23 天，已在窗口内）。

## §三 何时更新（触发口径，逐条可判定）

1. **域名变更**：`env.ts` / CI 注入的 `VITE_API_BASE` 生产域名变更 ⇒ 同 PR 内为新域名补齐"叶子+中间"两条指纹（B：`env.ts:4-9` 既有口径"域名变更时无需同步更新指纹"仅适用于**未接线状态**；接线后本条转为硬触发）。
2. **证书变更**：服务端主动换证（含提前续期、CA 切换、吊销重签）⇒ 轮换执行人按 §一 在生效前知会，移动端采集新链并出更新 PR。
3. **到期前 30 天提醒（`validTo ≤ 30d` 告警口径）**：对每个在册域名执行"叶子 `notAfter` − 当日 ≤ 30 天 ⇒ 触发"，触发后必须在本轮窗口内完成 §四 同 PR 更新；中间证书同口径盯（`notAfter ≤ 30d` 同样触发，防 CA 链断）。
   - **当前触发手段（未接线态）**：人工运行 `bash app-mobile/scripts/pin-spki.sh <域名>`，脚本对剩余 ≤30 天的证书**自动打印 WARN**（A：2026-10-20 对 `api.onepan.cn` 已实际打出该 WARN，见 `run-api.onepan.cn.log`）。
   - **接线后触发手段**：release 前置检查脚本比对在线 `validTo`，≤30 天即红并点名——此条在 R101-QODER-5 §二登记为**接线卡交付物**（B），当前仓库**尚无此门禁**，**不得**写成已存在（C：`pin-ssl.ts` 的 `CertificateInfo.validTo` 字段仅声明、`validateCertificate` 从不比对时间，见 `pin-ssl.ts:49-50,150-180`）。
4. **固定节拍兜底**：未接线期间，每自然月跑一次脚本对在册两域名留痕（防注释腐化重演——本轮 TrustAsia→Let's Encrypt 的更换就没人追）。C：该节拍是否并入现有发版检查流程，待派单人定，本卡不代裁。
5. **本轮实测触发记录（A）**：`api.onepan.cn` 叶子剩余 **23 天**（notAfter 2026-11-11），采集当日即命中 30 天窗口；`m.onepan.cn` 剩余 64 天未命中。

## §四 轮换流程（同 PR 纪律）

1. **T-7 前**：轮换执行人知会 + 新链就位；移动端用脚本采集**新叶子 + 新中间**两条指纹。
2. **轮换 PR（一笔，指纹+接线状态一起改）**：
   - `PINNED_CERTS` **追加**新叶子、新中间，**保留**旧叶子、旧中间（新旧并存，防"一刀切打挂全部尚未升级的客户端"——老 App 包内置的是旧链指纹，服务端先切新链、旧链观察期内仍可从 CDN/回源可用时客户端才能续命；若服务端一刀换链，旧指纹客户端在观察期即拒连，故并存窗口须覆盖旧包自然淘汰周期）；
   - 同步更新每条指纹的行尾注释（签发方、`notAfter` 日期）；
   - **已接线时**：接线状态注释、应急开关预案在同 PR 复核；**未接线时（现状）**：文件头状态块与 `env.ts:8-9` 注释一并核对，禁止出现"注释说已接线、实际没接"或反之的漂移（本仓 MO-12/MO-13 分叉即此教训，B：`移动端全面审查清单…2026-10-18.md` MO-13 行）。
   - 纪律：**指纹改动与接线状态改动必须同一 PR**，不得拆成"先改指纹、下笔再改注释"——拆 PR 期间仓库处于"码与状态注释互相说谎"的窗口，正是本项目最忌形态。
3. **观察期**：新版本发版且旧包占比降到阈值后（阈值 C：具体百分比/天数口径待接线卡定义，本卡不代裁），**第二笔 PR 只删旧指纹**；删旧同样走"码+注释"同 PR 纪律。
4. **H5/小程序不受影响**：`installSslPinning()` 非 APP-PLUS 分支恒 `false`（B：`pin-ssl.ts:237-240`），浏览器自带 HTTPS 校验；但指纹条目腐化会让**接线决策时点**重新踩坑，所以并存/删旧纪律对未接线期间同样适用。

## §五 失效表现与回滚路径

### 5.1 两种失效形态（不许混淆）

1. **当前形态（未接线，`pin-ssl.ts` 零调用点，B）**：指纹过期/失配 ⇒ **线上无感、不发作**（没有校验在跑）。风险仅两处：a) 注释与真实状态腐化（已发生，见 §二-3 对照表）；b) 接线时点误用陈旧指纹——把"不发作"读成"没问题"就是事故前奏。
2. **接线后 + 指纹过期** ⇒ **全量 TLS 拒连事故**：`validateCertificate` 对 APP-PLUS 所有请求逐条比对指纹，`PINNED_CERTS` 非空且全不匹配即返回 `valid:false` ⇒ 该域名请求**全部失败**，App 表现为登录/接口整段不可用。反测判据口径（接线卡执行）：**伪造指纹 ⇒ 请求必须失败点名，不许静默放行**（B：`pin-ssl.ts:4-9,150-180`；接线前置两条 R101-QODER-5 §二：① 新指纹采齐并在线校验通过、② 原生层（NetworkClient/plus）证书校验事件确认存在且回调可控——当前 JS 侧 `plus.networkEvent.addEventListener('certificateValidate')` 为接口预留、运行时不可用，B：`pin-ssl.ts:207-231`；C：现网原生包实际行为需真机取证）。
3. **接线后 + 对端证书与指纹失配（非过期，如 MITM 或链序变化）**：同样走 `valid:false` 拒连；此为安全预期行为，但运维侧须与 5.2 的应急开关联动，防止误伤变成长时间不可用。

### 5.2 回滚路径（顺序固定，先快后慢）

**第一层（秒级、免发版）**：应急开关关闭 Pinning——服务端远程下发 `{ pinning: false }` ⇒ `setPinningEnabled(false)` 加密落盘 ⇒ `validateCertificate` 首行放行（**仍受 HTTPS 标准校验保护，仅失去 Pinning 额外防护**）。B：`pin-ssl.ts:101-119,151-153`。C：**开关对原生层接线路径是否同样生效未经真机验证**——若接线逻辑落在 NetworkClient 原生侧，JS 开关未必被读取；接线前必须把"开关能红能关"写进反测。
**第二层（小时级）**：第一层不可用/不可信时，**摘接线**——回滚接线提交（或下掉 `installSslPinning()` 调用点）重新构建/发版；未接线态本身即兜底形态，回滚零残留。
**第三层（随版本）**：修指纹——按 §四 出"新旧并存"PR 随下一次发版；**换回旧指纹属慢路径，不得作为事故止血首选**。
**恢复顺序**：确认现网链指纹与在册条目全等 ⇒ 打开应急开关 ⇒ 留观一个发版周期 ⇒ 按 §四-3 清旧。
> 一句话纪律：**先摘中间件/开关止血，后动指纹慢修**；"把指纹改回去再发版救火"= 用小时级路径处理分钟级事故，禁止。

## §六 本卡边界与登记

- 本卡**不接线**：判据 `git diff 844515d5..HEAD -- app-mobile/src` = **0 行**（命令+输出落盘 `docs/evidence/qoder-12/pin-ssl-zero-diff.log`）。
- 脚本 `app-mobile/scripts/pin-spki.sh` **只读**：不写文件、不改码、退出码 0/1/2/3/4 见脚本头注释；失败路径真跑 EXIT=2（A）。
- 接线与否、30 天提醒门禁自动化、观察期阈值、§一-4 督办机制均为**后续卡事项**，本文一律标注为待核实/待裁，不作定论。
