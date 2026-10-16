# S3-234 证据装置：用**真实部署命令**在夹具库上跑 069 两遍（R1 判据：「真库连跑两遍 ⇒ 零错误码」）。
#
# 为什么用真命令：装置里"复刻一份等价执行"证明的是复刻件。这里跑的就是部署段逐文件用的那一条：
#   cwd = backend/（`run-migration.mjs` 从 cwd 读 `.env`）+ `node ../scripts/run-migration.mjs <文件>`
#   （**整份文件一条多语句查询下发**，无 `addTablePrefix` —— 与部署通道同语义）。
#
# 前置：夹具库在 127.0.0.1:3409（MySQL 8.0.28），`backend/.env` 指向它（口令空，证据不含口令）。
# 用法（仓库根执行）：
#   pwsh -File docs/evidence/S3-234/harness/run-069-deploy-channel.ps1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path,
  [string]$Migration = 'docs/migrations/069_商品SPU增加品牌ID.sql'
)
$ErrorActionPreference = 'Stop'
$rawDir = Join-Path $RepoRoot 'docs/evidence/S3-234/raw'
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
$backend = Join-Path $RepoRoot 'backend'

Write-Output "== 目标文件：$Migration"
Write-Output ("== 目标文件 SHA256(前16) = " + (Get-FileHash -LiteralPath (Join-Path $RepoRoot $Migration) -Algorithm SHA256).Hash.Substring(0,16))

Push-Location $backend
try {
  for ($i = 1; $i -le 2; $i++) {
    $out = & node ../scripts/run-migration.mjs "../$Migration" 2>&1
    $rc = $LASTEXITCODE
    $text = "`$ node ../scripts/run-migration.mjs ../$Migration   # pass$i`r`n(exit=$rc)`r`n" + ($out | Out-String)
    [System.IO.File]::WriteAllText((Join-Path $rawDir "41-deploy-069-pass$i.txt"), $text, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "---- pass$i（exit=$rc）----"
    Write-Output (($out | Out-String).TrimEnd())
    if ($rc -ne 0) { throw "069 第 $i 遍退出码 $rc ≠ 0" }
  }
} finally {
  Pop-Location
}

Write-Output "== 两遍读数（结构面 三读数 + 回填行数）"
$env:DB_HOST = '127.0.0.1'; $env:DB_PORT = '3409'; $env:DB_USER = 'root'; $env:DB_PASSWORD = ''; $env:DB_NAME = 'liquor_inventory'
node (Join-Path $RepoRoot 'docs/evidence/S3-234/harness/db-probe.mjs') | Out-Null
Push-Location $RepoRoot
try { node docs/evidence/S3-234/harness/run-069-two-pass.mjs --caseC | Select-String -Pattern '结构|数据' | ForEach-Object { $_.Line } } finally { Pop-Location }
Write-Output "== 结论：两遍均 EXIT=0（零错误码）＝ R1 判据达成"
exit 0
