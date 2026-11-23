'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-100 border-b-2 border-yellow-400 px-4 py-3 z-50">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <span className="text-xl">📡</span>
        <div>
          <p className="font-semibold text-yellow-900">You are offline</p>
          <p className="text-sm text-yellow-800">
            Some features may be limited. Changes will sync when you&apos;re back online.
          </p>
        </div>
      </div>
    </div>
  );
}
