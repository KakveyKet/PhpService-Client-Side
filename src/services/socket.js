import { readonly, ref } from 'vue';
import { io } from 'socket.io-client';

const connected = ref(false);
const ready = ref(false);
const connectionError = ref('');
const lastConnectedAt = ref(null);
const lastEventAt = ref(null);

let activeToken = '';
let hasConnectedBefore = false;

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
  path: '/socket.io',
  autoConnect: false,
  transports: ['polling', 'websocket'],
  upgrade: true,
  rememberUpgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 750,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5,
  timeout: 15000
});

function emitBrowserEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

socket.on('connect', () => {
  connected.value = true;
  connectionError.value = '';
  lastConnectedAt.value = new Date().toISOString();
});

socket.on('realtime:ready', (payload = {}) => {
  ready.value = true;
  const wasReconnect = hasConnectedBefore;
  hasConnectedBefore = true;

  emitBrowserEvent('mf:realtime-ready', {
    ...payload,
    reconnect: wasReconnect
  });
});

socket.on('data:changed', (payload = {}) => {
  lastEventAt.value = payload.occurredAt || new Date().toISOString();
});

socket.on('disconnect', (reason) => {
  connected.value = false;
  ready.value = false;

  if (reason === 'io server disconnect' && localStorage.getItem('mf_token')) {
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  connected.value = false;
  ready.value = false;
  connectionError.value = error?.message || 'Real-time connection failed';
});

export const realtimeConnected = readonly(connected);
export const realtimeReady = readonly(ready);
export const realtimeConnectionError = readonly(connectionError);
export const realtimeLastConnectedAt = readonly(lastConnectedAt);
export const realtimeLastEventAt = readonly(lastEventAt);

export function connectRealtime(tokenValue = localStorage.getItem('mf_token')) {
  const token = String(tokenValue || '');
  if (!token) return false;

  if (activeToken && activeToken !== token) {
    socket.disconnect();
  }

  activeToken = token;
  socket.auth = { token };

  if (!socket.connected && !socket.active) {
    socket.connect();
  }

  return true;
}

export function disconnectRealtime() {
  socket.disconnect();
  activeToken = '';
  hasConnectedBefore = false;
  connected.value = false;
  ready.value = false;
  connectionError.value = '';
}

export function reconnectRealtime(tokenValue = localStorage.getItem('mf_token')) {
  socket.disconnect();
  connected.value = false;
  ready.value = false;
  activeToken = '';
  return connectRealtime(tokenValue);
}

export function verifyRealtimeConnection(timeout = 5000) {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ success: false, error: 'Socket is not connected' });
      return;
    }

    socket.timeout(timeout).emit('realtime:ping', (error, response) => {
      if (error) {
        resolve({ success: false, error: 'Real-time ping timed out' });
        return;
      }

      resolve(response || { success: true });
    });
  });
}

export function onRealtimeEvent(eventName, handler) {
  socket.on(eventName, handler);
  return () => socket.off(eventName, handler);
}

export function onDataChanged(topics, handler) {
  const acceptedTopics = new Set(topics);
  const listener = (payload = {}) => {
    if ((payload.topics || []).some((topic) => acceptedTopics.has(topic))) {
      handler(payload);
    }
  };

  socket.on('data:changed', listener);
  return () => socket.off('data:changed', listener);
}
