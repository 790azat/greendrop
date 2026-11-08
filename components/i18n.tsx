'use client';
import { useEffect, useReducer } from 'react';
import { LANGS, LOCALE, Lang, isLang, tr } from '@/lib/i18n';

let lang: Lang = 'ru';
let inited = false;
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const saved = localStorage.getItem('gd_lang');
    if (isLang(saved)) return saved;
  } catch {}
  const m = document.cookie.match(/(?:^|; )gd_lang=(\w+)/);
  if (m && isLang(m[1])) return m[1];
  const n = (navigator.language || '').toLowerCase();
  if (n.startsWith('hy')) return 'hy';
  if (n.startsWith('en')) return 'en';
  return 'ru';
}

export function getLang(): Lang {
  if (!inited && typeof window !== 'undefined') {
    inited = true;
    lang = detect();
    document.documentElement.lang = lang;
  }
  return lang;
}

export const locale = () => LOCALE[getLang()];

/** Translate a Russian source string into the current language */
export function t(s: any, vars?: Record<string, any>) {
  return tr(getLang(), s, vars);
}

export function setLang(l: Lang, sync = true) {
  lang = l;
  inited = true;
  try {
    localStorage.setItem('gd_lang', l);
  } catch {}
  document.cookie = `gd_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
  // the server uses it for push notifications
  if (sync) fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: l }) }).catch(() => {});
}

/** Re-render the component when the language changes */
export function useLang() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return getLang();
}

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const cur = useLang();
  return (
    <div className={`langs ${compact ? 'compact' : ''}`} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={cur === l.id ? 'on' : ''} onClick={() => setLang(l.id)} title={l.label}>
          {compact ? l.short : l.label}
        </button>
      ))}
    </div>
  );
}
