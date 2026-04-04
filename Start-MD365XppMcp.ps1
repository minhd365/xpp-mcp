# =============================================================================
# XPP-MCP -- Start / Install Script
#
# Usage (run from the project folder):
#   powershell -ExecutionPolicy Bypass -File Start-MD365XppMcp.ps1             # foreground
#   powershell -ExecutionPolicy Bypass -File Start-MD365XppMcp.ps1 -AsService  # install task
#   powershell -ExecutionPolicy Bypass -File Start-MD365XppMcp.ps1 -Remove     # remove task
# =============================================================================
[CmdletBinding()]
param(
    [switch]$AsService,
    [switch]$Remove
)

# Resolve project dir from script location so this works from any drive/path
$PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Find node.exe — check PATH first, then common install locations
$NODE_EXE = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $NODE_EXE) { $NODE_EXE = 'C:\Program Files\nodejs\node.exe' }
if (-not $NODE_EXE) { $NODE_EXE = 'C:\Program Files (x86)\nodejs\node.exe' }
$ENTRY       = Join-Path $PROJECT_DIR 'build\index.js'
$LOG_DIR     = Join-Path $PROJECT_DIR 'logs'
$LOG_FILE    = Join-Path $LOG_DIR     'xpp-mcp.log'
$TASK_NAME   = 'XPP-MCP'
$WORKER_PS1  = Join-Path $PROJECT_DIR 'Start-MD365XppMcp-Worker.ps1'

# Validate prerequisites
if (-not (Test-Path $NODE_EXE)) {
    Write-Error "Node.js not found at: $NODE_EXE"; exit 1
}
if (-not (Test-Path $ENTRY)) {
    Write-Error "build\index.js not found. Run: cd $PROJECT_DIR && npm run build"; exit 1
}

# -Remove: unregister scheduled task
if ($Remove) {
    if (Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
        Write-Host "Task '$TASK_NAME' removed." -ForegroundColor Green
    } else {
        Write-Host "Task '$TASK_NAME' not found." -ForegroundColor Yellow
    }
    exit 0
}

# -AsService: install Windows Task Scheduler entry
if ($AsService) {
    $me = New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $me.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        Write-Error 'Must run as Administrator to install a scheduled task.'; exit 1
    }

    if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

    # Write the worker script that the task invokes.
    # It just starts node and pipes output to the log file.
    $w  = "Set-Location '$PROJECT_DIR'" + [System.Environment]::NewLine
    $w += '$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"' + [System.Environment]::NewLine
    $w += "Add-Content -Path '$LOG_FILE' -Value `"[`$ts] Starting xpp-mcp...`"" + [System.Environment]::NewLine
    $w += "Start-Process -FilePath '$NODE_EXE' -ArgumentList '$ENTRY' -NoNewWindow -Wait" + [System.Environment]::NewLine
    [System.IO.File]::WriteAllText($WORKER_PS1, $w, [System.Text.Encoding]::UTF8)

    $action = New-ScheduledTaskAction `
        -Execute  'powershell.exe' `
        -Argument "-NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WORKER_PS1`"" `
        -WorkingDirectory $PROJECT_DIR

    $trigger  = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet `
        -RestartCount 99 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([timespan]::Zero) `
        -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal `
        -UserId    "$env:USERDOMAIN\$env:USERNAME" `
        -LogonType Interactive `
        -RunLevel  Highest

    if (Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
    }

    Register-ScheduledTask -TaskName $TASK_NAME -Action $action `
        -Trigger $trigger -Settings $settings -Principal $principal `
        -Description 'XPP-MCP server for D365 F&O X++ development' | Out-Null

    Start-ScheduledTask -TaskName $TASK_NAME

    Write-Host ''
    Write-Host "Task '$TASK_NAME' installed and started." -ForegroundColor Green
    Write-Host "  Auto-start:   at every Windows login"             -ForegroundColor Cyan
    Write-Host "  Auto-restart: 10s delay, up to 99 times"          -ForegroundColor Cyan
    Write-Host "  Log file:     $LOG_FILE"                          -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Check status:  Get-ScheduledTask -TaskName XPP-MCP | Select State' -ForegroundColor Gray
    Write-Host 'Stop now:      Stop-ScheduledTask -TaskName XPP-MCP'                -ForegroundColor Gray
    Write-Host 'Start now:     Start-ScheduledTask -TaskName XPP-MCP'               -ForegroundColor Gray
    Write-Host 'Remove:        .\Start-MD365XppMcp.ps1 -Remove'                           -ForegroundColor Gray
    exit 0
}

# Default: run in foreground (Claude Desktop calls this directly)
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

Write-Host ''
Write-Host '=== XPP-MCP (foreground) ===' -ForegroundColor Cyan
Write-Host "  Project : $PROJECT_DIR"            -ForegroundColor Gray
Write-Host "  Node    : $NODE_EXE"               -ForegroundColor Gray
Write-Host '  Ctrl+C to stop.'                   -ForegroundColor Gray
Write-Host ''

Set-Location $PROJECT_DIR
& $NODE_EXE $ENTRY
