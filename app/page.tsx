'use client';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { api, t, useMe } from '@/components/ui';
import { LangSwitch, useLang } from '@/components/i18n';
import { I, IconBox } from '@/components/Icons';
import { Onboarding } from '@/components/Onboarding';

type Mode = 'login' | 'register';
const go = (role: string) => (location.href = role === 'admin' ? '/admin' : role === 'worker' ? '/worker' : '/client');

export default function Home() {
  useLang();
  const { me } = useMe();
  const [role, setRole] = useState<'client' | 'worker'>('client');
  const [method, setMethod] = useState<'sms' | 'pin'>('sms');
  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState<{ exists: boolean; demoCode?: string } | null>(null);
  const [needName, setNeedName] = useState(false);
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const r = me?.user?.role;
    if (r) location.replace(r === 'admin' ? '/admin' : r === 'worker' ? '/worker' : '/client');
  }, [me]);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('role') === 'worker') setRole('worker');
    const r = p.get('ref');
    try {
      if (r) localStorage.setItem('gd_ref', r);
      setRef(r || localStorage.getItem('gd_ref') || '');
      if (localStorage.getItem('gd_registered')) setMode('login');
    } catch {
      setRef(r || '');
    }
  }, []);

  async function run(fn: () => Promise<void>) {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (er: any) {
      setError(er.message);
    } finally {
      setBusy(false);
    }
  }

  const pinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'register') {
        const r = await api('/api/auth/register', { body: { role, name, phone, pin, ref } });
        try { localStorage.setItem('gd_registered', '1'); } catch {}
        if (r.pending) {
          setInfo(t('Заявка отправлена! Администратор проверит её и откроет доступ. После этого войдите с этим телефоном.'));
          setMode('login');
          return;
        }
        go(role);
      } else {
        const r = await api('/api/auth/login', { body: { phone, pin } });
        go(r.role);
      }
    });
  };

  const smsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!codeSent) {
        const r = await api('/api/auth/otp', { body: { action: 'send', phone } });
        setCodeSent({ exists: r.exists, demoCode: r.demoCode });
        setNeedName(!r.exists);
        return;
      }
      const r = await api('/api/auth/otp', { body: { action: 'verify', phone, code, name, role, ref } });
      if (r.needName) {
        setNeedName(true);
        setError(t('Укажите имя, чтобы создать аккаунт'));
        return;
      }
      try { localStorage.setItem('gd_registered', '1'); } catch {}
      if (r.pending) {
        setInfo(t('Заявка исполнителя отправлена! Администратор откроет доступ, после этого войдите по SMS.'));
        setCodeSent(null);
        setCode('');
        return;
      }
      go(r.role);
    });
  };

  const demo = (r: string) => run(async () => {
    await api('/api/auth/demo', { body: { role: r } });
    go(r);
  });

  if (me === undefined || me?.user) {
    return (
      <div className="hero" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={72} />
      </div>
    );
  }

  const roles = [
    { id: 'client' as const, icon: 'home', label: t('Я клиент') },
    { id: 'worker' as const, icon: 'bag', label: t('Я исполнитель') },
  ];

  return (
    <>
      <Onboarding kind="client" />
      <header className="hero">
        <div className="row between" style={{ maxWidth: 460, margin: '0 auto 18px' }}>
          <a href="/install" className="iconbtn" aria-label={t('Как установить на телефон')} title={t('Как установить на телефон')}><I n="download" size={20} /></a>
          <LangSwitch compact />
        </div>
        <LogoMark size={64} />
        <h1>Green<b>Drop</b></h1>
        <p>{t('Вынесем мусор прямо от вашей двери. Заказ за минуту, фотоотчёт на каждом шаге.')}</p>
      </header>
      <main className="landing">
        <div className="card stack">
          <div className="seg">
            {roles.map((r) => (
              <button key={r.id} className={role === r.id ? 'on' : ''} onClick={() => setRole(r.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <I n={r.icon} size={18} />{r.label}
              </button>
            ))}
          </div>

          {method === 'sms' ? (
            <form onSubmit={smsSubmit} className="stack">
              <label className="f">
                <span>{t('Телефон')}</span>
                <input className="input" type="tel" inputMode="tel" value={phone} disabled={!!codeSent} onChange={(e) => setPhone(e.target.value)} placeholder="+374 XX XXX XXX" autoComplete="tel" />
              </label>
              {codeSent && (
                <>
                  {codeSent.demoCode && <div className="note">{t('Демо-режим SMS: ваш код')} <b>{codeSent.demoCode}</b></div>}
                  <label className="f">
                    <span>{t('Код из SMS')}</span>
                    <input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" autoFocus />
                  </label>
                  {needName && (
                    <label className="f">
                      <span>{role === 'worker' ? t('Ваше имя (новый аккаунт исполнителя)') : t('Ваше имя (новый аккаунт)')}</span>
                      <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </label>
                  )}
                </>
              )}
              {ref && !codeSent?.exists && role === 'client' && <div className="note small row"><I n="gift" size={18} />{t('Вас пригласили: скидка на первый заказ (код {code})', { code: ref })}</div>}
              {error && <div className="error">{error}</div>}
              {info && <div className="note">{info}</div>}
              <button className="btn block lg" disabled={busy}>
                {busy ? <span className="spin" /> : codeSent ? t('Войти') : <><I n="sms" size={20} />{t('Получить код')}</>}
              </button>
              {codeSent ? (
                <button type="button" className="btn plain block" onClick={() => { setCodeSent(null); setCode(''); }}>{t('Изменить номер')}</button>
              ) : (
                <button type="button" className="btn plain block" onClick={() => { setMethod('pin'); setError(''); }}><I n="key" size={18} />{t('Войти по PIN-коду')}</button>
              )}
            </form>
          ) : (
            <form onSubmit={pinSubmit} className="stack">
              {mode === 'register' && (
                <label className="f">
                  <span>{t('Имя')}</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Как к вам обращаться')} autoComplete="name" />
                </label>
              )}
              <label className="f">
                <span>{t('Телефон')}</span>
                <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+374 XX XXX XXX" autoComplete="tel" />
              </label>
              <label className="f">
                <span>{t('PIN-код (4-8 цифр)')}</span>
                <input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </label>
              {mode === 'register' && role === 'client' && (
                <label className="f">
                  <span>{t('Код приглашения (если есть)')}</span>
                  <input className="input" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder={t('например ANNA2026')} />
                </label>
              )}
              {error && <div className="error">{error}</div>}
              {info && <div className="note">{info}</div>}
              <button className="btn block lg" disabled={busy}>
                {busy ? <span className="spin" /> : mode === 'register' ? (role === 'worker' ? t('Отправить заявку') : t('Создать аккаунт')) : t('Войти')}
              </button>
              <button type="button" className="btn plain block" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
                {mode === 'login' ? t('Нет аккаунта? Зарегистрироваться') : t('Уже есть аккаунт? Войти')}
              </button>
              <button type="button" className="btn plain block" onClick={() => { setMethod('sms'); setError(''); }}><I n="sms" size={18} />{t('Войти по SMS')}</button>
            </form>
          )}
        </div>

        {me?.demoLogin && (
          <>
            <div className="label center">{t('Посмотреть демо')} · {t('без регистрации')}</div>
            <div className="tiles">
              {[
                { r: 'client', icon: 'home', l: t('Клиент') },
                { r: 'worker', icon: 'bag', l: t('Исполнитель') },
                { r: 'admin', icon: 'chart', l: t('Админ') },
              ].map((d) => (
                <button key={d.r} className="tile" disabled={busy} onClick={() => demo(d.r)}>
                  <IconBox n={d.icon} size={38} />
                  {d.l}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="center small" style={{ marginTop: 24 }}>
          <a href="/admin" className="muted" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}><I n="shield" size={16} />{t('Вход для администратора')}</a>
        </p>
      </main>
    </>
  );
}
