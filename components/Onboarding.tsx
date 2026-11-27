'use client';
import { useEffect, useRef, useState } from 'react';
import { I, IconName } from './Icons';
import { LangSwitch, t, useLang } from './i18n';

type Slide = { icon: IconName; title: string; text: string; chips?: { icon: IconName; label: string }[] };

const SLIDES: Record<'client' | 'worker', Slide[]> = {
  client: [
    {
      icon: 'leaf',
      title: 'Добро пожаловать в GreenDrop',
      text: 'Вынесем мусор прямо от вашей двери, пока вы заняты своими делами.',
      chips: [{ icon: 'trash', label: 'Бытовой мусор' }, { icon: 'recycle', label: 'Вторсырьё' }, { icon: 'sofa', label: 'Крупногабарит' }],
    },
    {
      icon: 'camera',
      title: 'Оставьте пакеты у двери',
      text: 'Сфотографируйте их, укажите адрес и время. Заказ занимает меньше минуты.',
      chips: [{ icon: 'camera', label: 'Фото' }, { icon: 'pin', label: 'Адрес' }, { icon: 'clock', label: 'Время' }],
    },
    {
      icon: 'route',
      title: 'Следите за выносом',
      text: 'Исполнитель виден на карте, а когда мусор вынесен, вы получите фотоотчёт.',
      chips: [{ icon: 'map', label: 'Карта' }, { icon: 'bell', label: 'Уведомления' }, { icon: 'check', label: 'Фотоотчёт' }],
    },
    {
      icon: 'wallet',
      title: 'Оплата в одно касание',
      text: 'С баланса, картой или наличными. Регулярный вынос по расписанию дешевле.',
      chips: [{ icon: 'wallet', label: 'Баланс' }, { icon: 'card', label: 'Карта' }, { icon: 'repeat', label: 'Подписка' }],
    },
  ],
  worker: [
    {
      icon: 'inbox',
      title: 'Берите заказы рядом',
      text: 'Включите геолокацию: ближайшие заказы будут сверху, а клиент увидит вас на карте.',
      chips: [{ icon: 'pin', label: 'Геолокация' }, { icon: 'bell', label: 'Уведомления' }],
    },
    {
      icon: 'camera',
      title: 'Фото — главный шаг',
      text: 'Заберите мусор у двери и сфотографируйте его. Клиент сразу получит отчёт.',
      chips: [{ icon: 'phone', label: 'Позвонить' }, { icon: 'route', label: 'Маршрут' }, { icon: 'camera', label: 'Фото' }],
    },
    {
      icon: 'chart',
      title: 'Ваш заработок',
      text: 'Доход за день и неделю, чаевые и рейтинг собраны во вкладке «Заработок».',
      chips: [{ icon: 'wallet', label: 'Доход' }, { icon: 'star', label: 'Рейтинг' }],
    },
  ],
};

const KEY = (kind: string) => `gd_onboarded_${kind}`;

export function seenOnboarding(kind: 'client' | 'worker') {
  try {
    return localStorage.getItem(KEY(kind)) === '1';
  } catch {
    return true;
  }
}

/** Shows the tutorial on the first launch only (or when `force` is set, e.g. from the profile) */
export function Onboarding({ kind = 'client', force = false, onClose }: { kind?: 'client' | 'worker'; force?: boolean; onClose?: () => void }) {
  useLang();
  const [show, setShow] = useState(false);
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const slides = SLIDES[kind];

  useEffect(() => {
    if (force || !seenOnboarding(kind)) {
      setI(0);
      setShow(true);
    }
  }, [force, kind]);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;
  const s = slides[i];
  const last = i === slides.length - 1;

  function close() {
    try {
      localStorage.setItem(KEY(kind), '1');
    } catch {}
    setShow(false);
    onClose?.();
  }
  const next = () => (last ? close() : setI(i + 1));
  const prev = () => i > 0 && setI(i - 1);

  return (
    <div
      className="onb"
      role="dialog"
      aria-modal="true"
      aria-label={t('Как пользоваться')}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (dx < -50) next();
        else if (dx > 50) prev();
      }}
    >
      <div className="onb-top">
        {i === 0 ? <LangSwitch compact /> : <button className="iconbtn" onClick={prev} aria-label={t('Назад')}><I n="back" size={20} /></button>}
        {!last && <button className="btn plain sm" onClick={close}>{t('Пропустить')}</button>}
      </div>

      <div className="onb-body" key={`${kind}-${i}`}>
        <div className="onb-art">
          <span className="onb-ring r1" />
          <span className="onb-ring r2" />
          <span className="onb-ic"><I n={s.icon} size={56} stroke={1.8} /></span>
        </div>
        <h1>{t(s.title)}</h1>
        <p>{t(s.text)}</p>
        {s.chips && (
          <div className="onb-chips">
            {s.chips.map((c) => (
              <span key={c.label} className="onb-chip"><I n={c.icon} size={16} />{t(c.label)}</span>
            ))}
          </div>
        )}
      </div>

      <div className="onb-foot">
        <div className="onb-dots">
          {slides.map((_, k) => (
            <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`${k + 1}`} />
          ))}
        </div>
        <button className="btn block lg" onClick={next}>
          {last ? t('Начать') : t('Далее')}
          <I n={last ? 'check' : 'chevron'} size={20} />
        </button>
      </div>
    </div>
  );
}
