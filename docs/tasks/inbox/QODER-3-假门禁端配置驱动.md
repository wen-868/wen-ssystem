# QODER-3 · S3-244：假门禁根治（端配置驱动 + appid 唯一性 + 进 CI）

> 派单人：凌舟｜端：**移动端 → Qoder**｜回传人：Qoder 执行人
> 依据：`R101-手机端收口-五条裁定与派单-凌舟-20261017.md` §一.2/§一.3（第 79 项）
> ⚠️ 不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-3`｜分支 `chore/qoder-3-miniapp-release-gate`｜基线：`origin/main`（含 #363）

## 一、问题（凌舟已亲核）

| 检查 | 读数 |
|:--|:--|
| `scripts/check-miniapp-release.mjs` 扫描面 | `walk("miniapp")` —— **只扫老微信原生端**；`app-mobile`（uni-app）与 `platform-miniapp`（Taro）**都不覆盖** |
| CI | 只在 `package.json:41` 挂 `test:miniapp-release`，`.github/workflows/**` 里 **0 命中** |
| appid | `app-mobile/src/manifest.json:101` 与 `platform-miniapp/project.config.json:2` **同值**（测试 appid） |

## 二、交付（三件）

1. **端配置驱动**：把脚本改成读一张 `scripts/release-gates.json`（每端一组：`root` / 入口文件 / API 基址断言 / 禁止串 / appid 取值处），**每端独立判定**：
   - `miniapp`（老原生端）：保持现有判据（`localhost` / `demoMode` / `touristappid` / `api.onepan.cn` / 确认收货三断言）；
   - `app-mobile`：`manifest.json` 的 `mp-weixin.appid` 非空且非 `touristappid`；源码无 `localhost`；API 基址走 env；
   - `platform-miniapp`：`project.config.json.appid` 非空且非 `touristappid`；
   - **appid 唯一性**：`app-mobile` 与 `platform-miniapp` 的 appid **不得相同**（具名豁免文件可放行，每条带理由）。
2. **进 CI**：作为 `build-and-test` 的阻断步骤（`node scripts/check-miniapp-release.mjs`）；
3. **覆盖矩阵**：脚本自身输出"端 × 判据"表（每端每判据 PASS/FAIL + 扫描文件数），证明不再漏端。

## 三、判据（逐条给原始输出）

1. 覆盖矩阵：3 端 × 各自判据逐行；每端至少 1 条"该端专属判据"被真跑（不是空转：给扫描文件数 >0）；
2. **反测四条**：① `app-mobile` 注入 `localhost` ⇒ 红并点名端+文件；② `platform-miniapp` appid 改成 `touristappid` ⇒ 红；③ 两端 appid 改成同值 ⇒ 红（appid 唯一性）；④ 老端删掉"确认收货" ⇒ 红；全部复原 ⇒ 绿（SHA256 一致）；
3. CI：`ci.yml` 新增步骤（阻断），YAML 本机校验；
4. 不回归：既有 `test:miniapp-release` 语义（老端三条）仍全部生效。

## 四、红线

只改 `scripts/**`、`package.json`、`.github/workflows/ci.yml`、证据/回传卡；**不改业务代码与页面**；不得改 `platform-miniapp/**` 的真实 appid（本单只做判据，换 appid 由平台侧另行处理）；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-QODER-3-回传.md`（十项）+ 回执。
