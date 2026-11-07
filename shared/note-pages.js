// Source offsets preserve every character; pagination never changes saved notes.
// The editor uses a monospace grid. Wide Unicode symbols occupy two cells,
// combining/zero-width characters none, and tabs advance to four-cell stops.
export function notePages(text, columns = 26, rows = 5) {
  columns = Math.max(2, Math.floor(columns));
  rows = Math.max(1, Math.floor(rows));
  const pages = [];
  let start = 0,
    column = 0,
    row = 1,
    offset = 0;
  for (const character of text) {
    const code = character.codePointAt(0),
      newline = character === '\n';
    const cells = () =>
      character === '\t'
        ? 4 - (column % 4)
        : /\p{Mark}|[\u200b-\u200f\ufeff]/u.test(character) || character === '\r'
          ? 0
          : code > 0xffff ||
              (code >= 0x1100 &&
                (code <= 0x115f ||
                  (code >= 0x2e80 && code <= 0xa4cf) ||
                  (code >= 0xac00 && code <= 0xd7af) ||
                  (code >= 0xf900 && code <= 0xfaff) ||
                  (code >= 0xfe10 && code <= 0xfe6f) ||
                  (code >= 0xff01 && code <= 0xff60)))
            ? 2
            : 1;
    let width = cells();
    if ((newline && row >= rows) || (!newline && column + width > columns && row >= rows)) {
      pages.push({ start, end: offset });
      start = offset;
      column = 0;
      row = 1;
      width = cells();
    }
    if (newline) {
      row++;
      column = 0;
    } else {
      if (column + width > columns) {
        row++;
        column = 0;
        width = cells();
      }
      column += width;
    }
    offset += character.length;
  }
  pages.push({ start, end: text.length });
  return pages;
}
