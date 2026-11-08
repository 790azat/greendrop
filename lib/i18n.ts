// Translation core shared by server (push notifications) and client (UI).
// Russian is the source language: every key in DICT is the Russian text,
// keys may contain {placeholders} so dynamic server strings can be translated too.
import { DICT } from './dict';

export type Lang = 'ru' | 'hy' | 'en';
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'hy', label: 'Հայերեն', short: 'ՀԱՅ' },
  { id: 'ru', label: 'Русский', short: 'РУС' },
  { id: 'en', label: 'English', short: 'ENG' },
];
export const isLang = (x: any): x is Lang => x === 'ru' || x === 'hy' || x === 'en';
export const LOCALE: Record<Lang, string> = { ru: 'ru-RU', hy: 'hy-AM', en: 'en-GB' };

const IDX = { hy: 0, en: 1 } as const;

type Tpl = { re: RegExp; names: string[]; key: string };
let tpls: Tpl[] | null = null;

function templates() {
  if (tpls) return tpls;
  tpls = [];
  for (const key of Object.keys(DICT)) {
    if (!key.includes('{')) continue;
    const names: string[] = [];
    const src = key
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = part.match(/^\{(\w+)\}$/);
        if (m) {
          names.push(m[1]);
          return '([\\s\\S]+?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    tpls.push({ re: new RegExp(`^${src}$`), names, key });
  }
  // longer (more specific) templates first
  tpls.sort((a, b) => b.key.length - a.key.length);
  return tpls;
}

function fill(s: string, vars: Record<string, any>) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Translate a Russian source string (exact key or a text produced from a {template} key) */
export function tr(lang: Lang, s: any, vars?: Record<string, any>): string {
  if (s == null) return '';
  const text = String(s);
  let out = text;
  if (lang !== 'ru' && text) {
    const e = DICT[text];
    if (e) out = e[IDX[lang]] || text;
    else if (!vars) {
      for (const t of templates()) {
        const m = text.match(t.re);
        if (!m) continue;
        const v: Record<string, string> = {};
        t.names.forEach((n, i) => (v[n] = tr(lang, m[i + 1])));
        out = fill(DICT[t.key][IDX[lang]] || t.key, v);
        break;
      }
    }
  }
  // 'Text|context' keys: the part after | only disambiguates the key
  if (out === text && text.includes('|')) out = text.split('|')[0];
  return vars ? fill(out, vars) : out;
}
