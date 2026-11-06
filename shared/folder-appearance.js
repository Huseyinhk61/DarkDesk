import glyphs from './minimal-icons.json' with { type: 'json' };

export const folderThemes = ['gradient', 'solid', 'outline'];
export const folderColors = {
  blue: { fill: '#6388ff', shade: '#3452c2', stroke: '#b9c9ff' },
  purple: { fill: '#a17cf7', shade: '#6540b1', stroke: '#dbc7ff' },
  green: { fill: '#45bb83', shade: '#23744e', stroke: '#b1f5cd' },
  orange: { fill: '#f4a654', shade: '#af6231', stroke: '#ffdcac' },
  slate: { fill: '#8ba2bf', shade: '#4f657d', stroke: '#d1dfef' },
  pink: { fill: '#df71b4', shade: '#994378', stroke: '#ffd0eb' },
  cyan: { fill: '#48c9e4', shade: '#21728f', stroke: '#b8f3ff' },
  teal: { fill: '#43c6b6', shade: '#1f7f79', stroke: '#b5f3e8' },
  amber: { fill: '#edc152', shade: '#9c7621', stroke: '#ffebb2' },
  red: { fill: '#ee7c7c', shade: '#a8444b', stroke: '#ffd0d0' },
};
export const folderColorIds = Object.keys(folderColors);

export function normalizeFolderColor(value) {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.from !== 'string' ||
    typeof value.to !== 'string' ||
    !/^#[a-f0-9]{6}$/i.test(value.from) ||
    !/^#[a-f0-9]{6}$/i.test(value.to)
  )
    throw Error('FOLDER_APPEARANCE_INVALID');
  return { from: value.from.toLowerCase(), to: value.to.toLowerCase() };
}
const channels = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((channel) => parseInt(channel, 16));
const mix = (first, second, amount) =>
  '#' +
  channels(first)
    .map((value, index) =>
      Math.round(value * (1 - amount) + channels(second)[index] * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export function folderPalette(category = {}) {
  const custom = normalizeFolderColor(category.customColor);
  if (!custom) return folderColors[category.color || 'purple'] || folderColors.purple;
  return { fill: custom.from, shade: custom.to, stroke: mix(custom.from, '#ffffff', 0.65) };
}
export function folderAccentStyle(category = {}) {
  const palette = folderPalette(category);
  return {
    '--color': `color-mix(in srgb, ${palette.fill}, var(--ink) 55%)`,
    '--rgb': channels(palette.fill).join(', '),
    '--folder-from': palette.fill,
    '--folder-to': palette.shade,
  };
}
function luminance(hex) {
  const values = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrastingGlyph(palette, theme) {
  const backgrounds = (theme === 'gradient' ? [palette.fill, palette.shade] : [palette.fill]).map(
    luminance,
  );
  const white = Math.min(...backgrounds.map((value) => 1.05 / (value + 0.05)));
  const dark = Math.min(...backgrounds.map((value) => (value + 0.05) / 0.05));
  return white >= dark ? '#ffffff' : '#000000';
}

// Only known tokens and bundled paths enter this SVG. The same artwork is used
// by React previews and the generated Windows ICOs, without loading remote art.
export function folderSvg({
  color = 'purple',
  theme = 'gradient',
  icon = 'folder',
  customColor,
} = {}) {
  if (
    !folderColorIds.includes(color) ||
    !folderThemes.includes(theme) ||
    !Object.hasOwn(glyphs, icon)
  )
    throw Error('FOLDER_APPEARANCE_INVALID');
  const custom = normalizeFolderColor(customColor);
  const palette = folderPalette({ color, customColor: custom }),
    id = custom
      ? `dd-${theme}-${custom.from.slice(1)}-${custom.to.slice(1)}-${icon}`
      : `dd-${theme}-${color}-${icon}`;
  const shape = 'M25 72q0-18 18-18h63l21 21h86q18 0 18 18v112q0 20-20 20H45q-20 0-20-20Z';
  const fill =
    theme === 'gradient' ? `url(#${id})` : theme === 'outline' ? palette.shade : palette.fill;
  const opacity = theme === 'outline' ? '.12' : '1';
  const stroke = theme === 'outline' ? palette.fill : palette.stroke;
  const glyph =
    custom && theme !== 'outline'
      ? contrastingGlyph(palette, theme)
      : theme === 'outline'
        ? palette.fill
        : theme === 'solid' &&
            ['amber', 'orange', 'green', 'cyan', 'teal', 'slate', 'red'].includes(color)
          ? '#152333'
          : '#ffffff';
  const halo =
    glyph === '#ffffff'
      ? '#000000'
      : glyph === '#000000'
        ? '#ffffff'
        : contrastingGlyph({ fill: glyph }, 'solid');
  const outlineHalo =
    custom && theme === 'outline'
      ? `<path d="${shape}" fill="none" stroke="${halo}" stroke-opacity=".7" stroke-width="8" stroke-linejoin="round"/>`
      : '';
  const glyphHalo = custom
    ? `<g transform="translate(87 112) scale(3.4)" fill="none" stroke="${halo}" stroke-opacity=".7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="${glyphs[icon]}"/></g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="${palette.fill}"/><stop offset="1" stop-color="${palette.shade}"/></linearGradient></defs><path d="M25 91V72q0-18 18-18h63l21 21h86q18 0 18 18" fill="${palette.shade}" stroke="${stroke}" stroke-width="3"/>${outlineHalo}<path d="${shape}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${theme === 'outline' ? 5 : 3}" stroke-linejoin="round"/><path d="M38 96h178" fill="none" stroke="${palette.stroke}" stroke-opacity="${theme === 'outline' ? '.45' : '.23'}" stroke-width="2"/>${glyphHalo}<g transform="translate(87 112) scale(3.4)" fill="none" stroke="${glyph}" stroke-width="${theme === 'solid' ? 2 : 1.8}" stroke-linecap="round" stroke-linejoin="round"><path d="${glyphs[icon]}"/></g></svg>`;
}
