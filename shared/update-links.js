const releases = 'https://github.com/Huseyinhk61/DarkDesk/releases';
export function releaseNotesUrl(version) {
  return typeof version === 'string' &&
    version.length <= 100 &&
    /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i.test(version)
    ? `${releases}/tag/v${encodeURIComponent(version)}`
    : `${releases}/latest`;
}
