type SyncTopic = 'all' | 'dashboard' | 'billing' | 'stores' | 'notifications' | 'network';
type SyncListener = (topic: SyncTopic) => void;

const listeners = new Set<SyncListener>();

export function subscribeRealtimeSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitRealtimeSync(topic: SyncTopic = 'all'): void {
  listeners.forEach((listener) => {
    try {
      listener(topic);
    } catch {
      // Ignore individual subscriber errors cleanly
    }
  });
}
