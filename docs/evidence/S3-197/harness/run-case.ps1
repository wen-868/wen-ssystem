<#
  S3-197 装置④：建空库 → 按产品真实路径跑一遍启动期迁移 → 落日志 → 落结构快照 → 落计数。

  与 S3-190 的 run-case-any.ps1 的差别（本单强制口径）：
    ① 数据库换成 **MySQL 8** —— 卡面强制：本轮迁移/DDL 结论必须用 MySQL 8，MariaDB 会给出假绿（踩坑 [158]）；
       主口径 = **8.0.46**（与 CI 的 migration-check 同版本，见 S3-194 回执 §五「版本敏感性」）；
       8.0.28 仅作版本敏感性对照（其 `173 ALGORITHM=INSTANT` 2 条为版本伪红，已在 S3-194 定性）；
    ② 迁移入口仍是 `<RepoRoot>\backend\dist\shared\migration.js` 的 runMigrations()——产品代码本身。

  用法：
    powershell -File docs/evidence/S3-197/harness/run-case.ps1 -RepoRoot <工作树绝对路径> -DbName s3197_post -Tag post
  可选：
    -WriteGate allow   显式放开 MIG-4 写闸门（默认不设 = 产品默认 block）
    -OutDir <目录>     产物目录（默认 <RepoRoot>\docs\evidence\S3-197\outputs）
    -HarnessDir <目录> 装置目录（默认 = 本脚本所在目录；被测工作树若没有本装置，用它指过来即可）
    -MysqlHome <目录>  MySQL 8 安装目录（默认 = D:\Users\ZXQL\wt-agents\_s3194-evidence\mysql8046\mysql-8.0.46-winx64）
    -Port <端口>       MySQL 8 端口（默认 3456 = 8.0.46；8.0.28 用 3455）
    -NoReset           不重建空库（同库复跑用）
#>
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$OutDir = "",
  [string]$HarnessDir = "",
  [string]$MysqlHome = "D:\Users\ZXQL\wt-agents\_s3194-evidence\mysql8046\mysql-8.0.46-winx64",
  [string]$Port = "3456",
  [string]$WriteGate = "",
  [switch]$NoReset
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path $RepoRoot).Path
if ($HarnessDir -eq "") { $HarnessDir = $PSScriptRoot }
$HarnessDir = (Resolve-Path $HarnessDir).Path
if ($OutDir -eq "") { $OutDir = Join-Path $repo "docs\evidence\S3-197\outputs" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$log = Join-Path $OutDir "$Tag-migration.log"
$snap = Join-Path $OutDir "$Tag-snapshot.json"

$m8 = (Resolve-Path $MysqlHome).Path
$mysqlExe = Join-Path $m8 "bin\mysql.exe"
if (-not $NoReset) {
  & $mysqlExe --host=127.0.0.1 --port=$Port --user=root --ssl-mode=DISABLED `
    -e "DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
  if ($LASTEXITCODE -ne 0) { throw "MySQL 8 建库失败（exit=$LASTEXITCODE）" }
}

$env:S3197_REPO_ROOT = $repo
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = $Port
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = $DbName
$env:JWT_SECRET = "s3197-local-secret"
$env:NODE_ENV = "development"
$env:USE_MOCK_DB = "false"
if ($WriteGate -ne "") { $env:MIGRATION_WRITE_GATE = $WriteGate } else { Remove-Item Env:\MIGRATION_WRITE_GATE -ErrorAction SilentlyContinue }

Set-Location $repo
"### S3-197 用例 $Tag  repo=$repo  db=$DbName  mysqlHome=$m8  port=$Port  writeGate=$(if ($WriteGate -eq '') { '<未设置=block>' } else { $WriteGate })  $(Get-Date -Format o)" |
  Set-Content -Path $log -Encoding utf8

# ---- 输入指纹（防"跑的不是这份语料/这份代码"）----
$migDir = Join-Path $repo "docs\migrations"
$sqlFiles = Get-ChildItem $migDir -Filter *.sql | Sort-Object Name
$fpParts = $sqlFiles | ForEach-Object { "$($_.Name):$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0,16))" }
$sha = [System.Security.Cryptography.SHA256]::Create()
$corpusHash = [System.BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($fpParts -join "`n")))).Replace("-", "").Substring(0, 32)
$unprefixed = (Select-String -Path (Join-Path $migDir "*.sql") -Pattern "SET @s3186_tbl = '" |
  Where-Object { $_.Line -notmatch "SET @s3186_tbl = 't_" } | Measure-Object).Count
# 093 缺陷指纹：`CREATE INDEX … ON <裸表名>`（表名没有 t_ 前缀、无反引号）
$bareIndexOn = (Select-String -Path (Join-Path $migDir "*.sql") -Pattern "^CREATE\s+INDEX\s+\S+\s+ON\s+[A-Za-z]" |
  Where-Object { $_.Line -notmatch "ON\s+`?t_" } | Measure-Object).Count
$tsSrc = Join-Path $repo "backend\src\shared\migration.ts"
$tsDist = Join-Path $repo "backend\dist\shared\migration.js"
$tsSrcHash = if (Test-Path $tsSrc) { (Get-FileHash $tsSrc -Algorithm SHA256).Hash.Substring(0, 16) } else { "N/A" }
$tsDistHash = if (Test-Path $tsDist) { (Get-FileHash $tsDist -Algorithm SHA256).Hash.Substring(0, 16) } else { "N/A" }
"FINGERPRINT repo=$repo" | Add-Content -Path $log -Encoding utf8
"FINGERPRINT corpus_files=$($sqlFiles.Count) corpus_sha256_32=$corpusHash 缺前缀SET行=$unprefixed 093裸表名CREATE_INDEX_ON=$bareIndexOn" | Add-Content -Path $log -Encoding utf8
"FINGERPRINT migration.ts_sha16=$tsSrcHash dist/migration.js_sha16=$tsDistHash" | Add-Content -Path $log -Encoding utf8

# 用 cmd 重定向落盘：node 输出 UTF-8 字节原样入文件，避免 PowerShell 5.1 转成 UTF-16 造成乱码
cmd /c "node `"$HarnessDir\run-migrations.mjs`" >> `"$log`" 2>&1"
"RUNNER_EXIT=$LASTEXITCODE" | Add-Content -Path $log -Encoding utf8

cmd /c "node `"$HarnessDir\snapshot.mjs`" $DbName `"$snap`" >> `"$log`" 2>&1"

$content = Get-Content -LiteralPath $log -Encoding utf8
$gateSkipped = ($content | Select-String -Pattern "写闸门 block 跳过" -SimpleMatch).Count
$noSuchTable = ($content | Select-String -Pattern ": 跳过 (ER_NO_SUCH_TABLE)" -SimpleMatch).Count
$execErr = ($content | Select-String -Pattern "\[migration\].*失败").Count
$seedErr = ($content | Select-String -Pattern "\[seed\].*失败").Count
$counts = @(
  "TAG=$Tag",
  "REPO=$repo",
  "DB=$DbName",
  "MYSQL_HOME=$m8",
  "MYSQL_PORT=$Port",
  "WRITE_GATE=$(if ($WriteGate -eq '') { 'block(default)' } else { $WriteGate })",
  "CORPUS_SHA256_32=$corpusHash",
  "缺前缀SET行=$unprefixed",
  "093裸表名CREATE_INDEX_ON=$bareIndexOn",
  "migration.ts_sha16=$tsSrcHash",
  "dist_migration.js_sha16=$tsDistHash",
  "HARNESS=$HarnessDir",
  "ER_NO_SUCH_TABLE 跳过条数=$noSuchTable",
  "写闸门跳过语句数=$gateSkipped",
  "safeExec 记失败行数=$execErr",
  "seed 记失败行数=$seedErr",
  "LOG=$log",
  "SNAPSHOT=$snap"
) -join "`n"
$counts | Tee-Object -FilePath (Join-Path $OutDir "$Tag-counts.txt")
