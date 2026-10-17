# QODER-1 · 移动端批次 0：**门禁基线**（先建能红的门）

> 派单人：凌舟｜端/执行：**QODER**｜回传人：QODER 执行人
> 依据：`app-mobile/docs/移动端全面审查清单与修复方案-2026-10-18.md` **附 A**（核查订正版，A 级 19 条）
> ⚠️ 你不是凌舟；不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-1`｜分支 `chore/qoder-1-appmobile-gates`｜基线：`origin/main`

## 一、事实前提（凌舟已亲核）

| 检查 | 读数 |
|:--|:--|
| `.github/workflows/**` 中出现 `app-mobile` | **0 次** |
| `app-mobile/package.json` scripts | 只有 `dev:*/build:*` + `guard:logout` —— **无 lint / test / type-check** |
| S3-245（PR #363）已建 | `app-mobile` 类型门（`vue-tsc --noEmit`，working-directory: app-mobile）——**本单必须复用它，不许另建第二套** |

## 二、交付（4 个门 + 1 份冻结基线）

1. **`type-check`**：复用 S3-245 已接的 `vue-tsc --noEmit`（若 #363 已合，直接引用；未合则在本单同步引入**同一形态**，不许另写）；
2. **`lint`**：接 `eslint src/`（0 error；warning 允许但必须给当前计数做基线）；
3. **`test`**：接一个最小可跑的测试入口（vitest 或 `node --test` 均可），**至少 3 条**：①权限码匹配（通配）②存储加解密往返 ③API 基址/环境变量缺失即失败；
4. **`check:contract`**：新建脚本 `app-mobile/scripts/check-contract.mjs` —— 抽 `app-mobile/src` 里调用的 `/admin/...` 路径，与 `backend/src/routes/**` 的注册路径做**差集**；差集非空 ⇒ **EXIT=1 并逐条打印**（允许具名豁免文件，每条带理由）；
5. **存量冻结基线**：把 `lint`/`type-check`/`check:contract` 的当前读数写进 `app-mobile/scripts/gates-baseline.json`（计数 + 具名清单），CI 判"不劣化"而不是要求一天清零。

## 三、判据（逐条给原始输出）

1. 四条命令各自 **EXIT=0**：`npm --workspace app-mobile run type-check` / `lint` / `test` / `check:contract`；
2. **反测（四条各一次，必红并点名）**：注入 1 个 lint error / 1 个类型错误 / 1 个不存在的契约路径 / 删掉 1 条测试 ⇒ 对应命令 **EXIT≠0 且点名**；复原后逐字节一致（SHA256）；
3. `check:contract` 的差集输出：**0 条或全部具名豁免**（豁免文件每条带理由）；
4. CI：`ci.yml` 新增上述步骤（阻断），YAML 本机校验通过；
5. 不回归既有冻结：后端三守卫（route-auth / evidence-secrets / rbac-wiring --strict）仍 EXIT=0。

## 四、红线

只改 `app-mobile/**`（scripts/package.json/测试）与 `.github/workflows/ci.yml`；**不得改业务逻辑与页面**；不得动 `backend/**`（契约对账只读）；不得碰其它工作树；证据不含口令；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-QODER-1-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-QODER-1.md`；分支自提交，**不 push**。
