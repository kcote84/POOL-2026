# Google Drive ne supporte pas toujours les milliers de fichiers de node_modules.
# Les sources restent dans ce dossier ; compilation et dépendances vivent sur le disque local.
$ErrorActionPreference = 'Stop'
$poolLocal = Join-Path $env:LOCALAPPDATA 'Keven2026-site'
New-Item -ItemType Directory -Force -Path $poolLocal | Out-Null
$poolFiles = @('package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.env.example', 'playwright.config.ts')
foreach ($poolFile in $poolFiles) {
    $poolSource = Join-Path $PSScriptRoot $poolFile
    if (Test-Path -LiteralPath $poolSource) { Copy-Item -LiteralPath $poolSource -Destination $poolLocal -Force }
}
foreach ($poolDir in @('src', 'server', 'shared', 'public', 'tests')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $poolDir) -Destination $poolLocal -Recurse -Force
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.env') -Destination $poolLocal -Force }
Push-Location $poolLocal
try {
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Installation npm impossible.' }
    npm run dev
} finally { Pop-Location }
