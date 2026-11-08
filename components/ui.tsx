'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/domain';
import { locale, t, useLang } from './i18n';
export { t } from './i18n';

export async function api<T = any>(url: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e: any = new Error(data.error ? t(data.error) : t('Ошибка {n}', { n: res.status }));
    e.status = res.status;
    throw e;
  }
  return data;
}

export function useMe() {
  const [me, setMe] = useState<any>(undefined);
  const reload = useCallback(() => api('/api/me').then(setMe).catch(() => setMe({ user: null })), []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { me, reload };
}

export async function logout() {
  await api('/api/auth/logout', { body: {} });
  location.href = '/';
}

export function usePoll(fn: () => any, ms = 8000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    const onVis = () => document.visibilityState === 'visible' && ref.current();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms]);
}

let toastSet: ((s: string | null) => void) | null = null;
export function toast(s: string) {
  toastSet?.(s);
}
export function Toaster() {
  useLang();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2800);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div className="toast">{msg}</div> : null;
}

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_COLOR[status] || 'gray'}`}>{t(STATUS_LABEL[status] || status)}</span>;
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn plain" onClick={onClose} aria-label={t('Закрыть')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Photo({ src, className = 'photo' }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={src} className={className} alt="" loading="lazy" onClick={() => setOpen(true)} />
      {open && (
        <div className="lightbox" onClick={() => setOpen(false)}>
          <img src={src} alt="" />
        </div>
      )}
    </>
  );
}

async function compress(file: File, max = 1400, quality = 0.75): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}

export async function uploadPhoto(file: File): Promise<string> {
  const blob = await compress(file);
  const fd = new FormData();
  fd.append('file', blob, 'photo.jpg');
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(t(data.error || 'Не удалось загрузить фото'));
  return data.url;
}

/** Opens the camera (on phones) and uploads the photo */
export function PhotoButton({
  onUploaded,
  children,
  className = 'btn ghost',
  disabled,
}: {
  onUploaded: (url: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            onUploaded(await uploadPhoto(f));
          } catch (er: any) {
            toast(er.message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" className={className} disabled={busy || disabled} onClick={() => ref.current?.click()}>
        {busy ? <span className="spin" /> : children}
      </button>
    </>
  );
}

export function PhotoList({ urls, onRemove }: { urls: string[]; onRemove?: (i: number) => void }) {
  return (
    <>
      {urls.map((u, i) => (
        <div className="ph-wrap" key={u}>
          <Photo src={u} />
          {onRemove && (
            <button type="button" className="ph-x" onClick={() => onRemove(i)} aria-label={t('Удалить')}>
              ×
            </button>
          )}
        </div>
      ))}
    </>
  );
}

export function fmtDate(s?: string) {
  if (!s) return '';
  const d = new Date(s);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return same ? t('сегодня {time}', { time }) : `${d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} ${time}`;
}

export function fmtWhen(w?: string) {
  if (!w || w === 'asap') return t('Как можно скорее');
  return fmtDate(w);
}

export function addrLine(a: any = {}, full = true) {
  const parts = [a.street && `${a.street}, ${a.house}`];
  if (full) {
    if (a.entrance) parts.push(t('подъезд {n}', { n: a.entrance }));
    if (a.floor) parts.push(t('этаж {n}', { n: a.floor }));
    if (a.apt) parts.push(t('кв. {n}', { n: a.apt }));
  } else if (a.floor) parts.push(t('этаж {n}', { n: a.floor }));
  return parts.filter(Boolean).join(', ');
}

export function mapsLink(a: any = {}) {
  if (a.lat && a.lng) return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`;
  const q = encodeURIComponent([a.city, a.street, a.house].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function Spinner() {
  return (
    <div className="center" style={{ padding: 40 }}>
      <span className="spin" />
    </div>
  );
}

export const Icon = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20M16 15h2" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  repeat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
  ),
};

export function TabBar({ tabs, value, onChange }: { tabs: { key: string; label: string; icon: ReactNode; dot?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar">
      <div className="in">
        {tabs.map((tb) => (
          <button key={tb.key} className={value === tb.key ? 'on' : ''} onClick={() => onChange(tb.key)}>
            {tb.icon}
            {tb.label}
            {!!tb.dot && <span className="dot">{tb.dot}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
