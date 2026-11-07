"""Independently download and verify public Store assets using Python's ZIP reader."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def read_small(url):
    with urllib.request.urlopen(url, timeout=40) as response:
        data = response.read(65537)
        if response.status != 200 or len(data) > 65536:
            raise ValueError('Missing or oversized checksum response')
        return data.decode('utf-8-sig')

def download(url, target, expected_hash):
    digest, size = hashlib.sha256(), 0
    with urllib.request.urlopen(url, timeout=60) as response, target.open('wb') as output:
        if response.status != 200:
            raise ValueError('Anonymous asset download failed')
        expected_size = int(response.headers.get('Content-Length', 0))
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > 2 * 1024**3:
                raise ValueError('Unexpectedly large Store download')
            digest.update(chunk)
            output.write(chunk)
    if size < 1024 or (expected_size and size != expected_size) or digest.hexdigest() != expected_hash:
        raise ValueError('Empty, incomplete or checksum-mismatched download')
    return size

def verify(version, output, expected_source=None):
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Stable semantic version required')
    configured_identity = os.environ.get('DARKDESK_STORE_IDENTITY')
    identity_path = Path(configured_identity) if configured_identity else ROOT / 'build/store-identity.local.json'
    if not configured_identity and not identity_path.exists():
        identity_path = ROOT / 'build/store-identity.json'
    identity = json.loads(identity_path.read_text(encoding='utf-8-sig'))
    base = f'https://github.com/Huseyinhk61/DarkDesk/releases/download/store-v{version}/'
    archive_name, appx_name = f'DarkDesk-Store-Submission-{version}-x64.zip', f'DarkDesk-Store-{version}-x64.appx'
    checksum = read_small(base + archive_name + '.sha256').strip().split()
    if len(checksum) != 2 or checksum[1] != archive_name or not re.fullmatch('[a-f0-9]{64}', checksum[0]):
        raise ValueError('Unexpected Store ZIP checksum metadata')
    output.mkdir(parents=True, exist_ok=True)
    archive_path, appx_path = output / archive_name, output / appx_name
    archive_size = download(base + archive_name, archive_path, checksum[0])
    expected_names = {appx_name, 'SHA256SUMS-Store.txt', 'store-validation.json', 'README-STORE.txt'}
    with zipfile.ZipFile(archive_path) as archive:
        if len(archive.infolist()) != 4 or set(archive.namelist()) != expected_names or any(entry.file_size == 0 for entry in archive.infolist()):
            raise ValueError('Empty, nested or incomplete Store ZIP')
        if archive.testzip() is not None:
            raise ValueError('Store ZIP CRC validation failed')
        if archive.getinfo('store-validation.json').file_size > 65536:
            raise ValueError('Unexpected Store report size')
        report = json.loads(archive.read('store-validation.json').decode('utf-8-sig'))
        for key in ('identityName', 'publisher', 'publisherDisplayName'):
            if report[key] != identity[key]:
                raise ValueError('Store report identity mismatch: ' + key)
        if report['version'] != version + '.0' or report['architecture'] != 'x64':
            raise ValueError('Store report version/architecture mismatch')
        if expected_source and report.get('sourceCommit') != expected_source:
            raise ValueError('Store report does not match the expected source commit')
        expected_appx_hash = report['sha256']
        if archive.read('SHA256SUMS-Store.txt').decode('utf-8-sig').strip() != expected_appx_hash + '  ' + appx_name:
            raise ValueError('AppX checksum file mismatch')
        digest = hashlib.sha256()
        with archive.open(appx_name) as source, appx_path.open('wb') as target:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                target.write(chunk)
                digest.update(chunk)
        if digest.hexdigest() != expected_appx_hash:
            raise ValueError('Extracted AppX hash mismatch')
    with zipfile.ZipFile(appx_path) as appx:
        if appx.testzip() is not None:
            raise ValueError('AppX internal ZIP CRC validation failed')
        entry = appx.getinfo('AppxManifest.xml')
        if not 0 < entry.file_size <= 1048576:
            raise ValueError('Missing or oversized AppX manifest')
        manifest = appx.read('AppxManifest.xml')
        if b'<!DOCTYPE' in manifest.upper():
            raise ValueError('Unexpected manifest DTD')
        tree = ET.fromstring(manifest)
        ns = {'p': 'http://schemas.microsoft.com/appx/manifest/foundation/windows10'}
        actual = tree.find('p:Identity', ns)
        if actual is None or actual.get('Name') != identity['identityName'] or actual.get('Publisher') != identity['publisher'] or actual.get('Version') != version + '.0' or actual.get('ProcessorArchitecture') != 'x64':
            raise ValueError('Downloaded AppX manifest identity mismatch')
        executable = next((name for name in appx.namelist() if name.replace('\\', '/') == 'app/DarkDesk.exe'), None)
        if not executable:
            raise ValueError('DarkDesk.exe missing from AppX')
        with appx.open(executable) as exe:
            if exe.read(2) != b'MZ':
                raise ValueError('Invalid Windows executable')
    # Check the direct AppX path as well, without any GitHub authentication.
    direct_path = output / ('direct-' + appx_name)
    direct_size = download(base + appx_name, direct_path, expected_appx_hash)
    direct_path.unlink()
    result = {'version': version, 'sourceCommit': report.get('sourceCommit'), 'zipBytes': archive_size, 'appxBytes': direct_size, 'zipSHA256': checksum[0], 'appxSHA256': expected_appx_hash, 'entries': sorted(expected_names), 'identityName': identity['identityName'], 'publisher': identity['publisher'], 'anonymousDownloads': True, 'outerAndInnerCRC': True}
    (output / 'store-public-download-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    print('PASS: anonymous ZIP/AppX downloads, four nonempty flat files, independent extraction, both ZIP CRC checks, executable, exact identity and SHA-256.')
    return output / 'store-public-download-verification.json'

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default=json.loads((ROOT / 'package.json').read_text())['version'])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--expected-source', default=os.environ.get('DARKDESK_EXPECTED_STORE_SHA'))
    args = parser.parse_args()
    verify(args.version, args.output or Path(tempfile.mkdtemp(prefix='darkdesk-store-download-')), args.expected_source)
