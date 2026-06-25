# claude-accounts — installer (Windows). Delegates to the cross-platform Node setup.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Install from https://nodejs.org then re-run.' -ForegroundColor Yellow
  exit 1
}
& node (Join-Path $PSScriptRoot 'setup.js') install
