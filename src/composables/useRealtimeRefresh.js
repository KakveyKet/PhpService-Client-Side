import { onBeforeUnmount, onMounted } from 'vue';
import { onDataChanged } from '../services/socket.js';

export function useRealtimeRefresh(topics, refresh, delay = 250) {
  let unsubscribe = null;
  let timer = null;
  let refreshing = false;
  let refreshQueued = false;

  async function runRefresh(payload) {
    if (refreshing) {
      refreshQueued = true;
      return;
    }

    refreshing = true;
    try {
      await refresh(payload);
    } finally {
      refreshing = false;

      if (refreshQueued) {
        refreshQueued = false;
        scheduleRefresh({ action: 'REALTIME_QUEUED_REFRESH' });
      }
    }
  }

  function scheduleRefresh(payload) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => runRefresh(payload), delay);
  }

  function resynchronize() {
    scheduleRefresh({ action: 'REALTIME_RESYNCHRONIZED' });
  }

  onMounted(() => {
    unsubscribe = onDataChanged(topics, scheduleRefresh);
    window.addEventListener('mf:realtime-ready', resynchronize);
  });

  onBeforeUnmount(() => {
    window.clearTimeout(timer);
    unsubscribe?.();
    window.removeEventListener('mf:realtime-ready', resynchronize);
  });
}

