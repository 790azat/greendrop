'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { PushToggle } from '@/components/Push';
import { Brand } from '@/components/Logo';
import { OrderHead, OrderSummary, Timeline } from '@/components/OrderDetails';
import {
  Icon, MenuRow, Modal, Photo, PhotoButton, SectionTitle, Spinner, TabBar, api, fmtDate, fmtWhen, logout, mapsLink, t, toast, useMe, usePoll, addrLine,
} from '@/components/ui';
import { LangSwitch, useLang } from '@/components/i18n';
import { I, IconBox, SERVICE_ICON } from '@/components/Icons';
import { Onboarding } from '@/components/Onboarding';
import { PAID_IN_APP, SERVICES, SIZE_LABEL, money, stepsFor } from '@/lib/domain';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

/** Shares the worker's position while the app is open (every ~30 s) */
function useShareLocation(enabled: boolean) {
  const [state, setState] = useState<'off' | 'on' | 'denied'>('off');
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setState('on');
        if (Date.now() - last < 30000) return;
        last = Date.now();
        api('/api/location', { body: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {});
      },
      () => setState('denied'),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return state;
}

const ACTIVE = (s: string) => !['done', 'cancelled'].includes(s);

export default function WorkerPage() {
  useLang();
  const { me } = useMe();
  const [tab, setTab] = useState('available');
  const [data, setData] = useState<{ available: any[]; mine: any[]; loc?: any } | null>(null);
  const [geo, setGeo] = useState(false);
  const locState = useShareLocation(geo);
  useEffect(() => {
    try { if (localStorage.getItem('gd_geo') === '1') setGeo(true); } catch {}
  }, []);
  const [historyOpen, setHistoryOpen] = useState<any>(null);
  const [tour, setTour] = useState(false);
  const prevAvail = useRef<number | null>(null);

  useEffect(() => {
    if (me && (!me.user || me.user.role !== 'worker')) location.replace('/');
  }, [me]);

  const load = () =>
    api('/api/orders')
      .then((d) => {
        // vibrate when a new order appears
        if (prevAvail.current !== null && d.available.length > prevAvail.current) {
          try { navigator.vibrate?.([120, 60, 120]); } catch {}
          toast(t('Новый заказ рядом!'));
        }
        prevAvail.current = d.available.length;
        setData(d);
      })
      .catch(() => {});
  usePoll(load, 7000);

  if (!me?.user) return <Spinner />;
  const active = (data?.mine || []).filter((o) => ACTIVE(o.status));
  const done = (data?.mine || []).filter((o) => o.status === 'done');

  async function accept(id: string) {
    try {
      await api(`/api/orders/${id}`, { body: { action: 'accept' } });
      toast(t('Заказ ваш! Отмечайте шаги по порядку'));
      await load();
      setTab('active');
    } catch (e: any) {
      toast(e.message);
      load();
    }
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - ((now.getDay() + 6) % 7) * 86400000;
  const sum = (arr: any[]) => arr.reduce((s, o) => s + (o.workerShare || 0) + (o.tip || 0), 0);
  const ts = (o: any) => new Date(o.completedAt || o.updatedAt).getTime();
  const cur = me.settings.currency;

  return (
    <div className="shell">
      <Onboarding kind="worker" force={tour} onClose={() => setTour(false)} />
      <div className="topbar">
        <Brand />
        <span className={`chip ${geo && locState !== 'denied' ? 'on' : ''}`} style={{ padding: '6px 12px' }}>
          <I n="pin" size={16} />{t('Геолокация')}
        </span>
      </div>
      {me.user.demo && <div className="banner row"><I n="info" size={18} />{t('Вы в демо-аккаунте исполнителя. Возьмите заказ и пройдите чек-лист.')}</div>}

      {tab === 'available' && (
        <>
          <h1>{t('Доступные заказы')}</h1>
          {(!geo || locState === 'denied') && (
            <div className="menu" style={{ marginBottom: 12 }}>
              <MenuRow
                icon="pin"
                tone={locState === 'denied' ? 'amber' : 'green'}
                title={locState === 'denied' ? t('Доступ к геолокации запрещён в настройках браузера') : t('Включить геолокацию')}
                hint={t('Ближние заказы сверху, клиент видит вас на карте')}
                onClick={() => { setGeo(true); try { localStorage.setItem('gd_geo', '1'); } catch {} }}
                right={<span className={`switch ${geo && locState !== 'denied' ? 'on' : ''}`} />}
              />
            </div>
          )}
          {data && data.available.some((o) => o.address?.lat) && (
            <div style={{ marginBottom: 12 }}>
              <MapView
                height={180}
                markers={[
                  ...data.available.filter((o) => o.address?.lat).map((o) => ({ lat: o.address.lat, lng: o.address.lng, kind: 'new' as const, label: money(o.workerShare, o.currency) })),
                  ...(data.loc ? [{ lat: data.loc.lat, lng: data.loc.lng, kind: 'worker' as const, label: t('Вы') }] : []),
                ]}
              />
            </div>
          )}
          {data === null ? (
            <Spinner />
          ) : data.available.length === 0 ? (
            <div className="empty">
              <div className="big"><IconBox n="leaf" size={64} /></div>
              {t('Сейчас новых заказов нет. Страница обновляется сама.')}
            </div>
          ) : (
            data.available.map((o) => (
              <div key={o.id} className="card stack">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="small muted">№{o.num} · {fmtDate(o.createdAt)}</div>
                    <div className="row" style={{ fontWeight: 700, gap: 6 }}><I n={SERVICE_ICON[o.service || 'trash']} size={18} style={{ color: 'var(--g600)' }} />{addrLine(o.address, false)}</div>
                    <div className="small muted">
                      {t(o.address?.city)}
                      {o.distanceKm != null && ` · ${t('{d} от вас', { d: o.distanceKm < 1 ? t('{n} м', { n: Math.round(o.distanceKm * 1000) }) : t('{n} км', { n: o.distanceKm.toFixed(1) }) })}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="price">{money(o.workerShare, o.currency)}</div>
                    <div className="small muted">{t('ваш доход')}</div>
                  </div>
                </div>
                <div className="row wrap small">
                  <span className="chip">{t(SERVICES[o.service || 'trash'].title)}</span>
                  <span className="chip">{o.bags} {t(SERVICES[o.service || 'trash'].unit)}</span>
                  {(o.service || 'trash') === 'trash' && <span className="chip">{t(SIZE_LABEL[o.size])}</span>}
                  {o.bulky && <span className="chip">{t('крупногабарит')}</span>}
                  <span className={`chip ${o.express ? 'on' : ''}`}>{fmtWhen(o.when)}{o.express ? ` · ${t('срочно')}` : ''}</span>
                </div>
                {!!o.clientPhotos?.length && (
                  <div className="photos">
                    {o.clientPhotos.map((u: string) => <Photo key={u} src={u} />)}
                  </div>
                )}
                {o.comment && <div className="small row" style={{ alignItems: 'flex-start' }}><I n="message" size={16} style={{ color: 'var(--muted)', marginTop: 2 }} />{o.comment}</div>}
                <button className="btn block lg" onClick={() => accept(o.id)}><I n="check" size={20} stroke={2.6} />{t('Принять заказ')}</button>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'active' && (
        <>
          <h1>{t('В работе')}</h1>
          {active.length === 0 ? (
            <div className="empty">
              <div className="big"><IconBox n="truck" size={64} tone="gray" /></div>
              {t('Нет активных заказов')}
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setTab('available')}>{t('Найти заказ')}</button>
              </div>
            </div>
          ) : (
            active.map((o) => <ActiveOrder key={o.id} o={o} onChange={load} />)
          )}
        </>
      )}

      {tab === 'earn' && (
        <div className="stack">
          <h1>{t('Заработок')}</h1>
          <div className="stats">
            <div className="stat"><div className="l">{t('Сегодня')}</div><div className="v">{money(sum(done.filter((o) => ts(o) >= startOfDay)), cur)}</div></div>
            <div className="stat"><div className="l">{t('Неделя')}</div><div className="v">{money(sum(done.filter((o) => ts(o) >= startOfWeek)), cur)}</div></div>
            <div className="stat"><div className="l">{t('Всего')}</div><div className="v">{money(sum(done), cur)}</div></div>
            <div className="stat"><div className="l">{t('Заказов')}</div><div className="v">{done.length}</div></div>
            <div className="stat"><div className="l">{t('Из них чаевые')}</div><div className="v">{money(done.reduce((a, o) => a + (o.tip || 0), 0), cur)}</div></div>
            <div className="stat"><div className="l">{t('Рейтинг')}</div><div className="v">{(() => { const r = done.filter((o) => o.rating); return r.length ? (r.reduce((a, o) => a + o.rating, 0) / r.length).toFixed(1) + ' ★' : '—'; })()}</div></div>
          </div>
          <div className="label">{t('История')}</div>
          {done.length === 0 ? (
            <div className="empty">{t('Здесь будут выполненные заказы')}</div>
          ) : (
            <div className="menu">
              {done.map((o) => (
                <MenuRow
                  key={o.id}
                  icon={SERVICE_ICON[o.service || 'trash']}
                  title={addrLine(o.address, false)}
                  hint={`№${o.num} · ${fmtDate(o.completedAt)}${o.rating ? ` · ${'★'.repeat(o.rating)}` : ''}`}
                  onClick={() => setHistoryOpen(o)}
                  right={<b style={{ color: 'var(--g700)' }}>+{money(o.workerShare + (o.tip || 0), o.currency)}</b>}
                />
              ))}
            </div>
          )}
          <div className="label">{me.user.name} · {me.user.phone}</div>
          <div className="menu">
            <MenuRow icon="globe" title={t('Язык')} right={<LangSwitch compact />} />
            <PushToggle vapidKey={me.vapidPublicKey} />
            <MenuRow icon="help" tone="gray" title={t('Как пользоваться')} onClick={() => setTour(true)} />
            <MenuRow icon="logout" danger title={t('Выйти')} onClick={logout} right={<span />} />
          </div>
        </div>
      )}

      {historyOpen && (
        <Modal title={t('Заказ №{n}', { n: historyOpen.num })} onClose={() => setHistoryOpen(null)}>
          <div className="card"><OrderSummary o={historyOpen} /></div>
          <div className="card"><Timeline o={historyOpen} /></div>
        </Modal>
      )}

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'available', label: t('Заказы'), icon: Icon.inbox, dot: data?.available.length },
          { key: 'active', label: t('В работе'), icon: Icon.truck, dot: active.length },
          { key: 'earn', label: t('Заработок'), icon: Icon.chart },
        ]}
      />
    </div>
  );
}

function ActiveOrder({ o, onChange }: { o: any; onChange: () => void }) {
  const steps = stepsFor(o);
  const nextIdx = steps.findIndex((s) => !o.steps?.[s.key]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});

  async function mark(key: string, photo?: string) {
    setBusy(key);
    try {
      await api(`/api/orders/${o.id}`, { body: { action: 'step', key, photo } });
      setPending((p) => ({ ...p, [key]: '' }));
      if (key === 'done') toast(t('Отлично! Заказ выполнен 🎉'));
      onChange();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card stack">
      <OrderHead o={o} />
      <OrderSummary o={o} />
      {o.address?.lat && <MapView height={170} markers={[{ lat: o.address.lat, lng: o.address.lng, kind: 'home', label: t('кв. {n}', { n: o.address.apt }) }]} />}
      {PAID_IN_APP(o.payment) && (
        <div className={o.paymentStatus === 'paid' ? 'note small' : 'banner'} style={{ margin: 0 }}>
          <span className="row"><I n={o.paymentStatus === 'paid' ? 'check' : 'clock'} size={18} />{o.paymentStatus === 'paid' ? t('Клиент оплатил в приложении, деньги брать не нужно') : t('Клиент ещё не оплатил онлайн')}</span>
        </div>
      )}
      <div className="row">
        <a className="btn ghost sm grow" href={`tel:${o.clientPhone}`}><I n="phone" size={18} />{t('Позвонить')}</a>
        <a className="btn ghost sm grow" href={mapsLink(o.address)} target="_blank" rel="noreferrer"><I n="route" size={18} />{t('Маршрут')}</a>
      </div>
      {!!o.clientPhotos?.length && (
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>{t('Фото от клиента')}</div>
          <div className="photos">{o.clientPhotos.map((u: string) => <Photo key={u} src={u} />)}</div>
        </div>
      )}
      <div>
        <SectionTitle icon="list">{t('Чек-лист')}</SectionTitle>
        <ul className="checklist">
          {steps.map((s, i) => {
            const d = o.steps?.[s.key];
            const isNext = i === nextIdx;
            const ph = pending[s.key];
            return (
              <li key={s.key} className={!d && !isNext ? 'off' : ''}>
                <button
                  className={`cbox ${d ? 'on' : isNext ? 'next' : ''}`}
                  style={{ cursor: isNext ? 'pointer' : 'default' }}
                  disabled={!isNext || !!busy || (s.photo && !ph)}
                  onClick={() => mark(s.key, ph)}
                  aria-label={t(s.title)}
                >
                  {d ? Icon.check : busy === s.key ? <span className="spin" style={{ width: 16, height: 16 }} /> : null}
                </button>
                <div className="grow">
                  <div className="t">{t(s.title)}</div>
                  {d ? (
                    <div className="muted small">{fmtDate(d.at)}</div>
                  ) : (
                    isNext && s.hint && <div className="muted small">{t(s.hint)}</div>
                  )}
                  {d?.photo && <div className="photos" style={{ marginTop: 6 }}><Photo src={d.photo} /></div>}
                  {isNext && s.photo && (
                    <div className="stack" style={{ marginTop: 8 }}>
                      {ph ? (
                        <>
                          <div className="photos"><Photo src={ph} /></div>
                          <div className="row">
                            <button className="btn sm grow" disabled={!!busy} onClick={() => mark(s.key, ph)}>✓ {t('Подтвердить шаг')}</button>
                            <PhotoButton className="btn ghost sm" onUploaded={(u) => setPending((p) => ({ ...p, [s.key]: u }))}>{t('Переснять')}</PhotoButton>
                          </div>
                        </>
                      ) : (
                        <PhotoButton className="btn sm block" onUploaded={(u) => setPending((p) => ({ ...p, [s.key]: u }))}>
                          {Icon.camera} {t('Сделать фото')}
                        </PhotoButton>
                      )}
                    </div>
                  )}
                  {isNext && !s.photo && (
                    <button className="btn sm" style={{ marginTop: 8 }} disabled={!!busy} onClick={() => mark(s.key)}>
                      ✓ {t('Отметить')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {!o.steps?.picked && (
        <button
          className="btn plain block small"
          onClick={async () => {
            if (!confirm(t('Отказаться от заказа? Он вернётся в общий список.'))) return;
            try {
              await api(`/api/orders/${o.id}`, { body: { action: 'release' } });
              onChange();
            } catch (e: any) {
              toast(e.message);
            }
          }}
        >
          {t('Отказаться от заказа')}
        </button>
      )}
    </div>
  );
}
