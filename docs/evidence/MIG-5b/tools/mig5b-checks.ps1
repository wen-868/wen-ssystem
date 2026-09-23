# MIG-5b 静态检查取证脚本（凌舟可原样复跑）
# 用法：pwsh -File docs/evidence/MIG-5b/tools/mig5b-checks.ps1
# 产出：docs/evidence/MIG-5b/outputs/02-tsc-testfile.txt / 02b-tsc-project.txt / 03-eslint.txt / 04-vitest-blocked.txt
$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$out = Join-Path $repo "docs\evidence\MIG-5b\outputs"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Save-Check {
    param([string]$Title, [string]$WorkDir, [string]$File, [scriptblock]$Run)
    $target = Join-Path $out $File
    "== $Title" | Out-File -FilePath $target -Encoding utf8
    Push-Location $WorkDir
    try {
        $result = & $Run 2>&1
        ($result | Out-String).TrimEnd() | Out-File -FilePath $target -Append -Encoding utf8
        "EXIT=$LASTEXITCODE" | Out-File -FilePath $target -Append -Encoding utf8
    } finally {
        Pop-Location
    }
    Get-Content -Path $target -Raw
}

Save-Check "命令：cd backend; node node_modules/typescript/bin/tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types vitest/globals,node src/__tests__/shared/migration-split.test.ts（tsconfig 排除了 src/__tests__/**，故单跑）" `
    (Join-Path $repo "backend") "02-tsc-testfile.txt" {
    node node_modules/typescript/bin/tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types vitest/globals,node src/__tests__/shared/migration-split.test.ts
}

Save-Check "命令：cd backend; node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit（覆盖 backend/src/**，含未改动的 migration.ts）" `
    (Join-Path $repo "backend") "02b-tsc-project.txt" {
    node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
}

Save-Check "命令：cd backend; node ../node_modules/eslint/bin/eslint.js src/__tests__/shared/migration-split.test.ts" `
    (Join-Path $repo "backend") "03-eslint.txt" {
    node ../node_modules/eslint/bin/eslint.js src/__tests__/shared/migration-split.test.ts
}

Save-Check "命令：cd backend; node ../node_modules/vitest/vitest.mjs run src/__tests__/shared/migration-split.test.ts（本沙箱预期失败：esbuild spawn EPERM）" `
    (Join-Path $repo "backend") "04-vitest-blocked.txt" {
    node ../node_modules/vitest/vitest.mjs run src/__tests__/shared/migration-split.test.ts
}
