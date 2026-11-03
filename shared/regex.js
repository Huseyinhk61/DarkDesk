import { RE2JS } from 're2js';
const cache = new Map();
export function compileRule(pattern) {
  if (typeof pattern !== 'string' || !pattern || pattern.length > 256)
    throw Error('RULE_REGEX_INVALID');
  try {
    if (!cache.has(pattern)) {
      if (cache.size > 512) cache.clear();
      cache.set(pattern, RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE));
    }
    return cache.get(pattern);
  } catch {
    throw Error('RULE_REGEX_INVALID');
  }
}
export function regexMatches(pattern, text) {
  return compileRule(pattern).test(String(text));
}
