$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path -Parent $PSScriptRoot
$identityFile = if ($env:DARKDESK_STORE_IDENTITY) { $env:DARKDESK_STORE_IDENTITY } elseif (Test-Path "$root/build/store-identity.local.json") { "$root/build/store-identity.local.json" } else { "$root/build/store-identity.json" }
$identity = Get-Content -Raw $identityFile | ConvertFrom-Json
$version = (Get-Content -Raw "$root/package.json" | ConvertFrom-Json).version
$package = Join-Path $root "release/store/DarkDesk-Store-$version-x64.appx"
if (-not (Test-Path $package)) { throw 'Expected Store AppX is missing.' }
$zip = [System.IO.Compression.ZipFile]::OpenRead($package)
try {
  $entry = $zip.GetEntry('AppxManifest.xml')
  if ($null -eq $entry -or $entry.Length -gt 1048576) { throw 'Missing or oversized AppxManifest.xml.' }
  $stream = $entry.Open()
  $settings = [System.Xml.XmlReaderSettings]::new()
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver = $null
  $reader = [System.Xml.XmlReader]::Create($stream, $settings)
  try {
    $xml = [System.Xml.XmlDocument]::new()
    $xml.XmlResolver = $null
    $xml.Load($reader)
  } finally { $reader.Dispose(); $stream.Dispose() }
  $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
  $ns.AddNamespace('p', 'http://schemas.microsoft.com/appx/manifest/foundation/windows10')
  $ns.AddNamespace('r', 'http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities')
  $id = $xml.SelectSingleNode('/p:Package/p:Identity', $ns)
  if ($id.GetAttribute('Name') -cne $identity.identityName -or $id.GetAttribute('Publisher') -cne $identity.publisher -or $id.GetAttribute('Version') -ne "$version.0" -or $id.GetAttribute('ProcessorArchitecture') -ne 'x64') { throw 'Store package identity/version/architecture does not match configuration.' }
  $display = $xml.SelectSingleNode('/p:Package/p:Properties/p:PublisherDisplayName', $ns).InnerText
  if ($display -cne $identity.publisherDisplayName) { throw 'Publisher display name mismatch.' }
  if ($null -eq $xml.SelectSingleNode('/p:Package/p:Capabilities/r:Capability[@Name="runFullTrust"]', $ns)) { throw 'Electron full-trust capability missing.' }
  if ($null -eq $xml.SelectSingleNode('/p:Package/p:Capabilities/p:Capability[@Name="internetClient"]', $ns)) { throw 'Network capability missing.' }
  $application = $xml.SelectSingleNode('/p:Package/p:Applications/p:Application', $ns)
  if ($application.GetAttribute('EntryPoint') -ne 'Windows.FullTrustApplication' -or $application.GetAttribute('Executable') -ne 'app\DarkDesk.exe') { throw 'Unexpected Store entry point.' }
  if ($null -eq $zip.GetEntry('app/DarkDesk.exe') -and $null -eq $zip.GetEntry('app\DarkDesk.exe')) { throw 'Application executable missing.' }
  $languages = @($xml.SelectNodes('/p:Package/p:Resources/p:Resource', $ns) | ForEach-Object { $_.GetAttribute('Language') })
  foreach ($language in @('tr-TR', 'en-US', 'de-DE', 'fr-FR', 'es-ES')) { if ($languages -notcontains $language) { throw "Missing language: $language" } }
  $target = $xml.SelectSingleNode('/p:Package/p:Dependencies/p:TargetDeviceFamily', $ns)
  if ($target.GetAttribute('Name') -ne 'Windows.Desktop' -or [version]($target.GetAttribute('MinVersion')) -lt [version]'10.0.19041.0') { throw 'Unexpected Windows target.' }
  foreach ($asset in @('StoreLogo.png','Square44x44Logo.png','Square150x150Logo.png','Wide310x150Logo.png')) {
    if ($null -eq $zip.GetEntry("assets/$asset") -and $null -eq $zip.GetEntry("assets\$asset")) { throw "Missing branded tile: $asset" }
  }
  $signed = $null -ne $zip.GetEntry('AppxSignature.p7x')
} finally { $zip.Dispose() }
$hash = (Get-FileHash -Algorithm SHA256 $package).Hash.ToLowerInvariant()
"$hash  $(Split-Path -Leaf $package)" | Set-Content -Encoding utf8 (Join-Path $root 'release/store/SHA256SUMS-Store.txt')
@{sourceCommit=$env:GITHUB_SHA; identityName=$identity.identityName; publisher=$identity.publisher; publisherDisplayName=$identity.publisherDisplayName; version="$version.0"; architecture='x64'; languages=$languages; signed=$signed; sha256=$hash; certification='Not performed; Store submission and clean-machine installation review are required.'} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $root 'release/store/store-validation.json')
Write-Output "PASS: $($identity.identityName), $version.0, exact publisher, x64, five languages, full-trust/network capabilities, executable and SHA-256. Store certification remains required."
