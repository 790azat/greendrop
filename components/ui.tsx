'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/domain';
import { locale, t, useLang } from './i18n';
import { I } from './Icons';
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
          <button className="iconbtn" onClick={onClose} aria-label={t('Закрыть')}>
            <I n="x" size={20} />
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
  plus: <I n="plus" size={24} stroke={2.2} />,
  list: <I n="list" size={24} />,
  user: <I n="user" size={24} />,
  home: <I n="home" size={24} />,
  inbox: <I n="inbox" size={24} />,
  truck: <I n="truck" size={24} />,
  wallet: <I n="wallet" size={24} />,
  check: <I n="check" size={18} stroke={3.2} />,
  repeat: <I n="repeat" size={24} />,
  map: <I n="map" size={24} />,
  camera: <I n="camera" size={22} />,
  chart: <I n="chart" size={24} />,
};

export function TabBar({ tabs, value, onChange }: { tabs: { key: string; label: string; icon: ReactNode; dot?: number; primary?: boolean }[]; value: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar">
      <div className="in">
        {tabs.map((tb) => (
          <button key={tb.key} className={`${value === tb.key ? 'on' : ''} ${tb.primary ? 'primary' : ''}`} onClick={() => onChange(tb.key)} aria-current={value === tb.key ? 'page' : undefined}>
            {tb.primary ? <span className="fab">{tb.icon}</span> : tb.icon}
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

/** Settings-style list row: icon, title, optional hint, and a right-side value or chevron */
export function MenuRow({
  icon, title, hint, right, onClick, href, tone = 'green', danger,
}: { icon: string; title: ReactNode; hint?: ReactNode; right?: ReactNode; onClick?: () => void; href?: string; tone?: 'green' | 'gray' | 'amber' | 'blue' | 'red'; danger?: boolean }) {
  const inner = (
    <>
      <span className={`ibox ${danger ? 'red' : tone}`}><I n={icon} size={20} /></span>
      <span className="grow">
        <span className="mr-t">{title}</span>
        {hint && <span className="mr-h">{hint}</span>}
      </span>
      {right ?? ((onClick || href) && <I n="chevron" size={18} style={{ color: 'var(--muted)' }} />)}
    </>
  );
  if (href) return <a className={`mrow ${danger ? 'danger' : ''}`} href={href}>{inner}</a>;
  if (onClick) return <button type="button" className={`mrow ${danger ? 'danger' : ''}`} onClick={onClick}>{inner}</button>;
  return <div className="mrow">{inner}</div>;
}

/** Collapsible block for secondary options (keeps screens short) */
export function Disclosure({ icon, title, hint, children, defaultOpen = false }: { icon: string; title: ReactNode; hint?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`disc ${open ? 'open' : ''}`}>
      <MenuRow icon={icon} title={title} hint={hint} tone="gray" onClick={() => setOpen(!open)} right={<I n="down" size={18} className="disc-arrow" />} />
      {open && <div className="disc-body">{children}</div>}
    </div>
  );
}

/** Section title with an icon */
export function SectionTitle({ icon, children, right }: { icon: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="sec-t">
      <I n={icon} size={18} />
      <span className="grow">{children}</span>
      {right}
    </div>
  );
}
