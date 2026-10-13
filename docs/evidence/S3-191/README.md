# S3-191 证据包（第 19/20 项）

> 执行方：阿坚（后端 / 构建脚本）｜日期：2026-10-14
> 工作树：`D:\Users\ZXQL\wt-agents\S3-191`｜分支 `fix/s3-191-dynamic-import-esm`｜基线 `origin/main` = `3922cc43`
> 用途：凌舟复跑本包内的每一条命令，都能得到与回执一致的原始输出（脚本全部留在库内，未跑完即删）

## 一、结论速览

| 编号 | 结论 | 关键读数 |
|:--|:--|:--|
| 第 19 项 | **成立且已修**：`scripts/fix-esm-extensions.js` 不处理动态 `import()` ⇒ 产物保留无扩展名动态相对导入 | 修复前 `backend/dist` 无扩展名动态相对导入 **19 处**（5 个文件）→ 修复后 **0 处**；静态侧前后均 0 |
| 第 19 项运行期 | **已实证**：`POST /api/miniapp/pay/notify` 由 `Cannot find module` 500 → **HTTP 200** | 真库 + 构造回调：`{"code":"SUCCESS","message":"非成功交易，忽略"}` |
| 第 20 项 | **不成立**：7 个路由文件均可被严格 UTF-8 解码，工具可读，无非法字节 | 7/7 `OK`；`git ls-files --eol` 全部 `i/lf w/crlf attr/`（无编码属性） |
| 第 20 项附带发现 | 6 个文件**残留** U+FFFD 替换字符（历史编码事故的痕迹，非非法字节） | 合计 **65 处**：alert 12 / customer-merge 12 / export 12 / miniapp-order-sync 1 / stock-check 16 / sys-config 12；payment 0 |

## 二、复跑命令（按序）

```powershell
# 0) 前置：工作树已就绪，node_modules 为指向主仓 node_modules 的 junction
cd D:\Users\ZXQL\wt-agents\S3-191

# 1) 枚举产物里的「缺扩展名」导入（红=1 / 绿=0）
node docs\evidence\S3-191\enum-imports.mjs backend\dist          # 期望：静态 0 / 动态 0

# 2) 构建（含补扩展名脚本）
cd backend; npm run build                                        # 期望：TSC_EXIT=0；"修复 1869 处导入路径（其中动态 import() 19 处）"

# 3) 解析 + 真实加载全部动态相对导入目标
cd ..; $env:USE_MOCK_DB='true'; $env:NODE_ENV='development'
node docs\evidence\S3-191\harness\resolve-and-load.mjs backend\dist   # 期望：目标文件缺失 0；加载失败 0

# 4) 门禁
node backend\scripts\guard-route-auth.mjs        # EXIT=0
node backend\scripts\guard-tenant-status.mjs     # EXIT=0
node backend\scripts\guard-route-prefix.mjs      # EXIT=0
cd backend; npx tsc -p tsconfig.json --noEmit    # EXIT=0（0 行输出）
npx vitest run                                   # 652 files / 7694 tests / 0 failed

# 5) 第 20 项编码复核
cd ..
node docs\evidence\S3-191\harness\encoding-check.mjs backend\src\routes\alert.routes.ts backend\src\routes\customer-merge.routes.ts backend\src\routes\export.routes.ts backend\src\routes\miniapp-order-sync.routes.ts backend\src\routes\stock-check.routes.ts backend\src\routes\sys-config.routes.ts backend\src\routes\payment.routes.ts
git ls-files --eol -- backend/src/routes/*.routes.ts
```

## 三、运行期实证（真实产物 + 真库）

装置：本机私有 MariaDB 11.4.5（`127.0.0.1:3406`，`--skip-grant-tables`），库名 `s3191_rt`（可丢弃的一次性库）。

```powershell
# 建库 + 跑产品迁移（复用 S3-186 装置）
& D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin\mariadb.exe --host=127.0.0.1 --port=3406 --user=root --skip-ssl `
  -e "DROP DATABASE IF EXISTS s3191_rt; CREATE DATABASE s3191_rt DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
$env:S3186_REPO_ROOT='D:\Users\ZXQL\wt-agents\S3-191'; $env:DB_HOST='127.0.0.1'; $env:DB_PORT='3406'; $env:DB_USER='root'; $env:DB_PASSWORD=''; $env:DB_NAME='s3191_rt'; $env:JWT_SECRET='s3191-local-secret'; $env:NODE_ENV='development'; $env:USE_MOCK_DB='false'
node docs\evidence\S3-186\harness\run-migrations.mjs

# 灌一条一次性支付配置（仅本机一次性库，生产零写操作）
& ...\mariadb.exe --host=127.0.0.1 --port=3406 --user=root --skip-ssl --database=s3191_rt -e "INSERT INTO t_payment_config (tenant_id, provider, config_key, config_value, is_encrypted, description, sort_order, api_v3_key, enabled) VALUES ('S3191RT','wechat','','',0,'S3-191 运行期验证用一次性配置',1,'S3191RuntimeProofKey0123456789ab',1);"

# 起真实产物
cd backend; $env:PORT='8092'; $env:HOST='127.0.0.1'; node dist/server.js

# 造一条 AES-256-GCM 回调报文并 POST
node docs\evidence\S3-191\harness\make-notify-payload.mjs S3191RuntimeProofKey0123456789ab NOTPAY S3191-NOTPAY-1 docs\evidence\S3-191\logs\payload-notpay.json
# POST /api/miniapp/pay/notify  →  期望 HTTP 200 {"code":"SUCCESS","message":"非成功交易，忽略"}
```

## 四、原始输出索引（logs/）

| 文件 | 内容 |
|:--|:--|
| `enum-before.txt` | 修复前：静态 0 / 动态 19（逐条 文件:行:字面量） |
| `enum-after.txt` / `enum-after-final.txt` | 修复后：静态 0 / 动态 0 |
| `enum-antitest.txt` | 反测（脚本动态分支复原）：静态 0 / 动态 19（红） |
| `runtime-mock-fixed.txt` | mock 模式两探针（500 business message，非模块错误） |
| `runtime-real-db-fixed.txt` | 真库 + 真产物：**HTTP 200** `{"code":"SUCCESS","message":"非成功交易，忽略"}` |
| `runtime-real-db-final.txt` | **反测复原后的最终产物**（凌舟要验收的那份 dist）再跑一次：**HTTP 200**（同一报文），日志 `server-real-db-final.out.log` |
| `runtime-real-db-antitest.txt` | 反测：同一报文 **HTTP 500** `Cannot find module '...dist/services/wechat-pay.service'` |
| `resolve-and-load.txt` | 21 处动态相对导入 → 目标文件全部存在；7 个目标模块逐个 import OK |
| `no-false-positive.txt` | 包名/node 内置动态 import 未被误改；`.js.js` 双扩展名 0 处 |
| `gate-*.log` | guard-route-auth / guard-tenant-status / guard-route-prefix / tsc / vitest 原始输出 |
| `item20-*.txt` | 7 文件编码判定表、`git ls-files --eol`、U+FFFD 逐行码点 |
| `src-dynamic-imports-nontest.txt`、`src-tests-dynamic-extensionless.txt` | 源码侧同形写法清单（非测试 / 测试） |
| `server-*.log`、`migrate-s3191_rt.log` | 启动与迁移全量日志（含反测侧） |
| `fix-esm-extensions.fixed.bak` | 修复版脚本备份（sha256 `5D681EED7C039F9074D04B7F468FA4FD6BFCBCBEC3095D9B1681825DA65DFF1A`，反测复原后比对该值） |

## 五、脚本说明（harness/）

| 脚本 | 作用 |
|:--|:--|
| `../enum-imports.mjs` | 枚举产物里缺扩展名的静态/动态相对导入，退出码 0=绿 |
| `harness/resolve-and-load.mjs` | 把动态相对导入解析成文件并断言存在，再真实 `import()` 一次 |
| `harness/make-notify-payload.mjs` | 用 api_v3_key 构造微信支付 v3 回调报文（与 `decryptResource` 同构） |
| `harness/encoding-check.mjs` | 严格 UTF-8 解码 + U+FFFD 计数 + 非 ASCII 计数 |
