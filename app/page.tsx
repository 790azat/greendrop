'use client';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { api, useMe } from '@/components/ui';

type Mode = 'login' | 'register';

export default function Home() {
  const { me } = useMe();
  const [role, setRole] = useState<'client' | 'worker'>('client');
  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
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
    try {
      if (localStorage.getItem('gd_registered')) setMode('login');
    } catch {}
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'register') {
        const r = await api('/api/auth/register', { body: { role, name, phone, pin } });
        try { localStorage.setItem('gd_registered', '1'); } catch {}
        if (r.pending) {
          setInfo('Заявка отправлена! Администратор проверит её и откроет доступ. После этого войдите с этим телефоном и PIN-кодом.');
          setMode('login');
          return;
        }
        location.href = role === 'worker' ? '/worker' : '/client';
      } else {
        const r = await api('/api/auth/login', { body: { phone, pin } });
        location.href = r.role === 'worker' ? '/worker' : '/client';
      }
    } catch (er: any) {
      setError(er.message);
    } finally {
      setBusy(false);
    }
  }

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
        <LogoMark size={64} />
        <h1>GreenDrop</h1>
        <p>Вынесем мусор прямо от вашей двери. Заказ за минуту, фотоотчёт на каждом шаге.</p>
      </header>
      <main className="landing">
        <div className="card stack">
          <div className="seg">
            <button className={role === 'client' ? 'on' : ''} onClick={() => setRole('client')}>
              Я клиент
            </button>
            <button className={role === 'worker' ? 'on' : ''} onClick={() => setRole('worker')}>
              Я исполнитель
            </button>
          </div>
          <form onSubmit={submit} className="stack">
            <h2 style={{ marginTop: 4 }}>{mode === 'register' ? (role === 'worker' ? 'Стать исполнителем' : 'Регистрация') : 'Вход'}</h2>
            {mode === 'register' && (
              <label className="f">
                <span>Имя</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" autoComplete="name" />
              </label>
            )}
            <label className="f">
              <span>Телефон</span>
              <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+374 XX XXX XXX" autoComplete="tel" />
            </label>
            <label className="f">
              <span>PIN-код (4-8 цифр)</span>
              <input className="input" type="password" inputMode="numeric" pattern="\d*" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </label>
            {error && <div className="error">{error}</div>}
            {info && <div className="note">{info}</div>}
            <button className="btn block lg" disabled={busy}>
              {busy ? <span className="spin" /> : mode === 'register' ? (role === 'worker' ? 'Отправить заявку' : 'Создать аккаунт') : 'Войти'}
            </button>
            <button type="button" className="btn plain block" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </form>
        </div>

        <div className="card stack" style={{ marginTop: 16 }}>
          <div className="feature"><div className="ic">📸</div><div><b>Фото вместо звонков</b><div className="muted small">Сфотографируйте мешки у двери, укажите этаж и квартиру. Звонить и ждать не нужно.</div></div></div>
          <div className="feature"><div className="ic">✅</div><div><b>Отчёт на каждом шаге</b><div className="muted small">Исполнитель отмечает каждый этап и прикладывает фото: забрал, выбросил.</div></div></div>
          <div className="feature"><div className="ic">♻️</div><div><b>Чистый подъезд</b><div className="muted small">Мусор уходит в контейнер, а не остаётся на лестнице.</div></div></div>
        </div>
        <p className="center small muted" style={{ marginTop: 20 }}>
          <a href="/admin">Вход для администратора</a> · <a href="/install">Как установить на телефон</a>
        </p>
      </main>
    </>
  );
}
