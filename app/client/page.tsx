'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/Logo';
import { OrderHead, OrderSummary, Timeline, orderProgress } from '@/components/OrderDetails';
import { AddressFields, emptyAddress } from '@/components/AddressFields';
import { PayModal } from '@/components/Pay';
import { PushToggle } from '@/components/Push';
import {
  Icon, Modal, PhotoButton, PhotoList, Progress, Spinner, TabBar, api, fmtDate, logout, toast, useMe, usePoll,
} from '@/components/ui';
import { PAYMENT_LABEL, SERVICES, SIZE_LABEL, Settings, WEEKDAYS, money } from '@/lib/domain';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const ACTIVE = (s: string) => !['done', 'cancelled'].includes(s);

export default function ClientPage() {
  const { me, reload: reloadMe } = useMe();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pay, setPay] = useState<{ order: any; purpose: 'order' | 'tip'; amount: number } | null>(null);

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
  const cur = me.settings.currency;

  return (
    <div className="shell">
      <div className="topbar">
        <Brand />
        <span className="small muted">{me.user.name}</span>
      </div>
      {me.user.demo && <div className="banner">Вы в демо-аккаунте клиента. Попробуйте оформить заказ и откройте демо исполнителя в другой вкладке.</div>}

      {tab === 'new' && (
        <NewOrder
          me={me}
          onCreated={(o) => {
            load();
            reloadMe();
            setTab('orders');
            if (o.payment === 'online' && o.price > 0) setPay({ order: o, purpose: 'order', amount: o.price });
            else toast('Заказ создан! Ищем исполнителя');
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
                    {o.bags} {SERVICES[o.service || 'trash'].unit} · {o.workerName ? `исполнитель: ${o.workerName}` : 'ищем исполнителя'}
                  </span>
                  <b>{money(o.price, o.currency)}</b>
                </div>
                {o.payment === 'online' && o.paymentStatus === 'pending' && o.status !== 'cancelled' && (
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); setPay({ order: o, purpose: 'order', amount: o.price }); }}>
                    Оплатить онлайн {money(o.price, o.currency)}
                  </button>
                )}
              </div>
            ))
          )}
        </>
      )}

      {tab === 'subs' && <Subscriptions me={me} />}

      {tab === 'profile' && (
        <div className="stack">
          <h1>Профиль</h1>
          <div className="card">
            <dl className="kv">
              <dt>Имя</dt><dd>{me.user.name}</dd>
              <dt>Телефон</dt><dd>{me.user.phone}</dd>
              <dt>Заказов</dt><dd>{orders?.length ?? '...'}</dd>
              <dt>Бонусы</dt><dd>{money(me.user.bonus, cur)}</dd>
            </dl>
          </div>
          <Referral me={me} />
          <PushToggle vapidKey={me.vapidPublicKey} />
          {!!me.user.addresses?.length && (
            <div className="card">
              <h3>Сохранённые адреса</h3>
              {me.user.addresses.map((a: any, i: number) => (
                <div key={i} className="small" style={{ padding: '6px 0' }}>📍 {a.street}, {a.house}, эт. {a.floor}, кв. {a.apt}</div>
              ))}
            </div>
          )}
          <div className="card">
            <h3>Тарифы</h3>
            <dl className="kv">
              <dt>🗑️ 1 мешок</dt><dd>{money(me.settings.basePrice, cur)}</dd>
              <dt>Каждый следующий</dt><dd>+{money(me.settings.extraBagPrice, cur)}</dd>
              <dt>Большой мешок</dt><dd>+{money(me.settings.largeBagExtra, cur)} / шт</dd>
              <dt>♻️ Вторсырьё</dt><dd>{money(me.settings.recyclePrice, cur)} / мешок</dd>
              <dt>🛋️ Крупногабарит</dt><dd>{money(me.settings.bulkyItemPrice, cur)} / предмет</dd>
              <dt>Срочно</dt><dd>+{money(me.settings.expressPrice, cur)}</dd>
              <dt>Подписка</dt><dd>−{me.settings.subscriptionDiscountPercent}% на каждый вынос</dd>
            </dl>
          </div>
          <a className="btn ghost block" href="/install">Установить приложение на телефон</a>
          <button className="btn danger block" onClick={logout}>Выйти</button>
        </div>
      )}

      {open && (
        <ClientOrderModal
          o={open}
          onClose={() => setOpenId(null)}
          onChange={load}
          onPay={(purpose, amount) => setPay({ order: open, purpose, amount })}
          tipOptions={String(me.settings.tipOptions || '').split(',').map(Number).filter(Boolean)}
        />
      )}
      {pay && (
        <PayModal
          order={pay.order}
          purpose={pay.purpose}
          amount={pay.amount}
          onClose={() => setPay(null)}
          onPaid={() => { load(); toast(pay.purpose === 'tip' ? 'Спасибо за чаевые!' : 'Оплата прошла'); }}
        />
      )}

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'new', label: 'Заказать', icon: Icon.plus },
          { key: 'orders', label: 'Заказы', icon: Icon.list, dot: active.length },
          { key: 'subs', label: 'Подписка', icon: Icon.repeat },
          { key: 'profile', label: 'Профиль', icon: Icon.user },
        ]}
      />
    </div>
  );
}

function useQuote(body: any) {
  const [qt, setQt] = useState<any>(null);
  const key = JSON.stringify(body);
  useEffect(() => {
    const t = setTimeout(() => api('/api/quote', { body }).then(setQt).catch(() => {}), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return qt;
}

function ServicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid3">
      {Object.entries(SERVICES).map(([k, v]) => (
        <button key={k} type="button" className={`svc ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>
          <span style={{ fontSize: 26 }}>{v.icon}</span>
          <span>{v.title}</span>
        </button>
      ))}
    </div>
  );
}

function QuoteBox({ qt, cur }: { qt: any; cur: string }) {
  if (!qt) return null;
  return (
    <div className="stack" style={{ gap: 4 }}>
      {qt.lines.map((l: any, i: number) => (
        <div key={i} className="row between small"><span className="muted">{l.label}</span><span>{money(l.amount, cur)}</span></div>
      ))}
      {qt.discounts.map((l: any, i: number) => (
        <div key={i} className="row between small" style={{ color: 'var(--g600)' }}><span>{l.label}</span><span>−{money(l.amount, cur)}</span></div>
      ))}
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="muted">Итого</span>
        <span className="price">{money(qt.total, cur)}</span>
      </div>
    </div>
  );
}

function NewOrder({ me, onCreated }: { me: any; onCreated: (o: any) => void }) {
  const settings: Settings = me.settings;
  const addresses = me.user.addresses || [];
  const [service, setService] = useState('trash');
  const [addr, setAddr] = useState<any>(emptyAddress(settings, addresses[0]));
  const [bags, setBags] = useState(1);
  const [size, setSize] = useState('medium');
  const [bulky, setBulky] = useState(false);
  const [whenMode, setWhenMode] = useState<'asap' | 'time'>('asap');
  const [whenTime, setWhenTime] = useState('');
  const [express, setExpress] = useState(false);
  const [payment, setPayment] = useState('online');
  const [comment, setComment] = useState('');
  const [promo, setPromo] = useState('');
  const [useBonus, setUseBonus] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const unit = SERVICES[service].unit;

  const qt = useQuote({ service, bags, size, bulky: service === 'trash' && bulky, express: whenMode === 'asap' && express, zoneId: addr.zoneId, promo: promo || undefined, useBonus });

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const body = {
        service, address: addr, bags, size, bulky, express, payment, comment, photos, useBonus,
        promo: promo || undefined,
        when: whenMode === 'asap' ? 'asap' : whenTime ? new Date(whenTime).toISOString() : 'asap',
      };
      const r = await api('/api/orders', { body });
      setPhotos([]);
      setComment('');
      setPromo('');
      const fresh = await api('/api/orders');
      onCreated(fresh.orders.find((o: any) => o.id === r.id) || { id: r.id });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Вынести мусор</h1>
      {me.user.referralFirstOrder && <div className="note">🎁 Скидка {money(settings.referralNewClientDiscount, settings.currency)} на первый заказ по приглашению</div>}

      <div className="card stack">
        <h3>1. Что выносим</h3>
        <ServicePicker value={service} onChange={setService} />
        <div className="small muted">{SERVICES[service].hint}</div>
      </div>

      <div className="card stack">
        <h3>2. Фото у двери</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Поставьте мусор у двери и сфотографируйте так, чтобы была видна дверь или номер квартиры. Исполнитель сверит фото на месте.
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
        <h3>3. Адрес</h3>
        <AddressFields addr={addr} setAddr={setAddr} settings={settings} saved={addresses.length > 1 ? addresses : []} />
      </div>

      <div className="card stack">
        <h3>4. Объём</h3>
        <div className="row between">
          <span>{service === 'bulky' ? 'Количество предметов' : 'Количество мешков'}</span>
          <div className="stepper">
            <button type="button" onClick={() => setBags(Math.max(1, bags - 1))}>−</button>
            <b>{bags}</b>
            <button type="button" onClick={() => setBags(Math.min(settings.maxBags, bags + 1))}>+</button>
          </div>
        </div>
        {service === 'trash' && (
          <>
            <div className="chips">
              {Object.entries(SIZE_LABEL).map(([k, v]) => (
                <button key={k} type="button" className={`chip ${size === k ? 'on' : ''}`} onClick={() => setSize(k)}>{v}</button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={bulky} onChange={(e) => setBulky(e.target.checked)} />
              <span className="grow">Плюс один крупный предмет<div className="small muted">+{money(settings.bulkyPrice, settings.currency)}</div></span>
            </label>
          </>
        )}
        {service !== 'trash' && <div className="small muted">Цена: {money(service === 'bulky' ? settings.bulkyItemPrice : settings.recyclePrice, settings.currency)} за {unit}</div>}
      </div>

      <div className="card stack">
        <h3>5. Когда забрать</h3>
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
        <h3>6. Оплата</h3>
        {['online', 'cash', 'card'].map((p) => (
          <label key={p} className="check" style={{ borderColor: payment === p ? 'var(--g500)' : undefined }}>
            <input type="radio" name="pay" checked={payment === p} onChange={() => setPayment(p)} />
            <span className="grow">{PAYMENT_LABEL[p]}</span>
          </label>
        ))}
        <div className="row">
          <input className="input grow" placeholder="Промокод" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
        </div>
        {promo && qt?.promoValid === false && <div className="small" style={{ color: 'var(--danger)' }}>Промокод не найден</div>}
        {promo && qt?.promoValid && <div className="small" style={{ color: 'var(--g600)' }}>Промокод применён ✓</div>}
        {me.user.bonus > 0 && (
          <label className="check">
            <input type="checkbox" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />
            <span className="grow">Списать бонусы ({money(me.user.bonus, settings.currency)})</span>
          </label>
        )}
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий: например, пакеты справа от двери" />
      </div>

      <div className="card stack">
        <QuoteBox qt={qt} cur={settings.currency} />
        {error && <div className="error">{error}</div>}
        <button className="btn block lg" onClick={submit} disabled={busy}>
          {busy ? <span className="spin" /> : payment === 'online' ? 'Заказать и оплатить' : 'Заказать вынос'}
        </button>
      </div>
    </div>
  );
}

function ClientOrderModal({
  o, onClose, onChange, onPay, tipOptions,
}: { o: any; onClose: () => void; onChange: () => void; onPay: (p: 'order' | 'tip', amount: number) => void; tipOptions: number[] }) {
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
  const showMap = o.address?.lat && ACTIVE(o.status);
  const markers: any[] = [];
  if (o.address?.lat) markers.push({ lat: o.address.lat, lng: o.address.lng, kind: 'home', label: 'Вы' });
  if (o.workerLoc && ['accepted', 'on_way', 'arrived'].includes(o.status)) markers.push({ ...o.workerLoc, kind: 'worker', label: o.workerName?.split(' ')[0] });
  return (
    <Modal title={`Заказ №${o.num}`} onClose={onClose}>
      <div className="stack">
        {o.payment === 'online' && o.paymentStatus === 'pending' && o.status !== 'cancelled' && (
          <button className="btn block lg" onClick={() => onPay('order', o.price)}>Оплатить {money(o.price, o.currency)}</button>
        )}
        {showMap && (
          <div className="card stack">
            <h3>{o.workerLoc && ['accepted', 'on_way', 'arrived'].includes(o.status) ? 'Где исполнитель' : 'Адрес на карте'}</h3>
            <MapView markers={markers} height={200} />
            {o.workerLoc && <div className="small muted">Обновлено {fmtDate(o.workerLoc.at)}</div>}
          </div>
        )}
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
            <div className="row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="btn plain" style={{ fontSize: 32, padding: 2, color: n <= rating ? '#f59e0b' : '#cbd5e1' }} onClick={() => setRating(n)}>★</button>
              ))}
            </div>
            <textarea className="input" placeholder="Отзыв (необязательно)" value={review} onChange={(e) => setReview(e.target.value)} />
            <button className="btn block" disabled={busy} onClick={() => act({ action: 'rate', rating, review }, 'Спасибо за оценку!')}>Отправить</button>
          </div>
        )}
        {o.rating && <div className="note">Ваша оценка: {'★'.repeat(o.rating)} {o.review}</div>}
        {o.status === 'done' && (
          <div className="card stack">
            <h3>Чаевые исполнителю {o.tip ? `· уже ${money(o.tip, o.currency)}` : ''}</h3>
            <div className="chips">
              {tipOptions.map((t) => (
                <button key={t} className="chip" onClick={() => onPay('tip', t)}>+{money(t, o.currency)}</button>
              ))}
            </div>
          </div>
        )}
        {['new', 'accepted'].includes(o.status) && (
          <button className="btn danger block" disabled={busy} onClick={() => confirm('Отменить заказ?') && act({ action: 'cancel' }, 'Заказ отменён')}>
            Отменить заказ
          </button>
        )}
      </div>
    </Modal>
  );
}

function Subscriptions({ me }: { me: any }) {
  const settings: Settings = me.settings;
  const [subs, setSubs] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = () => api('/api/subscriptions').then((d) => setSubs(d.subscriptions)).catch(() => setSubs([]));
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: string) {
    try {
      await api('/api/subscriptions', { body: { id, action } });
      load();
    } catch (e: any) {
      toast(e.message);
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Подписка</h1>
        {!creating && <button className="btn sm" onClick={() => setCreating(true)}>+ Оформить</button>}
      </div>
      <div className="note">
        🔁 Выносим мусор по расписанию, вам ничего не нужно заказывать. Скидка <b>{settings.subscriptionDiscountPercent}%</b> на каждый вынос. Заказ создаётся автоматически утром в выбранные дни.
      </div>
      {creating && <NewSubscription me={me} onDone={() => { setCreating(false); load(); toast('Подписка оформлена'); }} onCancel={() => setCreating(false)} />}
      {subs === null ? (
        <Spinner />
      ) : subs.length === 0 && !creating ? (
        <div className="empty"><div className="big">📅</div>Подписок пока нет</div>
      ) : (
        subs.map((s) => (
          <div key={s.id} className="card stack">
            <div className="row between">
              <b>{SERVICES[s.service]?.icon} {SERVICES[s.service]?.title}</b>
              <span className={`badge ${s.active ? 'green' : 'gray'}`}>{s.active ? 'Активна' : 'На паузе'}</span>
            </div>
            <div className="chips">
              {WEEKDAYS.map((d, i) => (
                <span key={d} className={`chip ${s.days.includes(i) ? 'on' : ''}`} style={{ padding: '4px 10px' }}>{d}</span>
              ))}
            </div>
            <div className="small">
              ⏰ {s.time} · {s.bags} {SERVICES[s.service]?.unit} · 📍 {s.address?.street}, {s.address?.house}, кв. {s.address?.apt}
            </div>
            <div className="row between small">
              <span className="muted">{PAYMENT_LABEL[s.payment]}</span>
              <b>{money(s.perVisit, settings.currency)} за вынос · ~{money(s.perVisit * s.days.length * 4.3, settings.currency)}/мес</b>
            </div>
            <div className="row">
              <button className="btn ghost sm grow" onClick={() => act(s.id, 'toggle')}>{s.active ? '⏸ Пауза' : '▶ Возобновить'}</button>
              <button className="btn danger sm" onClick={() => confirm('Удалить подписку?') && act(s.id, 'delete')}>Удалить</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function NewSubscription({ me, onDone, onCancel }: { me: any; onDone: () => void; onCancel: () => void }) {
  const settings: Settings = me.settings;
  const [service, setService] = useState('trash');
  const [addr, setAddr] = useState<any>(emptyAddress(settings, me.user.addresses?.[0]));
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [time, setTime] = useState('09:00');
  const [bags, setBags] = useState(1);
  const [payment, setPayment] = useState('online');
  const [error, setError] = useState('');
  const qt = useQuote({ service, bags, size: 'medium', zoneId: addr.zoneId, subscription: true, useBonus: false });

  async function save() {
    setError('');
    try {
      await api('/api/subscriptions', { body: { service, address: addr, days, time, bags, payment } });
      onDone();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div className="card stack">
      <h3>Новая подписка</h3>
      <ServicePicker value={service} onChange={setService} />
      <div>
        <div className="small muted" style={{ marginBottom: 6 }}>Дни недели</div>
        <div className="chips">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" className={`chip ${days.includes(i) ? 'on' : ''}`} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <label className="f"><span>Время</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="f">
          <span>{service === 'bulky' ? 'Предметов' : 'Мешков'}</span>
          <div className="stepper" style={{ width: '100%' }}>
            <button type="button" onClick={() => setBags(Math.max(1, bags - 1))}>−</button>
            <b style={{ flex: 1 }}>{bags}</b>
            <button type="button" onClick={() => setBags(Math.min(settings.maxBags, bags + 1))}>+</button>
          </div>
        </label>
      </div>
      <AddressFields addr={addr} setAddr={setAddr} settings={settings} />
      <div className="seg">
        {['online', 'cash'].map((p) => (
          <button key={p} type="button" className={payment === p ? 'on' : ''} onClick={() => setPayment(p)}>{p === 'online' ? 'Онлайн' : 'Наличными'}</button>
        ))}
      </div>
      {qt && (
        <div className="row between">
          <span className="muted">За вынос (−{settings.subscriptionDiscountPercent}%)</span>
          <span className="price">{money(qt.total, settings.currency)}</span>
        </div>
      )}
      {qt && <div className="small muted">≈ {money(qt.total * days.length * 4.3, settings.currency)} в месяц</div>}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn grow" onClick={save}>Оформить подписку</button>
        <button className="btn plain" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

function Referral({ me }: { me: any }) {
  const code = me.user.referralCode;
  if (!code) return null;
  const link = typeof location !== 'undefined' ? `${location.origin}/?ref=${code}` : '';
  const s = me.settings;
  async function share() {
    const text = `Выношу мусор через GreenDrop. Скидка ${money(s.referralNewClientDiscount, s.currency)} на первый заказ: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'GreenDrop', text, url: link });
      else {
        await navigator.clipboard.writeText(text);
        toast('Ссылка скопирована');
      }
    } catch {}
  }
  return (
    <div className="card stack">
      <h3>🎁 Пригласите друзей</h3>
      <div className="small">
        Друг получит <b>{money(s.referralNewClientDiscount, s.currency)}</b> скидки на первый заказ, а вы <b>{money(s.referralBonus, s.currency)}</b> бонусов, когда его заказ будет выполнен.
      </div>
      <div className="row">
        <code className="input grow" style={{ display: 'flex', alignItems: 'center', fontWeight: 700, letterSpacing: 1 }}>{code}</code>
        <button className="btn" onClick={share}>Поделиться</button>
      </div>
    </div>
  );
}
