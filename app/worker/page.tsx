'use client';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '@/components/Logo';
import { OrderHead, OrderSummary, Timeline } from '@/components/OrderDetails';
import {
  Icon, Modal, Photo, PhotoButton, Spinner, TabBar, api, fmtDate, fmtWhen, logout, mapsLink, toast, useMe, usePoll, addrLine,
} from '@/components/ui';
import { SIZE_LABEL, money, stepsFor } from '@/lib/domain';

const ACTIVE = (s: string) => !['done', 'cancelled'].includes(s);

export default function WorkerPage() {
  const { me } = useMe();
  const [tab, setTab] = useState('available');
  const [data, setData] = useState<{ available: any[]; mine: any[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState<any>(null);
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
          toast('Новый заказ рядом!');
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
      toast('Заказ ваш! Отмечайте шаги по порядку');
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
  const sum = (arr: any[]) => arr.reduce((s, o) => s + (o.workerShare || 0), 0);
  const ts = (o: any) => new Date(o.completedAt || o.updatedAt).getTime();
  const cur = me.settings.currency;

  return (
    <div className="shell">
      <div className="topbar">
        <Brand />
        <span className="small muted">Исполнитель · {me.user.name}</span>
      </div>
      {me.demoDb && <div className="banner">Демо-режим: база данных ещё не подключена.</div>}

      {tab === 'available' && (
        <>
          <h1>Доступные заказы</h1>
          {data === null ? (
            <Spinner />
          ) : data.available.length === 0 ? (
            <div className="empty">
              <div className="big">🌿</div>
              Сейчас новых заказов нет. Страница обновляется сама.
            </div>
          ) : (
            data.available.map((o) => (
              <div key={o.id} className="card stack">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="small muted">№{o.num} · {fmtDate(o.createdAt)}</div>
                    <div style={{ fontWeight: 700 }}>{addrLine(o.address, false)}</div>
                    <div className="small muted">{o.address?.city}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="price">{money(o.workerShare, o.currency)}</div>
                    <div className="small muted">ваш доход</div>
                  </div>
                </div>
                <div className="row wrap small">
                  <span className="chip">{o.bags} меш.</span>
                  <span className="chip">{SIZE_LABEL[o.size]}</span>
                  {o.bulky && <span className="chip">крупногабарит</span>}
                  <span className={`chip ${o.express ? 'on' : ''}`}>{fmtWhen(o.when)}{o.express ? ' · срочно' : ''}</span>
                </div>
                {!!o.clientPhotos?.length && (
                  <div className="photos">
                    {o.clientPhotos.map((u: string) => <Photo key={u} src={u} />)}
                  </div>
                )}
                {o.comment && <div className="small">💬 {o.comment}</div>}
                <button className="btn block lg" onClick={() => accept(o.id)}>Принять заказ</button>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'active' && (
        <>
          <h1>В работе</h1>
          {active.length === 0 ? (
            <div className="empty">
              <div className="big">🧤</div>
              Нет активных заказов
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setTab('available')}>Найти заказ</button>
              </div>
            </div>
          ) : (
            active.map((o) => <ActiveOrder key={o.id} o={o} onChange={load} />)
          )}
        </>
      )}

      {tab === 'earn' && (
        <div className="stack">
          <h1>Заработок</h1>
          <div className="stats">
            <div className="stat"><div className="l">Сегодня</div><div className="v">{money(sum(done.filter((o) => ts(o) >= startOfDay)), cur)}</div></div>
            <div className="stat"><div className="l">Неделя</div><div className="v">{money(sum(done.filter((o) => ts(o) >= startOfWeek)), cur)}</div></div>
            <div className="stat"><div className="l">Всего</div><div className="v">{money(sum(done), cur)}</div></div>
            <div className="stat"><div className="l">Заказов</div><div className="v">{done.length}</div></div>
          </div>
          <h2 style={{ marginTop: 20 }}>История</h2>
          {done.length === 0 && <div className="empty">Здесь будут выполненные заказы</div>}
          {done.map((o) => (
            <div key={o.id} className="card tap" onClick={() => setHistoryOpen(o)}>
              <div className="row between">
                <div className="grow">
                  <div className="small muted">№{o.num} · {fmtDate(o.completedAt)}</div>
                  <div style={{ fontWeight: 650 }}>{addrLine(o.address)}</div>
                  {o.rating && <div className="small" style={{ color: '#f59e0b' }}>{'★'.repeat(o.rating)}</div>}
                </div>
                <b>+{money(o.workerShare, o.currency)}</b>
              </div>
            </div>
          ))}
          <button className="btn danger block" onClick={logout} style={{ marginTop: 20 }}>Выйти</button>
        </div>
      )}

      {historyOpen && (
        <Modal title={`Заказ №${historyOpen.num}`} onClose={() => setHistoryOpen(null)}>
          <div className="card"><OrderSummary o={historyOpen} /></div>
          <div className="card"><Timeline o={historyOpen} /></div>
        </Modal>
      )}

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'available', label: 'Заказы', icon: Icon.inbox, dot: data?.available.length },
          { key: 'active', label: 'В работе', icon: Icon.truck, dot: active.length },
          { key: 'earn', label: 'Заработок', icon: Icon.wallet },
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
      if (key === 'done') toast('Отлично! Заказ выполнен 🎉');
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
      <div className="row">
        <a className="btn ghost sm grow" href={`tel:${o.clientPhone}`}>📞 Позвонить</a>
        <a className="btn ghost sm grow" href={mapsLink(o.address)} target="_blank" rel="noreferrer">🗺️ Маршрут</a>
      </div>
      {!!o.clientPhotos?.length && (
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>Фото от клиента</div>
          <div className="photos">{o.clientPhotos.map((u: string) => <Photo key={u} src={u} />)}</div>
        </div>
      )}
      <div>
        <h3>Чек-лист</h3>
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
                  aria-label={s.title}
                >
                  {d ? Icon.check : busy === s.key ? <span className="spin" style={{ width: 16, height: 16 }} /> : null}
                </button>
                <div className="grow">
                  <div className="t">{s.title}</div>
                  {d ? (
                    <div className="muted small">{fmtDate(d.at)}</div>
                  ) : (
                    isNext && s.hint && <div className="muted small">{s.hint}</div>
                  )}
                  {d?.photo && <div className="photos" style={{ marginTop: 6 }}><Photo src={d.photo} /></div>}
                  {isNext && s.photo && (
                    <div className="stack" style={{ marginTop: 8 }}>
                      {ph ? (
                        <>
                          <div className="photos"><Photo src={ph} /></div>
                          <div className="row">
                            <button className="btn sm grow" disabled={!!busy} onClick={() => mark(s.key, ph)}>✓ Подтвердить шаг</button>
                            <PhotoButton className="btn ghost sm" onUploaded={(u) => setPending((p) => ({ ...p, [s.key]: u }))}>Переснять</PhotoButton>
                          </div>
                        </>
                      ) : (
                        <PhotoButton className="btn sm block" onUploaded={(u) => setPending((p) => ({ ...p, [s.key]: u }))}>
                          {Icon.camera} Сделать фото
                        </PhotoButton>
                      )}
                    </div>
                  )}
                  {isNext && !s.photo && (
                    <button className="btn sm" style={{ marginTop: 8 }} disabled={!!busy} onClick={() => mark(s.key)}>
                      ✓ Отметить
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
            if (!confirm('Отказаться от заказа? Он вернётся в общий список.')) return;
            try {
              await api(`/api/orders/${o.id}`, { body: { action: 'release' } });
              onChange();
            } catch (e: any) {
              toast(e.message);
            }
          }}
        >
          Отказаться от заказа
        </button>
      )}
    </div>
  );
}
