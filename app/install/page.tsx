'use client';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/Logo';
import { LangSwitch, t, useLang } from '@/components/i18n';

export default function Install() {
  useLang();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <div className="shell stack" style={{ paddingBottom: 40 }}>
      <div className="topbar"><a href="/" style={{ textDecoration: 'none' }}><Brand /></a><LangSwitch compact /></div>
      <h1>{t('Установить на телефон')}</h1>
      <div className="card stack">
        <h3>iPhone (Safari)</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>{t('Откройте сайт именно в Safari.')}</li>
          <li>{t('Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх).')}</li>
          <li>{t('Прокрутите и выберите «На экран „Домой“».')}</li>
          <li>{t('Нажмите «Добавить». Иконка GreenDrop появится на рабочем столе и откроется как приложение.')}</li>
        </ol>
      </div>
      <div className="card stack">
        <h3>Android (Chrome)</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>{t('Откройте сайт в Chrome.')}</li>
          <li>{t('Нажмите меню ⋮ в правом верхнем углу.')}</li>
          <li>{t('Выберите «Установить приложение» или «Добавить на главный экран».')}</li>
        </ol>
      </div>
      <a className="btn block" href="/">{t('Вернуться')}</a>
    </div>
  );
}
