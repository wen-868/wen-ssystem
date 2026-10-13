<#
S3-194 结构快照装置（只读）
用法：
  powershell -NoProfile -File snapshot.ps1 -MyBin <client bin 目录> -DbPort 3408 -DbName s3194_fix46 -Tag 02-fixed-mysql8046 `
             -ClientArgs @('--no-defaults') [-ClientPwd '']
产出（每份都写 sha256，便于"读数可复核"）：
  tables.tsv / columns.tsv / indexes.tsv / fks.tsv / show-create-6tables.txt / counts.txt / sha256.txt
#>
param(
  [Parameter(Mandatory=$true)][string]$MyBin,
  [Parameter(Mandatory=$true)][int]$DbPort,
  [Parameter(Mandatory=$true)][string]$DbName,
  [Parameter(Mandatory=$true)][string]$Tag,
  [string]$ClientArgs = '--no-defaults',
  [string]$ClientPwd = '',
  [string]$Base = 'D:\Users\ZXQL\wt-agents\_s3194-evidence',
  [string]$SqlFile = 'D:\Users\ZXQL\wt-agents\_s3194-evidence\harness\snapshot.sql'
)
$ErrorActionPreference = 'Continue'
$out = Join-Path (Join-Path $Base $Tag) 'structure'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$clientArgArr = @($ClientArgs -split ',' | Where-Object { $_ -ne '' })
$srvArgs = $clientArgArr + @('-h','127.0.0.1','-P',"$DbPort",'-u','root','-D',$DbName)
if ($ClientPwd -ne '') { $srvArgs += "-p$ClientPwd" }

function Dump([string]$file, [string]$query) {
  $p = Join-Path $out $file
  $raw = & "$MyBin\mysql.exe" @srvArgs -N -B -e $query 2>&1
  $raw | Set-Content -LiteralPath $p -Encoding UTF8
  Write-Output "  [dump] $file  ($((Get-Content -LiteralPath $p).Count) 行)"
}

Dump 'tables.tsv'    "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, REPLACE(TABLE_COMMENT,'\t',' ') FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DbName' ORDER BY TABLE_NAME;"
Dump 'columns.tsv'   "SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, IFNULL(COLUMN_DEFAULT,'<NULL>'), IFNULL(CHARACTER_SET_NAME,''), IFNULL(COLLATION_NAME,''), EXTRA, REPLACE(COLUMN_COMMENT,'\t',' ') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DbName' ORDER BY TABLE_NAME, ORDINAL_POSITION;"
Dump 'indexes.tsv'   "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DbName' ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;"
Dump 'fks.tsv'       "SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.CONSTRAINT_NAME, r.UPDATE_RULE, r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA='$DbName' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME;"
Dump 'counts.txt'    "SELECT CONCAT('tables=', (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DbName'), ' columns=', (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DbName'), ' indexes=', (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DbName'), ' fks=', (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='$DbName' AND REFERENCED_TABLE_NAME IS NOT NULL));"

$six = @('t_tenant','t_tenant_module_access','t_tenant_admin','t_retail_order','t_retail_order_item','t_delivery_record')
$sc = Join-Path $out 'show-create-6tables.txt'
if (Test-Path $sc) { Remove-Item -LiteralPath $sc -Force }
foreach ($t in $six) {
  Add-Content -LiteralPath $sc -Value "===== $t =====" -Encoding UTF8
  $r = & "$MyBin\mysql.exe" @srvArgs -N -B -e "SHOW CREATE TABLE $t;" 2>&1
  if ($LASTEXITCODE -ne 0) { Add-Content -LiteralPath $sc -Value "（SHOW CREATE TABLE 失败：$r）" -Encoding UTF8 }
  else { Add-Content -LiteralPath $sc -Value ($r -join "`n") -Encoding UTF8 }
}
Write-Output "  [dump] show-create-6tables.txt"

$hashes = Get-ChildItem -LiteralPath $out -File | Sort-Object Name | ForEach-Object {
  "{0,16}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.Substring(0,16), $_.Name
}
$hashes | Set-Content -LiteralPath (Join-Path $out 'sha256.txt') -Encoding UTF8
Write-Output "快照目录: $out"
$hashes | ForEach-Object { Write-Output $_ }
