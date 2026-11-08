'use client';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { api, t, useMe } from '@/components/ui';
import { LangSwitch, useLang } from '@/components/i18n';

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

  return (
    <>
      <header className="hero">
        <div style={{ marginBottom: 18 }}><LangSwitch /></div>
        <LogoMark size={64} />
        <h1>GreenDrop</h1>
        <p>{t('Вынесем мусор прямо от вашей двери. Заказ за минуту, фотоотчёт на каждом шаге.')}</p>
      </header>
      <main className="landing">
        {me?.demoLogin && (
          <div className="card stack" style={{ marginBottom: 16 }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{t('Посмотреть демо')}</h3>
              <span className="badge green">{t('без регистрации')}</span>
            </div>
            <div className="grid3">
              <button className="btn ghost" style={{ flexDirection: 'column', gap: 2, padding: '10px 4px' }} disabled={busy} onClick={() => demo('client')}>
                <span style={{ fontSize: 22 }}>🏠</span><span className="small">{t('Клиент')}</span>
              </button>
              <button className="btn ghost" style={{ flexDirection: 'column', gap: 2, padding: '10px 4px' }} disabled={busy} onClick={() => demo('worker')}>
                <span style={{ fontSize: 22 }}>🧤</span><span className="small">{t('Исполнитель')}</span>
              </button>
              <button className="btn ghost" style={{ flexDirection: 'column', gap: 2, padding: '10px 4px' }} disabled={busy} onClick={() => demo('admin')}>
                <span style={{ fontSize: 22 }}>📊</span><span className="small">{t('Админ')}</span>
              </button>
            </div>
            <div className="small muted">{t('Откройте клиента и исполнителя в двух вкладках или на двух телефонах и пройдите заказ целиком.')}</div>
          </div>
        )}

        <div className="card stack">
          <div className="seg">
            <button className={role === 'client' ? 'on' : ''} onClick={() => setRole('client')}>{t('Я клиент')}</button>
            <button className={role === 'worker' ? 'on' : ''} onClick={() => setRole('worker')}>{t('Я исполнитель')}</button>
          </div>
          <div className="chips">
            <button className={`chip ${method === 'sms' ? 'on' : ''}`} onClick={() => { setMethod('sms'); setError(''); }}>{t('Вход по SMS')}</button>
            <button className={`chip ${method === 'pin' ? 'on' : ''}`} onClick={() => { setMethod('pin'); setError(''); }}>{t('По PIN-коду')}</button>
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
              {ref && !codeSent?.exists && role === 'client' && <div className="note small">🎁 {t('Вас пригласили: скидка на первый заказ (код {code})', { code: ref })}</div>}
              {error && <div className="error">{error}</div>}
              {info && <div className="note">{info}</div>}
              <button className="btn block lg" disabled={busy}>
                {busy ? <span className="spin" /> : codeSent ? t('Войти') : t('Получить код')}
              </button>
              {codeSent && (
                <button type="button" className="btn plain block" onClick={() => { setCodeSent(null); setCode(''); }}>{t('Изменить номер')}</button>
              )}
            </form>
          ) : (
            <form onSubmit={pinSubmit} className="stack">
              <h2 style={{ marginTop: 4 }}>{mode === 'register' ? (role === 'worker' ? t('Стать исполнителем') : t('Регистрация')) : t('Вход')}</h2>
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
            </form>
          )}
        </div>

        <div className="card stack" style={{ marginTop: 16 }}>
          <div className="feature"><div className="ic">📸</div><div><b>{t('Фото вместо звонков')}</b><div className="muted small">{t('Сфотографируйте мешки у двери, укажите этаж и квартиру.')}</div></div></div>
          <div className="feature"><div className="ic">✅</div><div><b>{t('Фотоотчёт исполнителя')}</b><div className="muted small">{t('Исполнитель отмечает этапы и присылает фото того, что забрал.')}</div></div></div>
          <div className="feature"><div className="ic">👛</div><div><b>{t('Кошелёк в приложении')}</b><div className="muted small">{t('Пополните баланс и оплачивайте вынос в одно касание.')}</div></div></div>
          <div className="feature"><div className="ic">🔁</div><div><b>{t('Подписка')}</b><div className="muted small">{t('Выносим по расписанию, скидка на каждый вынос.')}</div></div></div>
          <div className="feature"><div className="ic">♻️</div><div><b>{t('Вторсырьё и крупногабарит')}</b><div className="muted small">{t('Отдельно вывозим переработку, мебель и коробки.')}</div></div></div>
        </div>
        <p className="center small muted" style={{ marginTop: 20 }}>
          <a href="/admin">{t('Вход для администратора')}</a> · <a href="/install">{t('Как установить на телефон')}</a>
        </p>
      </main>
    </>
  );
}
