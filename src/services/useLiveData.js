// ============================================
// useLiveData — keeps a page's data fresh.
// Reloads the signed-in user's snapshot on mount, when the tab regains focus,
// and every `intervalMs`, then re-renders the calling component. This is how a
// newly published course reaches a learner who already has the app open.
// ============================================

import { useEffect, useState } from 'react';
import { loadData } from './dataService';

export const useLiveData = (intervalMs = 20000) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (document.hidden) return;
      if ((await loadData()) && alive) setTick(t => t + 1);
    };
    refresh();
    const timer = setInterval(refresh, intervalMs);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [intervalMs]);
};
