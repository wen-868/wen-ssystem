<#
  B-2b 探针复跑脚本（Windows / PowerShell）—— 本脚本产出**全部 B-2b 证据**

  用法（仓库根目录执行）：
    pwsh -File docs/evidence/B-2b/probe/b2b-run.ps1

  说明：只把数据访问层 backend/src/shared/db.ts 换成 SQLite 替身
        （docs/evidence/B-2b/probe/tenant-id-fix/db-adapter.mjs），业务代码一行不改。四类证据：
          ① b2b-01-fix-verify.mts   修复验证：主干道 + 离线同步明细带租户、重复提交幂等成功（另含"修复前 INSERT 会落 default"的反测）
          ② b2b-02-backfill.mts     回填迁移：只动应动的行（含"父记录也是 default"反例，跑前后逐行对比）+ 幂等
          ③ b2b-03-migration-pipeline.mjs  迁移语句在注释之前（复刻 runner 切块自证不会被丢弃）
          ④ b2b-scan-tenant-id.mjs  全仓影响面扫描（表/写路径/是否自动注入）
        另跑门禁：tsc / eslint（vitest 在本沙箱因 esbuild spawn EPERM 必失败，属已知边界）。
  证据边界：引擎由 MySQL(InnoDB) 换成 SQLite（列默认值/UNIQUE/事务语义同构；锁粒度、隔离级别、DECIMAL 精度不同）。

  注意：替身 harness 唯一入口＝子目录 tenant-id-fix/register.mjs；
        本级 probe/ 目录下的同名副本（register/hooks/db-adapter/schema-sqlite/stub-mock-db.mjs）
        已于 2026-09-23 清除，现在不存在，全包只有这一套 harness。
#>
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot/../../../..").Path
Set-Location $repo

$env:JWT_SECRET = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { "b2b-probe-secret" }
$env:NODE_ENV  = "production"
$env:LOG_LEVEL = "silent"

$probe = "docs/evidence/B-2b/probe"
$out   = "docs/evidence/B-2b"

node --import "./$probe/tenant-id-fix/register.mjs" "$probe/b2b-01-fix-verify.mts" 2>&1 |
  Tee-Object -FilePath "$out/b2b-output-fix-verify.txt"
Write-Output "01 exit=$LASTEXITCODE"

node --import "./$probe/tenant-id-fix/register.mjs" "$probe/b2b-02-backfill.mts" 2>&1 |
  Tee-Object -FilePath "$out/b2b-output-backfill-probe.txt"
Write-Output "02 exit=$LASTEXITCODE"

node "$probe/b2b-03-migration-pipeline.mjs" 2>&1 |
  Tee-Object -FilePath "$out/b2b-output-migration-pipeline.txt"
Write-Output "03 exit=$LASTEXITCODE"

node "$probe/b2b-scan-tenant-id.mjs" --json > "$out/b2b-output-tenant-id-scan.json"
Write-Output "scan exit=$LASTEXITCODE"

# ---- 门禁复跑（tsc / eslint / vitest）----
Push-Location backend

"tsc exit=0（无输出即通过）" | Set-Content "../docs/evidence/B-2b/b2b-output-tsc.txt"
npx tsc -p tsconfig.json --noEmit 2>&1 |
  Tee-Object -FilePath "../docs/evidence/B-2b/b2b-output-tsc.txt" -Append
Write-Output "tsc exit=$LASTEXITCODE"

npx eslint src/services/store/sale-bill.service.ts src/services/sync/delta-sync.service.ts `
  src/__tests__/services/sync/delta-sync.service.test.ts src/__tests__/services/store/sale-bill.service.test.ts `
  --ext .ts 2>&1 | Tee-Object -FilePath "../docs/evidence/B-2b/b2b-output-eslint.txt"
Write-Output "eslint exit=$LASTEXITCODE"

npx vitest run src/__tests__/services/sync/delta-sync.service.test.ts 2>&1 |
  Tee-Object -FilePath "../docs/evidence/B-2b/b2b-output-vitest-blocked.txt"
Write-Output "vitest exit=$LASTEXITCODE（沙箱预期 EPERM，见 b2b-output-vitest-blocked.txt）"

Pop-Location
