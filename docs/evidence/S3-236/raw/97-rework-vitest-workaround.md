# S3-236-F1 · DSH 沙箱内跑 vitest 的等价装置（为什么不是 `npx vitest run`）

## 一、问题（原始报错，未删改）

本工作树（DSH 会话，文件沙箱 workspace-write）里，出厂命令

```
cd backend && npx vitest run src/__tests__/shared/batch2-permission-codes.test.ts
```

**起不来**：Vite 用 esbuild 打包 `vitest.config.ts` 时 `child_process` 以管道 stdio spawn esbuild 服务，
本沙箱禁止 pipe spawn ⇒ `Error: spawn EPERM`（原始输出见 `raw/96-rework-stock-vitest-EPERM.txt`，
与上一轮 DSH 会话的 `raw/80-vitest-batch2-attempt2.txt` 同源）。

这是**环境边界**，不是本单代码缺陷；按派单卡红线**未申请提权、未改任何权限**。

## 二、等价装置（全部落在 gitignored 的 `node_modules.bak/dsh/`，不入库）

| 差异点 | 出厂命令 | 本沙箱等价运行 |
|:--|:--|:--|
| vitest 本体 | 同 | `node node_modules/vitest/vitest.mjs`（4.1.10，未改版本） |
| 配置装载 | Vite 默认 `configLoader=bundle`（走 esbuild） | `--configLoader native` + `node_modules.bak/dsh/vitest.rework.config.mjs` |
| 测试池 | 默认 forks（pipe spawn） | `--pool=threads`（worker_threads，无子进程） |
| TS 转译 | Vite 内置 `vite:esbuild` | 临时配置里 `esbuild:false` + `typescript.transpileModule` 插件（同版本 TS 5.9.3，仅去类型） |
| `process.env.NODE_ENV` define | vitest 注入恒等 define，走 `esbuild.transform` | 临时插件清空 define（**恒等替换，语义不变**），vite:define 直接跳过 |
| Vite `net use` 探测 | `child_process.exec` | `node_modules.bak/dsh/preload.mjs` 里对 `net use` 返回空结果 |

除上述"绕过 esbuild 子进程"的机械差异外：**同一 vitest 版本、同一批测试文件、同一套 test 选项
（environment=node / globals / testTimeout=30000 / setupFiles / env）**，断言执行路径一致。

## 三、复跑命令（本节逐字可复跑）

```powershell
cd C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-S3-236\backend
$env:NODE_OPTIONS="--import=file:///C:/Users/XIONG/Documents/Codex/dsh-worktrees/dsh-S3-236/node_modules.bak/dsh/preload.mjs"
node ..\node_modules\vitest\vitest.mjs run --configLoader native --config ..\node_modules.bak\dsh\vitest.rework.config.mjs --pool=threads `
  src/__tests__/shared/migration-c6-4-1.test.ts src/__tests__/shared/batch2-permission-codes.test.ts
```

## 四、交付方需知

- 派单方（凌舟）在不含该 spawn 限制的环境里，用**出厂命令**复跑应为：`Test Files 2 passed (2) / Tests 75 passed (75)`。
- `node_modules.bak/` 与 `node_modules/` 均被 `.gitignore` 覆盖，**不在提交内**；本装置不改变仓库任何文件。
