# S3-50 反测 RT-A：对比度矩阵门禁（真实脚本 + 真实输入）会不会红
#
# 被检对象（同一脚本被两个 workflow 步骤调用）：
#   ci.yml  build-and-test step 5  Contrast / a11y token gate (WCAG AA)   -> node scripts/contrast-check.cjs
#   e2e.yml e2e            step 11 saas-admin a11y gate (contrast matrix) -> node scripts/contrast-check.cjs
#
# 方法：把仓库真实脚本与真实输入复制到系统临时目录（仓库工作区零改动），在临时目录里跑：
#   A) 未改动              -> 期望 exit 0
#   B) --text-primary 改坏 -> 期望 exit 1
#   C) --input-border 改坏 -> 期望 exit 1
#
# 复跑：pwsh -File docs/evidence/S3-50/tools/rt-a-contrast-gate.ps1

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$tmpBase = [IO.Path]::GetTempPath()

function New-Tree([string]$tag) {
  $dir = Join-Path $tmpBase ("s3-50-rtA-$tag-" + [guid]::NewGuid().ToString('N'))
  foreach ($rel in @('scripts\contrast-check.cjs', 'saas-admin\src\styles\tokens.css', 'admin-web\src\styles\theme.ts')) {
    $dst = Join-Path $dir $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $rel) -Destination $dst
  }
  return $dir
}

function Invoke-Gate([string]$dir) {
  $script = Join-Path $dir 'scripts\contrast-check.cjs'
  $out = & node $script 2>&1 | Out-String
  return @{ code = $LASTEXITCODE; out = $out }
}

function Set-TokenValue([string]$dir, [string]$name, [string]$bad) {
  $p = Join-Path $dir 'saas-admin\src\styles\tokens.css'
  $src = Get-Content -LiteralPath $p -Raw
  $re = [regex]("($name\s*:\s*)#[0-9a-fA-F]{3,8}")
  if (-not $re.IsMatch($src)) { throw "tokens.css 中未找到变量 $name" }
  ($re.Replace($src, ('$1' + $bad), 1)) | Set-Content -LiteralPath $p -NoNewline -Encoding utf8
}

function Show-Head([string]$text, [int]$n = 6) {
  ($text -split "`r?`n" | Where-Object { $_ -ne '' } | Select-Object -First $n) -join "`n"
}

function Show-FailRows([string]$text, [int]$n = 4) {
  $rows = $text -split "`r?`n" | Where-Object { $_ -match '\| FAIL \|' } | Select-Object -First $n
  if ($rows.Count -eq 0) { return '（输出中无 FAIL 行）' }
  return ($rows -join "`n")
}

Write-Output '=====================  S3-50 RT-A  对比度矩阵门禁反测  ====================='
Write-Output '被检脚本（仓库真实文件）：scripts/contrast-check.cjs'
Write-Output '被检输入（仓库真实文件）：saas-admin/src/styles/tokens.css + admin-web/src/styles/theme.ts'
Write-Output '方法：复制到临时目录后执行；仓库工作区零改动（不触碰被检文件本身）'
Write-Output ''

$d = New-Tree 'A'
$r = Invoke-Gate $d
Write-Output '--- A) 未改动（正对照，期望 exit 0）---'
Write-Output ("exit=" + $r.code)
Write-Output (Show-Head $r.out)
Write-Output ''
Remove-Item -LiteralPath $d -Recurse -Force
if ($r.code -ne 0) { Write-Output '警告：A 未通过 —— 基线本身就红，后面 B/C 的红不可用' }

$d = New-Tree 'B'
Set-TokenValue $d '--text-primary' '#cccccc'
$r = Invoke-Gate $d
Write-Output '--- B) --text-primary: #000000 -> #cccccc（期望 exit 1）---'
Write-Output ("exit=" + $r.code)
Write-Output (Show-FailRows $r.out)
Write-Output ''
Remove-Item -LiteralPath $d -Recurse -Force
if ($r.code -eq 0) { Write-Output '失败：B 未红 —— 门禁读不出文本色变化，属假门禁' }

$d = New-Tree 'C'
Set-TokenValue $d '--input-border' '#eeeeee'
$r = Invoke-Gate $d
Write-Output '--- C) --input-border -> #eeeeee（期望 exit 1）---'
Write-Output ("exit=" + $r.code)
Write-Output (Show-FailRows $r.out)
Write-Output ''
Remove-Item -LiteralPath $d -Recurse -Force
if ($r.code -eq 0) { Write-Output '失败：C 未红 —— 门禁读不出非文本边框色变化，属假门禁' }

Write-Output '=====================  RT-A 结束  ====================='
