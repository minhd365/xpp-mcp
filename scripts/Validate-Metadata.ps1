# Validate-Metadata.ps1
# Uses D365 DiskMetadataProvider to deserialize every AOT XML in a model.
# Catches DuplicateNamedObjectException / MetadataCorruptedException —
# the same errors VS2022 MetadataValidator surfaces.
#
# Usage: powershell -File Validate-Metadata.ps1 -PackagesRoot <path> -Model <name>
# Exit:  0 = clean, 1 = errors found

param(
    [Parameter(Mandatory)][string]$PackagesRoot,
    [Parameter(Mandatory)][string]$Model
)

# ── Paths ─────────────────────────────────────────────────────────────────────
$binPath   = Join-Path $PackagesRoot "bin"
$modelPath = Join-Path (Join-Path $PackagesRoot $Model) $Model

if (-not (Test-Path $modelPath)) {
    Write-Output "ERROR: Model path not found: $modelPath"
    exit 1
}

# ── Load System.Runtime.Serialization (needed for DataContractSerializer) ─────
Add-Type -AssemblyName "System.Runtime.Serialization" -ErrorAction SilentlyContinue

# ── Load D365 metadata DLLs ───────────────────────────────────────────────────
$dlls = @(
    "Microsoft.Dynamics.AX.Metadata.Core.dll",
    "Microsoft.Dynamics.AX.Metadata.dll",
    "Microsoft.Dynamics.AX.Metadata.Storage.dll"
)
foreach ($dll in $dlls) {
    $full = Join-Path $binPath $dll
    if (-not (Test-Path $full)) {
        Write-Output "ERROR: DLL not found: $full"
        exit 1
    }
    try { Add-Type -Path $full -ErrorAction Stop }
    catch [System.Reflection.ReflectionTypeLoadException] { <# already loaded #> }
    catch { <# ignore duplicate load errors #> }
}

# ── AOT folder → MetaModel type name map ──────────────────────────────────────
$typeMap = @{
    "AxTable"             = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxTable"
    "AxForm"              = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxForm"
    "AxClass"             = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxClass"
    "AxEnum"              = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxEnum"
    "AxEdt"               = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxEdt"
    "AxQuery"             = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxQuery"
    "AxMenu"              = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxMenu"
    "AxMenuExtension"     = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxMenuExtension"
    "AxMenuItemDisplay"   = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxMenuItemDisplay"
    "AxMenuItemAction"    = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxMenuItemAction"
    "AxMenuItemOutput"    = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxMenuItemOutput"
    "AxSecurityPrivilege" = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxSecurityPrivilege"
    "AxSecurityDuty"      = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxSecurityDuty"
    "AxSecurityRole"      = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxSecurityRole"
    "AxTableExtension"    = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxTableExtension"
    "AxFormExtension"     = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxFormExtension"
    "AxView"              = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxView"
    "AxDataEntityView"    = "Microsoft.Dynamics.AX.Metadata.MetaModel.AxDataEntityView"
}

# ── Build serializer cache ────────────────────────────────────────────────────
$serializerCache = @{}
$allAssemblies = [AppDomain]::CurrentDomain.GetAssemblies()

foreach ($key in $typeMap.Keys) {
    $typeName = $typeMap[$key]
    $type = $null
    foreach ($asm in $allAssemblies) {
        $type = $asm.GetType($typeName)
        if ($null -ne $type) { break }
    }
    if ($null -ne $type) {
        $serializerCache[$key] = New-Object System.Runtime.Serialization.DataContractSerializer($type)
    }
}

$registered = $serializerCache.Keys -join ", "
Write-Output "Serializers loaded for: $registered"

# ── Scan AOT folders ──────────────────────────────────────────────────────────
$errors  = [System.Collections.Generic.List[string]]::new()
$scanned = 0
$skipped = 0

foreach ($folder in (Get-ChildItem -Path $modelPath -Directory)) {
    $aotType    = $folder.Name
    $serializer = $serializerCache[$aotType]
    if ($null -eq $serializer) { $skipped++; continue }

    foreach ($xmlFile in (Get-ChildItem -Path $folder.FullName -Filter "*.xml" -File | Where-Object { $_.Name -notlike "*.deleted*" })) {
        $scanned++
        try {
            $stream = [System.IO.File]::OpenRead($xmlFile.FullName)
            try {
                $quotas = [System.Xml.XmlDictionaryReaderQuotas]::Max
                $reader = [System.Xml.XmlDictionaryReader]::CreateTextReader($stream, $quotas)
                $serializer.ReadObject($reader) | Out-Null
                $reader.Close()
            } finally {
                $stream.Dispose()
            }
        } catch {
            $inner = $_.Exception
            while ($inner.InnerException) { $inner = $inner.InnerException }
            $errors.Add("  [$aotType] $($xmlFile.Name)`n    -> $($inner.Message)")
        }
    }
}

# ── Report ────────────────────────────────────────────────────────────────────
Write-Output "Scanned : $scanned XML files"
Write-Output "Skipped : $skipped unregistered AOT folders"
Write-Output ""

if ($errors.Count -eq 0) {
    Write-Output "Result  : OK -- no metadata errors detected"
    exit 0
} else {
    Write-Output "Result  : FAILED -- $($errors.Count) error(s)"
    Write-Output ""
    foreach ($e in $errors) { Write-Output $e }
    exit 1
}
