import { useEffect, useRef, useState } from 'react';
import { api } from '../service';
import { usePreferences } from '../preferences';
import AppIcon from './AppIcon';
import '../details.css';
import '../item-presentations.css';

const icons = new Map();
const queue = [];
const listeners = new Set();
let running = 0,
  revision = 0;
export function refreshNativeIcons() {
  icons.clear();
  revision++;
  listeners.forEach((listener) => listener(revision));
}
function drain() {
  while (running < 4 && queue.length) {
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
function keyFor(item) {
  return JSON.stringify([item.id, item.source, item.target, item.modified, item.size]);
}
function validPng(value) {
  if (
    typeof value !== 'string' ||
    value.length > 2_000_000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
  )
    return false;
  try {
    const bytes = atob(value.slice(value.indexOf(',') + 1));
    return (
      bytes.length >= 33 &&
      bytes.slice(0, 8) === '\x89PNG\r\n\x1a\n' &&
      bytes.slice(12, 16) === 'IHDR'
    );
  } catch {
    return false;
  }
}
function loadIcon(item, refresh) {
  const key = keyFor(item);
  const cached = icons.get(key);
  if (cached && cached.expires > Date.now()) {
    icons.delete(key);
    icons.set(key, cached);
    return cached.promise;
  }
  const record = { expires: Infinity };
  record.promise = new Promise((resolve, reject) => {
    queue.push({ run: () => api.itemIcon(item.id, refresh), resolve, reject });
    drain();
  })
    .then((value) => {
      const icon = validPng(value?.icon) ? value.icon : null;
      // Unavailable icons can be retried; a transient extraction failure is not permanent.
      record.expires = icon ? Infinity : Date.now() + 15_000;
      return icon;
    })
    .catch(() => {
      record.expires = Date.now() + 15_000;
      return null;
    });
  icons.set(key, record);
  while (icons.size > 256) icons.delete(icons.keys().next().value);
  return record.promise;
}
function initials(item) {
  const name = (item.insight?.displayName || item.name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  const words = name.split(/\s+/).filter(Boolean);
  return (
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => word[0])
          .join('')
      : words[0]?.slice(0, 2) || '?'
  ).toLocaleUpperCase();
}
export default function NativeItemIcon({ item, fallback = 'file', size = 28, eager = false }) {
  const { t } = usePreferences();
  const ref = useRef(null);
  const [icon, setIcon] = useState(null),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    listeners.add(setRefresh);
    return () => listeners.delete(setRefresh);
  }, []);
  useEffect(() => {
    let active = true;
    setIcon(null);
    const load = () => loadIcon(item, refresh > 0).then((value) => active && setIcon(value));
    let observer;
    if (eager || !('IntersectionObserver' in window)) load();
    else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: '180px' },
      );
      observer.observe(ref.current);
    }
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [item.id, item.source, item.target, item.modified, item.size, eager, refresh]);
  return (
    <span
      ref={ref}
      className="native-item-icon"
      data-icon-source={icon ? 'native' : 'fallback'}
      title={t(icon ? 'purpose.originalIcon' : 'purpose.fallbackIcon')}
      style={{ width: size, height: size, '--monogram-size': `${Math.max(11, size * 0.4)}px` }}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => {
            icons.delete(keyFor(item));
            setIcon(null);
          }}
        />
      ) : (
        <span className="app-monogram" aria-hidden="true">
          <span>{initials(item)}</span>
          <AppIcon className="monogram-category" name={fallback} size={Math.max(10, size * 0.36)} />
        </span>
      )}
    </span>
  );
}
