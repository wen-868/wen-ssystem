# S3-231 · 可复核 ref（S3-229 代码交付）

> 目的：回应验收异议「**代码零改动分支是假分支**（空白分支 + 临时 node_modules 跑出的读数不是证据）——
> 验收方只要一个东西：能拿到**同一份代码**跑门禁的可复核 ref」。
> 本文件给出 ref 的**三种等价取得方式**（远端分支 / 自包含 bundle / 瘦 bundle）+ **逐文件 blob 哈希** + **端到端验证记录**。

## 一、ref 标识

| 项 | 值 |
|:--|:--|
| 分支 | `feat/s3-229-store-and-marketing-wiring` |
| 代码 ref（提交） | **`ebbc15e3`**（完整：`ebbc15e30269149152aecd0dbee65792cd2f3676`） |
| 基线（其父链含） | `63ee9775`（派单卡指定基线）＋ `d0062d00`（merge origin/main） |
| 工作树 | `D:\Users\ZXQL\wt-agents\S3-229`（`git status --porcelain` = 空） |

**三种取得方式（任选其一，内容等价）**：

1. **远端分支**（未执行，待授权 —— 派单卡红线「不得 push」）：
   `git fetch origin feat/s3-229-store-and-marketing-wiring && git rev-parse FETCH_HEAD`
2. **自包含 bundle**（已生成、已端到端验证；含完整历史，约 95 MB）：
   `D:\Users\ZXQL\agents-logs\S3-229-ref-ebbc15e3.bundle`
3. **瘦 bundle**（已生成；**前提** = 验收方已有 `63ee9775`，即 main 上的基线提交，体积 ~KB 级）：
   `D:\Users\ZXQL\agents-logs\S3-229-ref-ebbc15e3-thin.bundle`

> 说明：bundle 是由**代码 ref `ebbc15e3`** 生成的；`ebbc15e3` 之后的提交只追加本单的**文档/证据**（S3-231 paperwork），
> **代码文件一个字节都没变**（可用下表的 blob 哈希复核 —— blob 哈希是内容寻址的，任何时刻都指向同一份内容）。

## 二、逐文件 blob 哈希（验收方与自己的副本逐字比对即可确认"同一份代码"）

| 文件 | blob（`git rev-parse <ref>:<path>`） |
|:--|:--|
| `backend/src/routes/demo.routes.ts` | `1812ad572482ae2d178b7876e6931a9b8d3911b3` |
| `backend/src/routes/store-control.routes.ts` | `7a8eb4f14bcaaf6f94cb2b5c7228ae3e40d66f2d` |
| `backend/src/routes/community-marketing.routes.ts` | `ad15cd96faf6eac70e9251b2dae3c42bb5db73b8` |
| `backend/src/routes/points.routes.ts`（仅注释） | `97c395dd289d07d82d2b3fb3cec1d1d2843f91ef` |
| `backend/scripts/rbac-wiring-baseline.json` | `f575cbd3e03f65e12dceff8f252b00dbafed759f` |
| `backend/src/__tests__/routes/rbac-b2-s3-229-store-and-marketing-wiring.test.ts` | `62f4da8191cf0137ca4bd1b0856a6047eab19b03` |
| `backend/src/__tests__/routes/rbac-b2-s3-226-marketing-wiring.test.ts`（状态同步） | `dc20ae68ffa10195fd8309079f9723d1e257616a` |
| `backend/src/__tests__/routes/rbac-g0-wiring.test.ts`（跨批和式） | `5d8477c66a7bc706f89fbe558c79c44adee5c1e4` |

## 三、端到端验证（在**从 bundle 取出的独立副本**上重跑，不使用本工作树的文件）

原始记录：`docs/evidence/S3-231/05-ref-verify.txt`（含完整命令与输出）

| 步骤 | 结果 |
|:--|:--|
| `git init` + `git fetch <bundle> refs/heads/feat/…:refs/heads/verify` + `checkout verify` | 副本 HEAD = `ebbc15e3`（与工作树一致） |
| 关键文件 blob 逐文件比对（8 个） | **一致 8 ／ 不一致 0** |
| 副本上 `node backend/scripts/guard-rbac-wiring.mjs --strict` | **EXIT=0**；全量输出 SHA256 = `4FC6A6C4…DEE4B`，与工作树读数①的 run1/2/3 **逐字节相同** |
| 副本上报告模式 | `已接线（权限码）337 处 ／ 消费者端保护形态 45 处 ／ 查询型 POST（已登记）3 处 ／ 无授权形态 378 处（113 文件）` |
| 副本上 `node docs/evidence/S3-231/tools/derive-counts.mjs` | **EXIT=0**，九字段全 PASS + 守恒式 + 差额分解全 PASS |

> **为什么副本能直接跑**：`guard-rbac-wiring.mjs` 与 `derive-counts.mjs` **只依赖 node 内置模块**（`fs` / `path` / `child_process`），
> 不需要 `node_modules` ⇒ 验收方**不必装依赖**即可复核全部计数；只有 vitest 用例需要依赖（本单 vitest 读数出自工作树，见 `30-full-vitest-after.txt`）。

## 四、验收方最短复核路径（4 条命令）

```bash
# 1) 取 ref（二选一）
git fetch "D:/Users/ZXQL/agents-logs/S3-229-ref-ebbc15e3.bundle" "refs/heads/feat/s3-229-store-and-marketing-wiring:refs/heads/s3229-verify"
git checkout s3229-verify

# 2) 验"同一份代码"（blob 哈希须与 §二 一致）
git rev-parse HEAD:backend/src/routes/community-marketing.routes.ts

# 3) 门禁两侧（无需 node_modules）
node backend/scripts/guard-rbac-wiring.mjs --strict   # 期望 EXIT=0，未登记 0 / 陈旧 0
node docs/evidence/S3-231/tools/derive-counts.mjs    # 期望 EXIT=0，九字段全 PASS

# 4) 跨批计数用例（需依赖；若已 npm ci）
cd backend && npx vitest run src/__tests__/routes/rbac-b2-s3-229-store-and-marketing-wiring.test.ts src/__tests__/routes/rbac-g0-wiring.test.ts
```

## 五、未做的事（如实列出）

1. **未 push**：派单卡红线 4「不得 push、不得开 PR」仍生效 ⇒ 未推远端分支；`gh-ip` / `origin` 上目前**没有**该分支。
   如需远端 ref，请授权后我立即推（或由验收方直接 `git push` 本分支）。
2. 早期"手工 node_modules Junction"仅用于**跑 vitest**（该步需要依赖）；**门禁/计数类读数不依赖它**（§三已证：副本无依赖即可复跑）。
