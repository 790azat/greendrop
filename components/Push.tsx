'use client';
import { useEffect, useState } from 'react';
import { api, toast } from './ui';

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle({ vapidKey }: { vapidKey?: string | null }) {
  const [state, setState] = useState<'unknown' | 'on' | 'off' | 'unsupported' | 'ios-install'>('unknown');

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone) ?? false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey) {
      setState(ios && !standalone ? 'ios-install' : 'unsupported');
      return;
    }
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setState(s ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [vapidKey]);

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return toast('Разрешите уведомления в настройках браузера');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey!) });
      await api('/api/push', { body: { subscription: sub.toJSON(), test: true } });
      setState('on');
      toast('Уведомления включены');
    } catch (e: any) {
      toast(e.message || 'Не удалось включить уведомления');
    }
  }
  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api('/api/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setState('off');
  }

  if (state === 'unknown') return null;
  if (state === 'ios-install')
    return (
      <div className="note small">
        🔔 На iPhone уведомления работают, когда приложение установлено на экран «Домой». <a href="/install">Как установить</a>
      </div>
    );
  if (state === 'unsupported') return <div className="small muted">🔔 Push-уведомления не поддерживаются в этом браузере.</div>;
  return state === 'on' ? (
    <button className="btn ghost block" onClick={disable}>🔔 Уведомления включены · выключить</button>
  ) : (
    <button className="btn block" onClick={enable}>🔔 Включить уведомления</button>
  );
}
