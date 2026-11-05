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

// Only known tokens and bundled paths enter this SVG. The same artwork is used
// by React previews and the generated Windows ICOs, without loading remote art.
export function folderSvg({ color = 'purple', theme = 'gradient', icon = 'folder' } = {}) {
  if (
    !folderColorIds.includes(color) ||
    !folderThemes.includes(theme) ||
    !Object.hasOwn(glyphs, icon)
  )
    throw Error('FOLDER_APPEARANCE_INVALID');
  const palette = folderColors[color],
    id = `dd-${theme}-${color}-${icon}`;
  const shape = 'M25 72q0-18 18-18h63l21 21h86q18 0 18 18v112q0 20-20 20H45q-20 0-20-20Z';
  const fill =
    theme === 'gradient' ? `url(#${id})` : theme === 'outline' ? palette.shade : palette.fill;
  const opacity = theme === 'outline' ? '.12' : '1';
  const stroke = theme === 'outline' ? palette.fill : palette.stroke;
  const glyph =
    theme === 'outline'
      ? palette.fill
      : theme === 'solid' &&
          ['amber', 'orange', 'green', 'cyan', 'teal', 'slate', 'red'].includes(color)
        ? '#152333'
        : '#ffffff';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="${palette.fill}"/><stop offset="1" stop-color="${palette.shade}"/></linearGradient></defs><path d="M25 91V72q0-18 18-18h63l21 21h86q18 0 18 18" fill="${palette.shade}" stroke="${stroke}" stroke-width="3"/><path d="${shape}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${theme === 'outline' ? 5 : 3}" stroke-linejoin="round"/><path d="M38 96h178" fill="none" stroke="${palette.stroke}" stroke-opacity="${theme === 'outline' ? '.45' : '.23'}" stroke-width="2"/><g transform="translate(87 112) scale(3.4)" fill="none" stroke="${glyph}" stroke-width="${theme === 'solid' ? 2 : 1.8}" stroke-linecap="round" stroke-linejoin="round"><path d="${glyphs[icon]}"/></g></svg>`;
}
