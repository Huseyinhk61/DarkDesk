export function fuzzyScore(query, text) {
  const normalize = (v) =>
    String(v)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const q = normalize(query).trim(),
    value = normalize(text);
  if (!q) return 1;
  if (value === q) return 1000;
  if (value.startsWith(q)) return 700 - q.length * 0.01;
  if (value.includes(q)) return 500 - value.indexOf(q);
  let score = 0,
    index = 0,
    last = -2;
  for (const char of q) {
    if (char === ' ') continue;
    const found = value.indexOf(char, index);
    if (found < 0) return 0;
    score += found === last + 1 ? 14 : 4;
    if (found === 0 || /[\s_\-./]/.test(value[found - 1])) score += 8;
    last = found;
    index = found + 1;
  }
  return score / (1 + value.length * 0.005);
}
export function searchEntries(query, entries) {
  return entries
    .map((entry) => ({
      ...entry,
      score:
        fuzzyScore(query, entry.searchText || entry.name) +
        (!query ? Math.min(30, entry.usage?.count || 0) + (entry.command ? 12 : 0) : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 9);
}
