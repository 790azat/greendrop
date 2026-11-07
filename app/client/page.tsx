'use client';
import { useEffect, useMemo, useState } from 'react';
import { Brand } from '@/components/Logo';
import { OrderHead, OrderSummary, Timeline, orderProgress } from '@/components/OrderDetails';
import {
  Icon, Modal, PhotoButton, PhotoList, Progress, Spinner, TabBar, api, logout, toast, useMe, usePoll,
} from '@/components/ui';
import { SIZE_LABEL, Settings, calcPrice, money } from '@/lib/domain';

const ACTIVE = (s: string) => !['done', 'cancelled'].includes(s);

export default function ClientPage() {
  const { me, reload: reloadMe } = useMe();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (me && (!me.user || me.user.role !== 'client')) location.replace('/');
  }, [me]);
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t) setTab(t);
  }, []);

  const load = () => api('/api/orders').then((d) => setOrders(d.orders)).catch(() => {});
  usePoll(load, 8000);

  useEffect(() => {
    if (orders && orders.length === 0 && tab === 'orders' && !new URLSearchParams(location.search).get('tab')) setTab('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders === null]);

  if (!me?.user) return <Spinner />;
  const active = (orders || []).filter((o) => ACTIVE(o.status));
  const open = orders?.find((o) => o.id === openId);

  return (
    <div className="shell">
      <div className="topbar">
        <Brand />
        <span className="small muted">{me.user.name}</span>
      </div>
      {me.demoDb && <div className="banner">Демо-режим: база данных ещё не подключена, заказы могут пропадать.</div>}

      {tab === 'new' && (
        <NewOrder
          settings={me.settings}
          addresses={me.user.addresses}
          onCreated={() => {
            load();
            reloadMe();
            setTab('orders');
            toast('Заказ создан! Ищем исполнителя');
          }}
        />
      )}

      {tab === 'orders' && (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h1 style={{ margin: 0 }}>Мои заказы</h1>
            <button className="btn sm" onClick={() => setTab('new')}>+ Новый</button>
          </div>
          {orders === null ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <div className="empty">
              <div className="big">🗑️</div>
              Заказов пока нет
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setTab('new')}>Вынести мусор</button>
              </div>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="card tap stack" onClick={() => setOpenId(o.id)}>
                <OrderHead o={o} />
                {ACTIVE(o.status) && <Progress value={orderProgress(o)} />}
                <div className="row between small">
                  <span className="muted">
                    {o.bags} меш. · {o.workerName ? `исполнитель: ${o.workerName}` : 'ищем исполнителя'}
                  </span>
                  <b>{money(o.price, o.currency)}</b>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'profile' && (
        <div className="stack">
          <h1>Профиль</h1>
          <div className="card">
            <dl className="kv">
              <dt>Имя</dt><dd>{me.user.name}</dd>
              <dt>Телефон</dt><dd>{me.user.phone}</dd>
              <dt>Заказов</dt><dd>{orders?.length ?? '...'}</dd>
            </dl>
          </div>
          {!!me.user.addresses?.length && (
            <div className="card">
              <h3>Сохранённые адреса</h3>
              {me.user.addresses.map((a: any, i: number) => (
                <div key={i} className="small" style={{ padding: '6px 0' }}>
                  📍 {a.street}, {a.house}, эт. {a.floor}, кв. {a.apt}
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <h3>Тарифы</h3>
            <dl className="kv">
              <dt>1 мешок</dt><dd>{money(me.settings.basePrice, me.settings.currency)}</dd>
              <dt>Каждый следующий</dt><dd>+{money(me.settings.extraBagPrice, me.settings.currency)}</dd>
              <dt>Большой мешок</dt><dd>+{money(me.settings.largeBagExtra, me.settings.currency)} / шт</dd>
              <dt>Крупногабарит</dt><dd>+{money(me.settings.bulkyPrice, me.settings.currency)}</dd>
              <dt>Срочно</dt><dd>+{money(me.settings.expressPrice, me.settings.currency)}</dd>
            </dl>
          </div>
          <a className="btn ghost block" href="/install">Установить приложение на телефон</a>
          <button className="btn danger block" onClick={logout}>Выйти</button>
        </div>
      )}

      {open && <ClientOrderModal o={open} onClose={() => setOpenId(null)} onChange={load} />}

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'new', label: 'Заказать', icon: Icon.plus },
          { key: 'orders', label: 'Заказы', icon: Icon.list, dot: active.length },
          { key: 'profile', label: 'Профиль', icon: Icon.user },
        ]}
      />
    </div>
  );
}

function NewOrder({ settings, addresses, onCreated }: { settings: Settings; addresses: any[]; onCreated: () => void }) {
  const last = addresses?.[0] || {};
  const [addr, setAddr] = useState<any>({
    city: last.city || settings.serviceArea || '',
    street: last.street || '',
    house: last.house || '',
    entrance: last.entrance || '',
    floor: last.floor || '',
    apt: last.apt || '',
    intercom: last.intercom || '',
  });
  const [bags, setBags] = useState(1);
  const [size, setSize] = useState('medium');
  const [bulky, setBulky] = useState(false);
  const [whenMode, setWhenMode] = useState<'asap' | 'time'>('asap');
  const [whenTime, setWhenTime] = useState('');
  const [express, setExpress] = useState(false);
  const [payment, setPayment] = useState('cash');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const price = useMemo(
    () => calcPrice(settings, { bags, size, bulky, express: whenMode === 'asap' && express }),
    [settings, bags, size, bulky, express, whenMode]
  );
  const set = (k: string) => (e: any) => setAddr({ ...addr, [k]: e.target.value });

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await api('/api/orders', {
        body: {
          address: addr,
          bags,
          size,
          bulky,
          express,
          when: whenMode === 'asap' ? 'asap' : whenTime ? new Date(whenTime).toISOString() : 'asap',
          payment,
          comment,
          photos,
        },
      });
      setPhotos([]);
      setComment('');
      onCreated();
    } catch (e: any) {
      setError(e.message);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Вынести мусор</h1>

      <div className="card stack">
        <h3>1. Фото мешков у двери</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Поставьте мусор у двери и сфотографируйте так, чтобы был виден номер квартиры или дверь. Исполнитель сверит фото на месте.
        </p>
        <div className="photos">
          <PhotoList urls={photos} onRemove={(i) => setPhotos(photos.filter((_, j) => j !== i))} />
          {photos.length < 4 && (
            <PhotoButton className="addphoto" onUploaded={(u) => setPhotos([...photos, u])}>
              {Icon.camera}
              <span>Фото</span>
            </PhotoButton>
          )}
        </div>
      </div>

      <div className="card stack">
        <h3>2. Адрес</h3>
        {addresses?.length > 1 && (
          <div className="chips">
            {addresses.map((a: any, i: number) => (
              <button key={i} type="button" className="chip" onClick={() => setAddr({ ...a })}>
                📍 {a.street}, {a.house}, кв. {a.apt}
              </button>
            ))}
          </div>
        )}
        <label className="f"><span>Город</span><input className="input" value={addr.city} onChange={set('city')} /></label>
        <div className="grid2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <label className="f"><span>Улица</span><input className="input" value={addr.street} onChange={set('street')} placeholder="ул. Абовяна" /></label>
          <label className="f"><span>Дом</span><input className="input" value={addr.house} onChange={set('house')} placeholder="12" /></label>
        </div>
        <div className="grid3">
          <label className="f"><span>Подъезд</span><input className="input" inputMode="numeric" value={addr.entrance} onChange={set('entrance')} /></label>
          <label className="f"><span>Этаж</span><input className="input" inputMode="numeric" value={addr.floor} onChange={set('floor')} /></label>
          <label className="f"><span>Квартира</span><input className="input" value={addr.apt} onChange={set('apt')} /></label>
        </div>
        <label className="f"><span>Код домофона</span><input className="input" value={addr.intercom} onChange={set('intercom')} placeholder="необязательно" /></label>
      </div>

      <div className="card stack">
        <h3>3. Что выносим</h3>
        <div className="row between">
          <span>Количество мешков</span>
          <div className="stepper">
            <button type="button" onClick={() => setBags(Math.max(1, bags - 1))}>−</button>
            <b>{bags}</b>
            <button type="button" onClick={() => setBags(Math.min(settings.maxBags, bags + 1))}>+</button>
          </div>
        </div>
        <div className="chips">
          {Object.entries(SIZE_LABEL).map(([k, v]) => (
            <button key={k} type="button" className={`chip ${size === k ? 'on' : ''}`} onClick={() => setSize(k)}>{v}</button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={bulky} onChange={(e) => setBulky(e.target.checked)} />
          <span className="grow">Есть крупный предмет (коробки, старый стул)<div className="small muted">+{money(settings.bulkyPrice, settings.currency)}</div></span>
        </label>
      </div>

      <div className="card stack">
        <h3>4. Когда забрать</h3>
        <div className="seg">
          <button type="button" className={whenMode === 'asap' ? 'on' : ''} onClick={() => setWhenMode('asap')}>Как можно скорее</button>
          <button type="button" className={whenMode === 'time' ? 'on' : ''} onClick={() => setWhenMode('time')}>Ко времени</button>
        </div>
        {whenMode === 'time' ? (
          <input className="input" type="datetime-local" value={whenTime} onChange={(e) => setWhenTime(e.target.value)} />
        ) : (
          <label className="check">
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
            <span className="grow">Срочно, в течение 30 минут<div className="small muted">+{money(settings.expressPrice, settings.currency)}</div></span>
          </label>
        )}
      </div>

      <div className="card stack">
        <h3>5. Оплата и комментарий</h3>
        <div className="seg">
          <button type="button" className={payment === 'cash' ? 'on' : ''} onClick={() => setPayment('cash')}>Наличными</button>
          <button type="button" className={payment === 'card' ? 'on' : ''} onClick={() => setPayment('card')}>Переводом / картой</button>
        </div>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: пакеты справа от двери, осторожно, стекло" />
      </div>

      <div className="card stack">
        <div className="row between">
          <span className="muted">Итого</span>
          <span className="price">{money(price, settings.currency)}</span>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn block lg" onClick={submit} disabled={busy}>
          {busy ? <span className="spin" /> : 'Заказать вынос'}
        </button>
      </div>
    </div>
  );
}

function ClientOrderModal({ o, onClose, onChange }: { o: any; onClose: () => void; onChange: () => void }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(body: any, msg: string) {
    setBusy(true);
    try {
      await api(`/api/orders/${o.id}`, { body });
      toast(msg);
      onChange();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Заказ №${o.num}`} onClose={onClose}>
      <div className="stack">
        <div className="card stack">
          <OrderHead o={o} />
          <OrderSummary o={o} />
        </div>
        <div className="card">
          <h3>Ход выполнения</h3>
          <Timeline o={o} />
        </div>
        {o.status === 'done' && !o.rating && (
          <div className="card stack">
            <h3>Оцените работу</h3>
            <div className="row" style={{ fontSize: 32 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="btn plain" style={{ fontSize: 32, padding: 2, color: n <= rating ? '#f59e0b' : '#cbd5e1' }} onClick={() => setRating(n)}>★</button>
              ))}
            </div>
            <textarea className="input" placeholder="Отзыв (необязательно)" value={review} onChange={(e) => setReview(e.target.value)} />
            <button className="btn block" disabled={busy} onClick={() => act({ action: 'rate', rating, review }, 'Спасибо за оценку!')}>Отправить</button>
          </div>
        )}
        {o.rating && <div className="note">Ваша оценка: {'★'.repeat(o.rating)} {o.review}</div>}
        {['new', 'accepted'].includes(o.status) && (
          <button
            className="btn danger block"
            disabled={busy}
            onClick={() => confirm('Отменить заказ?') && act({ action: 'cancel' }, 'Заказ отменён')}
          >
            Отменить заказ
          </button>
        )}
      </div>
    </Modal>
  );
}
