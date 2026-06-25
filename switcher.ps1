# Claude account switcher (PowerShell) — edunascimentt.dev
# Thin wrapper; all logic lives in acctinfo.js (Node).
$script:CADir  = Join-Path $HOME '.claude-accounts'
$script:CAReg  = Join-Path $script:CADir 'profiles.json'
$script:CAInfo = Join-Path $script:CADir 'acctinfo.js'

function _ca_node { [bool](Get-Command node -ErrorAction SilentlyContinue) }

function _ca_launch([string]$dir, $rest) {
    $old = $env:CLAUDE_CONFIG_DIR; $had = Test-Path Env:CLAUDE_CONFIG_DIR
    try {
        if ($dir -eq 'DEFAULT') { if ($had) { Remove-Item Env:CLAUDE_CONFIG_DIR } }
        else { $env:CLAUDE_CONFIG_DIR = $dir }
        & claude.exe @rest
    } finally {
        if ($had) { $env:CLAUDE_CONFIG_DIR = $old }
        elseif (Test-Path Env:CLAUDE_CONFIG_DIR) { Remove-Item Env:CLAUDE_CONFIG_DIR }
    }
}

# Bare `claude` -> interactive picker (arrow-key TUI). `claude <args>` -> default account.
function claude {
    if ($args.Count -gt 0) { _ca_launch 'DEFAULT' $args; return }
    if (-not (_ca_node)) { Write-Host '  Node.js required for the account picker. Install: https://nodejs.org' -ForegroundColor Yellow; return }
    $dir = "$(& node $script:CAInfo ui $script:CAReg)".Trim()
    if ($dir) { _ca_launch $dir @() } else { Write-Host "    $([char]27)[38;2;138;138;138mcancelled$([char]27)[0m" }
}

function claude-add {
    param([string]$Name)
    if (-not (_ca_node)) { Write-Host '  Node.js required.' -ForegroundColor Yellow; return }
    if (-not $Name) { $Name = Read-Host '  new account name' }
    if (-not $Name) { Write-Host '  cancelled'; return }
    Write-Host '  creating account…' -ForegroundColor DarkGray
    $dir = "$(& node $script:CAInfo add $script:CAReg $Name $HOME)".Trim()
    if (-not $dir) { Write-Host '  failed to create account' -ForegroundColor Red; return }
    Write-Host "  added '$Name'  ->  $dir" -ForegroundColor Green
    Write-Host '  launching (log in with this account)…' -ForegroundColor DarkGray
    _ca_launch $dir @()
}

function claude-acct { if (_ca_node) { & node $script:CAInfo status $script:CAReg } }

function claude-use {
    param([Parameter(Mandatory)][string]$Key)
    $dir = "$(& node $script:CAInfo dir $script:CAReg $Key)".Trim()
    if ($dir) { _ca_launch $dir @($args) } else { Write-Host "  no account: $Key" -ForegroundColor Red }
}

function claude-rm {
    param([Parameter(Mandatory)][string]$Key, [switch]$Purge)
    if (-not (_ca_node)) { return }
    $dir = "$(& node $script:CAInfo remove $script:CAReg $Key)".Trim()
    if (-not $dir) { Write-Host "  cannot remove '$Key' (unknown or the default account)" -ForegroundColor Yellow; return }
    if ($Purge -and (Test-Path $dir)) { Remove-Item -Recurse -Force $dir; Write-Host "  removed '$Key' (config dir deleted)" -ForegroundColor Green }
    else { Write-Host "  removed '$Key' (config dir kept at $dir)" -ForegroundColor Green }
}

# Convenience shorthands.
function claude-personal { _ca_launch 'DEFAULT' $args }
function claude-work { claude-use 'work' @args }
Set-Alias cpers claude-personal
Set-Alias cwork claude-work

