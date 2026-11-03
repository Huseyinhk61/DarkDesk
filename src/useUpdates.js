import { useEffect, useState } from 'react';
import { api } from './service';

const initialUpdate = { state: 'idle', version: null, currentVersion: null, progress: null };
export function useUpdates(enabled = true) {
  const [update, setUpdate] = useState(initialUpdate);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const accept = (value) => {
      if (active && value && typeof value.state === 'string') setUpdate(value);
    };
    if (typeof api.updateStatus !== 'function') {
      accept({ ...initialUpdate, state: 'unsupported', reason: 'unavailable' });
      return;
    }
    let receivedEvent = false;
    const unsubscribe = api.onUpdateChanged?.((value) => {
      receivedEvent = true;
      accept(value);
    });
    api
      .updateStatus()
      .then((value) => {
        if (!receivedEvent) accept(value);
      })
      .catch(() => accept({ ...initialUpdate, state: 'error', errorCode: 'UPDATE_CHECK_FAILED' }));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled]);
  return update;
}
