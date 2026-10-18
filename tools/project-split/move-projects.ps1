$ErrorActionPreference = 'Stop'
$workspacePath = (Resolve-Path -LiteralPath 'D:\sayari-project').Path
function Move-WorkspaceItem([string]$source, [string]$destination) {
  $sourcePath = [IO.Path]::GetFullPath((Join-Path $workspacePath $source))
  $targetPath = [IO.Path]::GetFullPath((Join-Path $workspacePath $destination))
  foreach ($candidate in @($sourcePath, $targetPath)) {
    if (-not $candidate.StartsWith($workspacePath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside workspace: $candidate" }
  }
  if (Test-Path -LiteralPath $targetPath) { throw "Destination already exists: $targetPath" }
  $null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath)
  Move-Item -LiteralPath $sourcePath -Destination $targetPath
  Write-Output "$source -> $destination"
}
if (-not (Test-Path -LiteralPath "$workspacePath\evidence\project-split\baseline.json")) { throw 'Capture baseline first' }
if (-not (Test-Path -LiteralPath "$workspacePath\.timeline\before-project-split\firebase-export-metadata.json")) { throw 'Export emulator data first' }
Move-WorkspaceItem 'src' 'zzz/src'
Move-WorkspaceItem 'zzz/src/features/timeline' 'timeline/src/features/timeline'
Move-WorkspaceItem 'zzz/src/views/timeline' 'timeline/src/views/timeline'
Move-WorkspaceItem 'public' 'zzz/public'
Move-WorkspaceItem 'tools/nanoka' 'zzz/tools/nanoka'
Move-WorkspaceItem 'tools/localization' 'zzz/tools/localization'
Move-WorkspaceItem 'tools/timeline' 'timeline/tools/timeline'
Move-WorkspaceItem 'timeline/tools/timeline/preservation.mjs' 'zzz/tools/calculator/preservation.mjs'
Move-WorkspaceItem 'timeline/tools/timeline/audit.mjs' 'tools/project-split/archive/timeline-audit.mjs'
Move-WorkspaceItem 'zzz/tools/nanoka/scripts/delivery-report.mjs' 'tools/project-split/archive/nanoka-delivery-report.mjs'
Move-WorkspaceItem 'zzz/tools/localization/report.mjs' 'tools/project-split/archive/localization-report.mjs'
foreach ($file in @('functions', '.firebaserc', 'firebase.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules', '.env.example', '.env.emulator', '.timeline', 'node_modules')) {
  Move-WorkspaceItem $file "timeline/$file"
}
Move-WorkspaceItem '.nanoka' 'zzz/.nanoka'
Move-WorkspaceItem 'dist' '.migration/previous-dist'
Move-WorkspaceItem '.firebase' '.migration/previous-firebase-cache'
foreach ($file in @('package.json', 'package-lock.json', 'index.html', '.eslintrc.cjs', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json')) {
  Copy-Item -LiteralPath (Join-Path $workspacePath $file) -Destination (Join-Path $workspacePath "zzz/$file")
  Move-WorkspaceItem $file "timeline/$file"
}
Copy-Item -LiteralPath "$workspacePath\zzz\src\main.tsx" -Destination "$workspacePath\timeline\src\main.tsx"
Copy-Item -LiteralPath "$workspacePath\zzz\src\vite-env.d.ts" -Destination "$workspacePath\timeline\src\vite-env.d.ts"
$null = New-Item -ItemType Directory -Force -Path "$workspacePath\timeline\tests\fixtures", "$workspacePath\zzz\tests\fixtures", "$workspacePath\timeline\evidence\timeline"
Copy-Item -LiteralPath "$workspacePath\_handoff\SAYARI_TIMELINE_CODEX_V5_20261018\tests\vectors.v5.json" -Destination "$workspacePath\timeline\tests\fixtures\vectors.v5.json"
Copy-Item -LiteralPath "$workspacePath\evidence\timeline\calculator-baseline.json" -Destination "$workspacePath\zzz\tests\fixtures\calculator-baseline.json"
