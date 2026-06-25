/**
 * push.ts — turning on device notifications (M-C). Registers the service worker, asks
 * permission, subscribes via the Push API with the server's VAPID key, and registers the
 * subscription with the API. Everything is feature-detected so it's a safe no-op where
 * push isn't available (older browsers, SSR/tests, iOS without an installed PWA).
 */

import type { ApiClient } from './api/client.js';

export type EnableResult = 'on' | 'denied' | 'unsupported' | 'unavailable' | 'error';

export function notificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** VAPID keys arrive base64url; the Push API wants a Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enableNotifications(client: ApiClient): Promise<EnableResult> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    const key = await client.vapidKey();
    if (!key) return 'unavailable';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register('/sw.js');
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }));
    await client.subscribePush(sub.toJSON());
    return 'on';
  } catch {
    return 'error';
  }
}
