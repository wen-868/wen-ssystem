<#
  S3-190 装置①（S3-186 run-case.ps1 的参数化版本，可在**任意工作树**上跑）：
  建空库 → 按产品真实路径跑一遍启动期迁移 → 落日志 → 落结构快照。

  与 S3-186 run-case.ps1 的差别只有两点：① $RepoRoot 由参数指定（不靠脚本位置推断）；
  ② 产物目录 $OutDir 由参数指定（默认 <RepoRoot>\docs\evidence\S3-190\outputs）。
  迁移入口仍是 `<RepoRoot>\backend\dist\shared\migration.js` 的 runMigrations()——**产品代码本身**，不是复制品。

  用法：
    powershell -File docs/evidence/S3-190/harness/run-case-any.ps1 -RepoRoot <工作树绝对路径> -DbName s3190_post -Tag post
  可选：
    -WriteGate allow   显式放开 MIG-4 写闸门（诊断用；默认不设 = 产品默认 block）
    -OutDir <目录>     产物目录
    -NoReset           不重建空库（同库复跑用）
#>
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$OutDir = "",
  [string]$WriteGate = "",
  [switch]$NoReset
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path $RepoRoot).Path
if ($OutDir -eq "") { $OutDir = Join-Path $repo "docs\evidence\S3-190\outputs" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$log = Join-Path $OutDir "$Tag-migration.log"
$snap = Join-Path $OutDir "$Tag-snapshot.json"

$mdbBin = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
if (-not $NoReset) {
  & "$mdbBin\mariadb.exe" --host=127.0.0.1 --port=3406 --user=root --skip-ssl `
    -e "DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
}

$env:S3186_REPO_ROOT = $repo
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3406"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = $DbName
$env:JWT_SECRET = "s3190-local-secret"
$env:NODE_ENV = "development"
$env:USE_MOCK_DB = "false"
if ($WriteGate -ne "") { $env:MIGRATION_WRITE_GATE = $WriteGate } else { Remove-Item Env:\MIGRATION_WRITE_GATE -ErrorAction SilentlyContinue }

Set-Location $repo
"### S3-190 用例 $Tag  repo=$repo  db=$DbName  writeGate=$(if ($WriteGate -eq '') { '<未设置=block>' } else { $WriteGate })  $(Get-Date -Format o)" |
  Set-Content -Path $log -Encoding utf8

# ---- 输入指纹（防"跑的不是这份语料/这份代码"）：每个用例都要能自证读的是哪份输入 ----
$migDir = Join-Path $repo "docs\migrations"
$sqlFiles = Get-ChildItem $migDir -Filter *.sql | Sort-Object Name
$fpParts = $sqlFiles | ForEach-Object { "$($_.Name):$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0,16))" }
$sha = [System.Security.Cryptography.SHA256]::Create()
$corpusHash = [System.BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($fpParts -join "`n")))).Replace("-", "").Substring(0, 32)
$unprefixed = (Select-String -Path (Join-Path $migDir "*.sql") -Pattern "SET @s3186_tbl = '" |
  Where-Object { $_.Line -notmatch "SET @s3186_tbl = 't_" } | Measure-Object).Count
$tsSrc = Join-Path $repo "backend\src\shared\migration.ts"
$tsDist = Join-Path $repo "backend\dist\shared\migration.js"
$tsSrcHash = if (Test-Path $tsSrc) { (Get-FileHash $tsSrc -Algorithm SHA256).Hash.Substring(0, 16) } else { "N/A" }
$tsDistHash = if (Test-Path $tsDist) { (Get-FileHash $tsDist -Algorithm SHA256).Hash.Substring(0, 16) } else { "N/A" }
"FINGERPRINT repo=$repo" | Add-Content -Path $log -Encoding utf8
"FINGERPRINT corpus_files=$($sqlFiles.Count) corpus_sha256_32=$corpusHash 缺前缀SET行=$unprefixed" | Add-Content -Path $log -Encoding utf8
"FINGERPRINT migration.ts_sha16=$tsSrcHash dist/migration.js_sha16=$tsDistHash" | Add-Content -Path $log -Encoding utf8
# 用 cmd 重定向落盘：node 输出 UTF-8 字节原样入文件，避免 PowerShell 5.1 转成 UTF-16 造成乱码
cmd /c "node docs\evidence\S3-186\harness\run-migrations.mjs >> `"$log`" 2>&1"
"RUNNER_EXIT=$LASTEXITCODE" | Add-Content -Path $log -Encoding utf8

cmd /c "node docs\evidence\S3-186\harness\snapshot.mjs $DbName `"$snap`" >> `"$log`" 2>&1"

$content = Get-Content -LiteralPath $log -Encoding utf8
$gateSkipped = ($content | Select-String -Pattern "写闸门 block 跳过 CALL" -SimpleMatch).Count
$spMissing = ($content | Select-String -Pattern "ER_SP_DOES_NOT_EXIST").Count
$execErr = ($content | Select-String -Pattern "\[migration\].*失败" ).Count
$seedErr = ($content | Select-String -Pattern "\[seed\].*失败" ).Count
$counts = @(
  "TAG=$Tag",
  "REPO=$repo",
  "DB=$DbName",
  "WRITE_GATE=$(if ($WriteGate -eq '') { 'block(default)' } else { $WriteGate })",
  "CORPUS_SHA256_32=$corpusHash",
  "缺前缀SET行=$unprefixed",
  "migration.ts_sha16=$tsSrcHash",
  "dist_migration.js_sha16=$tsDistHash",
  "写闸门跳过 CALL 条数=$gateSkipped",
  "ER_SP_DOES_NOT_EXIST 次数=$spMissing",
  "safeExec 记失败行数=$execErr",
  "seed 记失败行数=$seedErr",
  "LOG=$log",
  "SNAPSHOT=$snap"
) -join "`n"
$counts | Tee-Object -FilePath (Join-Path $OutDir "$Tag-counts.txt")
