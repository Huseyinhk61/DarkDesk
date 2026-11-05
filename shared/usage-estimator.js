import catalog from './catalog.json' with { type: 'json' };
import { findKnownApp } from './app-insights.js';

const day = 86400000;
const categoryPatterns = {
  software: 'intensive',
  softwareide: 'intensive',
  softwaredatabase: 'intensive',
  softwaredevops: 'intensive',
  softwareterminal: 'intensive',
  design: 'project',
  internetbrowsers: 'continuous',
  internetchat: 'regular',
  internetmeetings: 'scheduled',
  internet: 'regular',
  office: 'regular',
  finance: 'regular',
  learning: 'focused',
  games: 'session',
  media: 'session',
  system: 'onDemand',
  archive: 'onDemand',
};
const timestamp = (value, now) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now;

function categoryPattern(item, categories) {
  const index = new Map(
    categories
      .filter((category) => category && typeof category.id === 'string')
      .map((category) => [category.id, category]),
  );
  const id = Number.isInteger(item.category) ? catalog[item.category]?.id : item.category;
  let category = index.get(id);
  // Use the user's actual hierarchy first. An arbitrary custom group is never
  // treated as a built-in merely because its name happens to contain a keyword.
  if (!category) {
    const known = findKnownApp(item);
    category = index.get(known?.categoryId);
  }
  const visited = new Set();
  while (category && !visited.has(category.id) && visited.size < 16) {
    visited.add(category.id);
    if (Object.hasOwn(categoryPatterns, category.id)) return categoryPatterns[category.id];
    category = index.get(category.parentId);
  }
  return 'onDemand';
}

// Returns translation keys rather than claiming to measure Windows process
// uptime. Recorded launches win; absent/corrupt data falls back to a clearly
// identified category estimate. Passing a clock makes every threshold testable.
export function estimateUsage(item = {}, categories = catalog, now = Date.now()) {
  item = item && typeof item === 'object' ? item : {};
  categories = Array.isArray(categories) ? categories : catalog;
  const usage = item.usage;
  if (
    Number.isFinite(now) &&
    now > 0 &&
    usage?.scope === 'darkdesk-only' &&
    Number.isSafeInteger(usage.count) &&
    usage.count > 0 &&
    timestamp(usage.lastOpened, now)
  ) {
    const age = (now - usage.lastOpened) / day;
    const window = timestamp(usage.firstSeen, usage.lastOpened) ? (now - usage.firstSeen) / day : 0;
    const weekly = window >= 7 ? (usage.count * 7) / window : 0;
    const pattern =
      age > 90
        ? 'inactive'
        : age <= 7 && weekly >= 7
          ? 'intensive'
          : age <= 14 && weekly >= 2
            ? 'frequent'
            : age <= 7
              ? 'recent'
              : 'previous';
    return {
      source: 'history',
      pattern,
      labelKey: `usageEstimate.observed.${pattern}`,
      noteKey: 'usageEstimate.historyNote',
      params: { count: usage.count },
    };
  }
  const pattern = categoryPattern(item, categories);
  return {
    source: 'category',
    pattern,
    labelKey: `usageEstimate.category.${pattern}`,
    noteKey: 'usageEstimate.categoryNote',
    params: {},
  };
}
