import { useEffect, useRef, useState } from 'react';
import { api } from '../service';
import { usePreferences } from '../preferences';
import { resolveAppPurpose } from '../../shared/app-insights';
import '../purpose-plus.css';

const cache = new Map(),
  queue = [];
let running = 0;
const keyFor = (item) =>
  JSON.stringify([item.id, item.source, item.target, item.modified, item.size]);
function drain() {
  while (running < 2 && queue.length) {
    const task = queue.shift();
    running++;
    Promise.resolve()
      .then(task.run)
      .then(task.resolve, task.reject)
      .finally(() => {
        running--;
        drain();
      });
  }
}
function load(item) {
  if (typeof api.itemPurpose !== 'function') return Promise.resolve(null);
  const key = keyFor(item),
    cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.promise;
  }
  if (queue.length >= 24) return Promise.resolve(null);
  const record = { expires: Infinity };
  record.promise = new Promise((resolve, reject) => {
    queue.push({ run: () => api.itemPurpose(item.id), resolve, reject });
    drain();
  })
    .then((value) => {
      record.expires = Date.now() + (value?.description ? 300000 : 15000);
      return value;
    })
    .catch(() => {
      record.expires = Date.now() + 15000;
      return null;
    });
  cache.set(key, record);
  while (cache.size > 256) cache.delete(cache.keys().next().value);
  return record.promise;
}
export default function NativePurpose({ item, metadata: provided, detail = false }) {
  const { settings, t, language } = usePreferences();
  const ref = useRef(null),
    [metadata, setMetadata] = useState(null);
  const manual = settings.itemDescriptions?.[item.id];
  useEffect(() => {
    let active = true,
      observer;
    setMetadata(provided || null);
    if (
      provided !== undefined ||
      manual ||
      !(/\.(exe|lnk)$/i.test(item.source || item.name || '') || item.kind === 'installed')
    )
      return;
    const read = () =>
      load(item).then((value) => {
        if (active) setMetadata(value);
      });
    if (detail || !('IntersectionObserver' in window)) read();
    else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          read();
        }
      });
      observer.observe(ref.current);
    }
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [item.id, item.source, item.target, item.modified, item.size, provided, manual, detail]);
  const purpose = resolveAppPurpose(item, manual, metadata);
  const text =
    purpose.description?.[language] || purpose.description?.en || purpose.description?.tr || '';
  const source =
    purpose.source === 'manual'
      ? 'manual'
      : ['windows-version-info', 'windows-shortcut'].includes(purpose.source)
        ? 'metadata'
        : purpose.source === 'local-catalog'
          ? 'catalog'
          : 'estimate';
  return (
    <div
      ref={ref}
      className={detail ? 'item-purpose-detail purpose-detail-enhanced' : 'item-purpose'}
      data-description-source={source}
    >
      {detail && <h3>{t('purpose.title')}</h3>}
      <span
        className={`purpose-badge ${source === 'catalog' ? 'known' : ''} purpose-source-${source}`}
      >
        {t('purposePlus.source.' + source)}
      </span>
      <p title={text}>{text}</p>
      {detail && <small>{t('purposePlus.note.' + source)}</small>}
    </div>
  );
}
