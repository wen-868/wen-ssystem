# R101-C6-1B 证据目录说明（墨 · 前端）

日期：2026-09-25 ｜ 工作区：`D:\Users\ZXQL\wt-agents\issue-109`（分支 `agent/issue-109`，**未提交**，沙箱内 git 索引只读）

本目录只放**可复跑**的原始输出，用于凌舟验收 C6-1B。所有命令均可在本工作区原样粘贴。

| 文件 | 含义 | 复跑命令 |
|---|---|---|
| `01-check-api-paths-prefix.log` | 路径比对脚本对**改前**前端（`HEAD` 版 `saas-admin/src/api/*.ts` 副本）的输出：D1/D2 真缺陷**当时是红的** | ① 导出改前副本：见下"改前副本导出"；② `node saas-admin/scripts/check-api-paths.mjs --api-dir=<副本目录> --no-color` |
| `02-vue-tsc-baseline.log` | `vue-tsc -b` 在**改前**（本卡未改任何源文件）的完整输出：17 条既有错误 | `cd saas-admin; npx --no-install vue-tsc -b` |
| `03-antitest-red.log` | **反测①**：临时向 `saas-admin/src/api/monitor.ts` 植入不存在路径 `/platform/library/definitely-not-exist` → 脚本**红**（exit 1，指向该行） | 见下"反测复现" |
| `04-antitest-green.log` | **反测②**：删除植入行后脚本**转绿**（exit 0） | `node saas-admin/scripts/check-api-paths.mjs --no-color` |
| `05-vue-tsc-after.log` | `vue-tsc -b` 在**改后**的完整输出：与 `02` **逐行一致**（0 新增、0 消失，本卡 10 个文件 0 错误） | `cd saas-admin; npx --no-install vue-tsc -b` |
| `06-vue-tsc-strict-temp.log` | 临时加严配置（`noUnusedLocals/noUnusedParameters`）下的全量输出：本卡文件仅 2 条**既有**告警（`AppVersions.vue:227`、`LibraryReviews.vue:128`） | 临时 `tsconfig.c61b-temp.json`（extends `./tsconfig.json` + 两个 noUnused*），跑完已删除，见卡内说明 |
| `07-check-api-paths-after.log` | 路径比对脚本对**改后**前端的输出：PASS（仅 1 条豁免＝本卡外新发现） | `node saas-admin/scripts/check-api-paths.mjs --no-color` |
| `08-build-blocked.log` | `cd saas-admin && npm run build` 在本沙箱的失败原始输出：`Error: spawn EPERM`（esbuild 起子进程被沙箱拒绝，见 `docs/踩坑日志.md` [118]）⇒ **构建门禁必须由凌舟在本机/CI 执行** | `cd saas-admin; npm run build` |

## 改前副本导出（`01` 的输入，可复跑）

```powershell
cd D:\Users\ZXQL\wt-agents\issue-109
$tmp = Join-Path $env:TEMP 'c61b-prefix-api'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
foreach ($f in (Get-ChildItem saas-admin\src\api -Filter '*.ts' | Select-Object -ExpandProperty Name)) {
  [System.IO.File]::WriteAllLines((Join-Path $tmp $f), (git show ("HEAD:saas-admin/src/api/" + $f)))
}
node saas-admin/scripts/check-api-paths.mjs --api-dir="$tmp" --no-color
```

## 反测复现（`03`/`04`）

在任意 `saas-admin/src/api/*.ts` 中临时新增一条**后端不存在**的路径，例如：

```ts
export function __antiTestFakePathApi() {
  return request.get('/platform/library/definitely-not-exist')
}
```

跑 `node saas-admin/scripts/check-api-paths.mjs` ⇒ 必红（exit 1，报出该文件行号）；删除该函数 ⇒ 必绿（exit 0）。本次反测的两次原始输出即 `03`/`04`。

## 未在本沙箱执行的部分（如实标明）

- `npm run build`：沙箱拒绝 `node:child_process` 起子进程（`spawn EPERM`），vite/esbuild 拉不起来 ⇒ 见 `08`。
- D1 的**运行时** 404/200 验证：同上，本沙箱无法启动后端（`tsx`/`vite` 均依赖 esbuild 子进程）⇒ 卡内给出静态路由级证据 + 凌舟可复跑命令，**未**声称已做运行时验证。
- `npx vue-tsc -b --noEmit`：该命令在本机 TS 5.5.4 下**本身非法**（`error TS5094: Compiler option '--noEmit' may not be used with '--build'`），故改用等价可跑命令 `vue-tsc -b`（`01`/`05` 即其输出）。
