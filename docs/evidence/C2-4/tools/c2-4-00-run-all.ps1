# C2-4 一键复跑：按顺序执行全部证据工具，打印每条命令与退出码，并落盘 outputs/00-run-all.txt
# 用法：pwsh -File docs/evidence/C2-4/tools/c2-4-00-run-all.ps1
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
Set-Location $repo
$out = Join-Path $repo "docs/evidence/C2-4/outputs/00-run-all.txt"
$buf = New-Object System.Collections.Generic.List[string]

function Step([string]$label, [string]$cmd, [string[]]$cmdArgs) {
  $line = "== $label :: $cmd $($cmdArgs -join ' ')"
  $buf.Add($line); Write-Output $line
  & $cmd @cmdArgs 2>&1 | ForEach-Object {
    if ($_ -match '^(RESULT|EXIT|SELFTEST|SPAWN_|\[C2-4/0[0-9]\] 结论|\[C2-4/0[0-9]\] SELFTEST|SMOKE_)') { $buf.Add("   $_"); Write-Output "   $_" }
  }
  $code = $LASTEXITCODE
  $buf.Add("   -> exit=$code"); Write-Output "   -> exit=$code"
}

Step "00 环境前置（tsx 失败通道留证）" "node" @("-e", "const {execFileSync}=require('node:child_process');try{execFileSync(process.execPath,['-e','1'],{encoding:'utf8'});console.log('SPAWN_OK')}catch(e){console.log('SPAWN_ERR',e.code)}")
Step "00 无子进程 TS 加载冒烟" "node" @("docs/evidence/C2-4/tools/c2-4-ts-loader-smoke.mjs")
Step "04 待接入计数" "pwsh" @("-NoProfile", "-File", "docs/evidence/C2-4/tools/c2-4-04-pending-count.ps1")
Step "01 静态端点差集（同时刷新 json）" "node" @("docs/evidence/C2-4/tools/c2-4-01-static-diff.mjs", "--json", "docs/evidence/C2-4/outputs/01-static-diff-baseline.json")
Step "01b 全仓同路径竞争" "node" @("docs/evidence/C2-4/tools/c2-4-01b-cross-file-shadow.mjs")
Step "06 契约文档第二轴" "node" @("docs/evidence/C2-4/tools/c2-4-06-doc-axis.mjs")
Step "05 迁移 runner 复演" "node" @("docs/evidence/C2-4/tools/c2-4-05-migration-parse.mjs")
Step "02 反测（检测器会红）" "node" @("docs/evidence/C2-4/tools/c2-4-02-falsify.mjs")
Step "03 运行期探针" "node" @("docs/evidence/C2-4/tools/c2-4-03-runtime-probe.mjs")
Step "03 运行期探针自反测" "node" @("docs/evidence/C2-4/tools/c2-4-03-runtime-probe.mjs", "--selftest")

[IO.File]::WriteAllText($out, ($buf -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "已落盘：$out"
