# Scan-Cdata.ps1
# Scans AOT XML files for broken CDATA block content:
#   - HTML entities (&lt; &gt;) that should be literal < > characters
#   - Literal \n sequences that should be real newlines
#
# Run this to diagnose issues before running Fix-HtmlEntities.ps1.
#
# Usage:
#   powershell -File Scan-Cdata.ps1 -ModelPath "C:\AOSService\PackagesLocalDirectory\AA\AA"
#   powershell -File Scan-Cdata.ps1 -ModelPath "C:\AOSService\PackagesLocalDirectory\AA\AA" -ObjectType "AxClass"
#
# -ObjectType  Optional. Restrict scan to one AOT folder (e.g. AxClass). Default: all XML files.

param(
    [string]$ModelPath  = $env:D365_MODEL_PATH,
    [string]$ObjectType = ""
)

if (-not $ModelPath) {
    Write-Error "Provide -ModelPath e.g.: -ModelPath 'C:\AOSService\PackagesLocalDirectory\AA\AA'"
    exit 1
}
if (-not (Test-Path $ModelPath)) {
    Write-Error "Path not found: $ModelPath"
    exit 1
}

$searchPath = if ($ObjectType) { Join-Path $ModelPath $ObjectType } else { $ModelPath }
$broken = @()

foreach ($f in Get-ChildItem $searchPath -Filter '*.xml' -Recurse) {
    $raw = [System.IO.File]::ReadAllBytes($f.FullName)
    $t   = [System.Text.Encoding]::UTF8.GetString($raw)

    $pos = 0
    while ($true) {
        $cdataStart = $t.IndexOf('<![CDATA[', $pos)
        if ($cdataStart -lt 0) { break }
        $cdataEnd = $t.IndexOf(']]>', $cdataStart)
        if ($cdataEnd -lt 0) { break }
        $cdata = $t.Substring($cdataStart + 9, $cdataEnd - $cdataStart - 9)

        $issues = @()
        if ($cdata.Contains('&lt;')) { $issues += '&lt;/&gt; HTML entities' }
        if ($cdata.Contains('\n'))   { $issues += 'literal \n sequences' }

        if ($issues.Count -gt 0) {
            $broken += [PSCustomObject]@{ File = $f.Name; Issues = ($issues -join ', ') }
            break
        }
        $pos = $cdataEnd + 3
    }
}

if ($broken.Count -eq 0) {
    Write-Output "ALL CLEAN — no broken CDATA blocks found."
} else {
    Write-Output "BROKEN FILES ($($broken.Count)):"
    $broken | Format-Table -AutoSize
    Write-Output "Run Fix-HtmlEntities.ps1 to repair these files."
}
