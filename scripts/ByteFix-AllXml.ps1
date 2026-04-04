# ByteFix-AllXml.ps1
# Fixes AOT XML files that have <n> (lowercase, 3 bytes) instead of <Name> (5 bytes).
# This byte-level corruption causes DuplicateNamedObjectException in D365 MetadataValidator.
#
# Usage:
#   powershell -File ByteFix-AllXml.ps1 -ModelPath "C:\AOSService\PackagesLocalDirectory\AA\AA"
#   powershell -File ByteFix-AllXml.ps1  # defaults to $env:D365_MODEL_PATH if set

param(
    [string]$ModelPath = $env:D365_MODEL_PATH
)

if (-not $ModelPath) {
    Write-Error "Provide -ModelPath e.g.: -ModelPath 'C:\AOSService\PackagesLocalDirectory\AA\AA'"
    exit 1
}
if (-not (Test-Path $ModelPath)) {
    Write-Error "Path not found: $ModelPath"
    exit 1
}

function Replace-BytePattern {
    param([byte[]]$data, [byte[]]$search, [byte[]]$replace)
    $result = [System.Collections.Generic.List[byte]]::new()
    $i = 0
    $max = $data.Length - $search.Length
    while ($i -lt $data.Length) {
        if ($i -le $max) {
            $match = $true
            for ($j = 0; $j -lt $search.Length; $j++) {
                if ($data[$i+$j] -ne $search[$j]) { $match = $false; break }
            }
            if ($match) { $result.AddRange($replace); $i += $search.Length; continue }
        }
        $result.Add($data[$i]); $i++
    }
    return $result.ToArray()
}

$nOpen     = [byte[]]@(0x3C, 0x6E, 0x3E)
$nClose    = [byte[]]@(0x3C, 0x2F, 0x6E, 0x3E)
$nameOpen  = [byte[]]@(0x3C, 0x4E, 0x61, 0x6D, 0x65, 0x3E)
$nameClose = [byte[]]@(0x3C, 0x2F, 0x4E, 0x61, 0x6D, 0x65, 0x3E)

$files  = Get-ChildItem $ModelPath -Recurse -Filter '*.xml'
$fixed  = 0
$skipped = 0

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $hasN  = $false
    $max   = $bytes.Length - 3
    for ($i = 0; $i -le $max; $i++) {
        if ($bytes[$i] -eq 0x3C -and $bytes[$i+1] -eq 0x6E -and $bytes[$i+2] -eq 0x3E) {
            $hasN = $true; break
        }
    }
    if (-not $hasN) { $skipped++; continue }

    $bytes = Replace-BytePattern $bytes $nClose $nameClose
    $bytes = Replace-BytePattern $bytes $nOpen  $nameOpen
    [System.IO.File]::WriteAllBytes($f.FullName, $bytes)
    Write-Output "Fixed: $($f.Name)"
    $fixed++
}

Write-Output ""
Write-Output "Fixed: $fixed files | Skipped (already OK): $skipped files"
