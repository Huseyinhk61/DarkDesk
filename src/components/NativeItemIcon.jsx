import { useEffect, useRef, useState } from 'react';
import { api } from '../service';
import AppIcon from './AppIcon';
import '../details.css';

// Keep native extraction off the scan path and bound work when a large index is rendered.
const icons = new Map();
const queue = [];
let running = 0;
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
function loadIcon(item) {
  const key = JSON.stringify([item.id, item.source, item.target, item.modified, item.size]);
  if (icons.has(key)) {
    const cached = icons.get(key);
    icons.delete(key);
    icons.set(key, cached);
    return cached;
  }
  const pending = new Promise((resolve, reject) => {
    queue.push({ run: () => api.itemIcon(item.id), resolve, reject });
    drain();
  })
    .then((value) => {
      const icon = value?.icon;
      return typeof icon === 'string' &&
        icon.length <= 2_000_000 &&
        /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(icon)
        ? icon
        : null;
    })
    .catch(() => {
      icons.delete(key);
      return null;
    });
  icons.set(key, pending);
  while (icons.size > 256) icons.delete(icons.keys().next().value);
  return pending;
}

export default function NativeItemIcon({ item, fallback = 'file', size = 28, eager = false }) {
  const ref = useRef(null);
  const [icon, setIcon] = useState(null);
  useEffect(() => {
    let active = true;
    setIcon(null);
    const load = () => loadIcon(item).then((value) => active && setIcon(value));
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
  }, [item.id, item.source, item.target, item.modified, item.size, eager]);
  return (
    <span
      ref={ref}
      className="native-item-icon"
      data-icon-source={icon ? 'native' : 'fallback'}
      style={{ width: size, height: size }}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setIcon(null)}
        />
      ) : (
        <AppIcon name={fallback} size={size} />
      )}
    </span>
  );
}
