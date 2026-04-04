# Fix-HtmlEntities.ps1
# Fixes HTML entities (&lt; &gt; &amp; etc.) inside CDATA blocks in AOT XML files.
# These can appear when source code is copy-pasted from a web source or incorrectly generated.
# Also fixes literal \n, \t, \r escape sequences that should be real newlines/tabs.
#
# Usage:
#   powershell -File Fix-HtmlEntities.ps1 -ModelPath "C:\AOSService\PackagesLocalDirectory\AA\AA"
#   powershell -File Fix-HtmlEntities.ps1 -ModelPath "C:\AOSService\PackagesLocalDirectory\AA\AA" -ObjectType "AxClass"
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
$fixed = 0

foreach ($f in Get-ChildItem $searchPath -Filter '*.xml' -Recurse) {
    $original = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)

    if (-not ($original.Contains('&lt;') -or $original.Contains('&gt;') -or
              $original.Contains('&amp;') -or $original.Contains('\n'))) { continue }

    $patched = $original
    $patched = $patched -replace '&lt;',   '<'
    $patched = $patched -replace '&gt;',   '>'
    $patched = $patched -replace '&amp;',  '&'
    $patched = $patched -replace '&quot;', '"'
    $patched = $patched -replace '&#39;',  "'"
    $patched = $patched -replace '\\n',    "`n"
    $patched = $patched -replace '\\t',    "`t"
    $patched = $patched -replace '\\r',    "`r"

    if ($patched -eq $original) { continue }

    # Normalise to CRLF
    $patched = $patched -replace "`r`n", "`n"
    $patched = $patched -replace "`n",   "`r`n"

    [System.IO.File]::WriteAllText($f.FullName, $patched, (New-Object System.Text.UTF8Encoding $false))
    Write-Output "Fixed: $($f.Name)"
    $fixed++
}

Write-Output ""
Write-Output "Fixed: $fixed files"
