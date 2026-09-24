# S3-50 反测 RT-D：Backend lint gate 会不会红（真实 eslint + 真实配置）
#
# 被检对象：ci.yml job build-and-test step 7 `Backend lint gate (zero error)`
#   run: npm --workspace backend run lint   ==  cd backend && eslint src --ext .ts
#
# 方法：不碰 backend/src（不在其中新建/修改任何文件），探针放在系统临时目录，
#       用仓库同一个 eslint + 同一个配置（backend/.eslintrc.cjs）跑：
#   A) 干净探针（const 声明）         -> 期望 exit 0
#   B) 违规探针（命中 no-var 的 var） -> 期望 exit 1
#
# 与 CI 的差别：CI 只扫 backend/src 目录；本反测证明「同一 eslint + 同一配置」能报
#   error 并致 exit 1，属本地等效反测；CI run 级证据仍需 run id（见未闭环清单）。
#
# 复跑：pwsh -File docs/evidence/S3-50/tools/rt-d-lint-gate.ps1

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$eslint = Join-Path $root 'node_modules\eslint\bin\eslint.js'
$backend = Join-Path $root 'backend'
$cfg = Join-Path $backend '.eslintrc.cjs'
$eslintVer = (Get-Content (Join-Path $root 'node_modules\eslint\package.json') -Raw | ConvertFrom-Json).version

$dir = Join-Path ([IO.Path]::GetTempPath()) ("s3-50-rtD-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$clean = Join-Path $dir 'probe-clean.ts'
$dirty = Join-Path $dir 'probe-dirty.ts'
'const answer: number = 42;
export default answer;' | Set-Content -LiteralPath $clean -Encoding utf8
'var rtProbeUnused = 1;' | Set-Content -LiteralPath $dirty -Encoding utf8

function Invoke-Lint([string]$file) {
  Push-Location $backend
  try {
    $out = & node $eslint --config $cfg --resolve-plugins-relative-to $backend --no-eslintrc --ext .ts $file 2>&1 | Out-String
    return @{ code = $LASTEXITCODE; out = $out }
  } finally { Pop-Location }
}

Write-Output '=====================  S3-50 RT-D  Backend lint gate 反测  ====================='
Write-Output "eslint：node_modules/eslint/bin/eslint.js（v$eslintVer）"
Write-Output '配置：backend/.eslintrc.cjs（仓库真实配置，规则 no-var=error）'
Write-Output "探针目录：$dir（系统临时目录，未在 backend/src 内新增任何文件）"
Write-Output ''

$r = Invoke-Lint $clean
Write-Output '--- A) 干净探针（期望 exit 0）---'
Write-Output ("exit=" + $r.code)
Write-Output (($r.out -split "`r?`n" | Where-Object { $_ -ne '' } | Select-Object -First 3) -join "`n")
if ($r.code -eq 0) { Write-Output '通过：合法代码下 lint 绿' } else { Write-Output '失败：A 应为绿' }
Write-Output ''

$r = Invoke-Lint $dirty
Write-Output '--- B) 违规探针 var rtProbeUnused = 1;（期望 exit 1）---'
Write-Output ("exit=" + $r.code)
Write-Output (($r.out -split "`r?`n" | Where-Object { $_ -ne '' } | Select-Object -First 8) -join "`n")
if ($r.code -ne 0) { Write-Output '通过：lint 报 error 并非零退出 ⇒ 该步骤会红' } else { Write-Output '失败：违规代码仍 exit 0 ⇒ 假门禁' }

Write-Output ''
Remove-Item -LiteralPath $dir -Recurse -Force
Write-Output '=====================  RT-D 结束  ====================='
