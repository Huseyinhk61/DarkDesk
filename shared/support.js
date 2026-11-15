export const supportLinks = Object.freeze({
  guide: 'https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/QUICK_START.md',
  privacy: 'https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/PRIVACY.md',
  issue: 'https://github.com/Huseyinhk61/DarkDesk/issues/new?template=bug_report.yml',
  weather: 'https://api.met.no/doc/TermsOfService',
});
export function supportInfo(input) {
  const safe = (value) =>
    typeof value === 'string' && value.length <= 80 && !/[\x00-\x1f]/.test(value)
      ? value
      : 'unknown';
  return {
    version: safe(input.version),
    platform: safe(input.platform),
    architecture: safe(input.architecture),
    channel: ['preview', 'development', 'github', 'store', 'portable', 'linux-manual'].includes(
      input.channel,
    )
      ? input.channel
      : 'unknown',
    language: safe(input.language),
    theme: safe(input.theme),
  };
}
export function formatSupportInfo(info) {
  return (
    'DarkDesk support information\n' +
    Object.entries(supportInfo(info))
      .map(([key, value]) => key + ': ' + value)
      .join('\n')
  );
}
