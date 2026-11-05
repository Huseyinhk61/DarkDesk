import { classify, defaultSettings, categoryId, matchesRule } from './domain.js';
import { findKnownApp, gameLaunchCategory } from './app-insights.js';
import { fileTypeCategory } from './file-types.js';

// Explain the winning assignment without changing it or treating an estimated
// match as a model probability. Explicit user choices always retain priority.
export function classificationReason(item, settings = defaultSettings) {
  const categories = settings.categories || defaultSettings.categories;
  const known = new Set(categories.map((category) => category.id));
  const assigned = classify(item, settings);
  const base = { categoryId: assigned, needsReview: false };
  if (known.has(categoryId(settings.overrides?.[item.id])))
    return { ...base, source: 'manual', confidence: 'explicit' };
  const rule = (settings.rules || []).find(
    (candidate) =>
      candidate.enabled !== false &&
      known.has(candidate.categoryId) &&
      matchesRule(candidate, item),
  );
  if (rule)
    return {
      ...base,
      source: 'rule',
      confidence: 'explicit',
      ruleId: rule.id,
      rulePattern: rule.pattern,
    };
  if (gameLaunchCategory(item.launchUrl))
    return { ...base, source: 'protocol', confidence: 'high' };
  const app = findKnownApp(item);
  if (app) return { ...base, source: 'catalog', confidence: 'high', appName: app.name };
  if (fileTypeCategory(item.name) && !['financeaccounting', 'learningcourses'].includes(assigned))
    return { ...base, source: 'filetype', confidence: 'medium' };
  if (assigned === 'system')
    return { ...base, source: 'fallback', confidence: 'low', needsReview: true };
  return { ...base, source: 'heuristic', confidence: 'medium' };
}

export function categoryTrail(id, categories) {
  const index = new Map(categories.map((category) => [category.id, category]));
  const trail = [],
    seen = new Set();
  let current = index.get(categoryId(id));
  while (current && !seen.has(current.id) && trail.length < 16) {
    seen.add(current.id);
    trail.unshift(current);
    current = index.get(current.parentId);
  }
  return trail;
}

// Each item contributes once to its category and each ancestor. Parent lookups
// are indexed rather than re-scanning every group for a large file collection.
export function summarizeGroups(items, categories) {
  const index = new Map(categories.map((category) => [category.id, category]));
  const summary = new Map(
    categories.map((category) => [category.id, { total: 0, apps: 0, files: 0, direct: 0 }]),
  );
  for (const item of items) {
    const id = categoryId(item.category);
    let category = index.get(id);
    const visited = new Set();
    const app =
      item.kind === 'installed' ||
      item.kind === 'shortcut' ||
      /\.(?:lnk|exe|url|app|desktop|appimage|webloc)$/i.test(item.name || '');
    while (category && !visited.has(category.id) && visited.size < 16) {
      visited.add(category.id);
      const count = summary.get(category.id);
      count.total++;
      count[app ? 'apps' : 'files']++;
      if (category.id === id) count.direct++;
      category = index.get(category.parentId);
    }
  }
  return summary;
}

export function sanitizeGroupView(value) {
  return {
    sort: ['manual', 'count', 'name'].includes(value?.sort) ? value.sort : 'manual',
    showEmpty: typeof value?.showEmpty === 'boolean' ? value.showEmpty : true,
  };
}
