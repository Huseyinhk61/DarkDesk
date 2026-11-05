import { buildWebSearch } from '../shared/launcher-tools';
export function browserLauncherCapabilities() {
  return {
    system: [],
    admin: false,
    reveal: false,
    web: true,
    copy: !!navigator.clipboard?.writeText,
  };
}
export async function browserLauncherAction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('LAUNCHER_INPUT_INVALID');
  if (input.type === 'copy') {
    if (
      typeof input.text !== 'string' ||
      !input.text.length ||
      input.text.length > 16384 ||
      input.text.includes('\0')
    )
      throw Error('LAUNCHER_INPUT_INVALID');
    if (!navigator.clipboard?.writeText) throw Error('LAUNCHER_UNSUPPORTED');
    await navigator.clipboard.writeText(input.text);
    return { type: 'copy', copied: true };
  }
  if (input.type === 'web') {
    let url;
    try {
      url = buildWebSearch(input.provider, input.query);
    } catch {
      throw Error('LAUNCHER_INPUT_INVALID');
    }
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    // With noopener, modern browsers may return null even when the new tab opens.
    if (opened) opened.opener = null;
    return { type: 'web', opened: true };
  }
  throw Error('LAUNCHER_UNSUPPORTED');
}
