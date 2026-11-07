param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$directory = Join-Path $ProjectRoot 'release/store'
$version = (Get-Content -Raw (Join-Path $ProjectRoot 'package.json') | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Expected a stable package version.' }
$packageName = "DarkDesk-Store-$version-x64.appx"
$package = Join-Path $directory $packageName
$reportPath = Join-Path $directory 'store-validation.json'
$hashPath = Join-Path $directory 'SHA256SUMS-Store.txt'
foreach ($file in @($package, $reportPath, $hashPath)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -eq 0) { throw "Missing or empty Store input: $(Split-Path -Leaf $file)" }
}
if ((Get-Item -LiteralPath $package).Length -lt 1024) { throw 'Store AppX is unexpectedly small.' }
$report = Get-Content -Raw -LiteralPath $reportPath | ConvertFrom-Json
$packageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $package).Hash.ToLowerInvariant()
if ($report.sha256 -cne $packageHash -or $report.version -ne "$version.0" -or $report.architecture -ne 'x64') { throw 'Store report does not match the packaged application.' }
$expectedHashLine = "$packageHash  $packageName"
if ((Get-Content -Raw -LiteralPath $hashPath).Trim() -cne $expectedHashLine) { throw 'Store SHA-256 file does not match the application.' }
$readmePath = Join-Path $directory 'README-STORE.txt'
@"
DarkDesk $version - Microsoft Store submission

ENGLISH
Upload $packageName to Partner Center > DarkDesk > Submission > Packages.
Extract this ZIP first. Do not upload the ZIP, source-code archive or Setup EXE.
This is a Store submission package, not a normal signed Windows installer.
The checksum and store-validation.json describe the exact included AppX.
For regular installation use DarkDesk-Setup-$version.exe from the stable release.
Store installation testing and Microsoft certification remain required.

TURKCE
Bu ZIP'i once bir klasore cikartin. Partner Center > DarkDesk > Gonderim >
Paketler bolumune yalnizca $packageName dosyasini yukleyin.
ZIP, kaynak kod arsivi veya Setup EXE dosyasini yuklemeyin.
Bu paket Store'a gonderim icindir; normal kurulum icin Setup EXE kullanilir.

https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/MICROSOFT_STORE.md
"@ | Set-Content -Encoding utf8 -LiteralPath $readmePath
$names = @($packageName, 'SHA256SUMS-Store.txt', 'store-validation.json', 'README-STORE.txt')
$archiveName = "DarkDesk-Store-Submission-$version-x64.zip"
$archivePath = Join-Path $directory $archiveName
$temporaryPath = "$archivePath.partial"
if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath }
$archive = [System.IO.Compression.ZipFile]::Open($temporaryPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($name in $names) {
    # Store AppX is already compressed. Standard stored ZIP entries avoid a
    # second compression layer and work with Windows Explorer extraction.
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $directory $name), $name, [System.IO.Compression.CompressionLevel]::NoCompression) | Out-Null
  }
} finally { $archive.Dispose() }
$roundtrip = Join-Path ([System.IO.Path]::GetTempPath()) ('darkdesk-store-verify-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $roundtrip | Out-Null
try {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($temporaryPath)
  try {
    if ($archive.Entries.Count -ne $names.Count) { throw 'Unexpected or missing Store ZIP entries.' }
    foreach ($name in $names) {
      $entry = $archive.GetEntry($name)
      $source = Join-Path $directory $name
      if ($null -eq $entry -or $entry.Length -ne (Get-Item -LiteralPath $source).Length -or $entry.Length -eq 0) { throw "Empty or truncated Store ZIP entry: $name" }
      $extracted = Join-Path $roundtrip $name
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $extracted)
      if ((Get-FileHash -Algorithm SHA256 -LiteralPath $extracted).Hash -cne (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash) { throw "Store ZIP round-trip hash mismatch: $name" }
    }
  } finally { $archive.Dispose() }
} finally { Remove-Item -LiteralPath $roundtrip -Recurse -Force }
Move-Item -LiteralPath $temporaryPath -Destination $archivePath -Force
$archiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
"$archiveHash  $archiveName" | Set-Content -Encoding utf8 -LiteralPath "$archivePath.sha256"
Write-Output "PASS: $archiveName contains $($names.Count) nonempty, flat files; extracted AppX and reports match the source SHA-256 values."
