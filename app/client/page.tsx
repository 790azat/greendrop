'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/Logo';
import { OrderHead, OrderSummary, Timeline, orderProgress } from '@/components/OrderDetails';
import { AddressFields, emptyAddress } from '@/components/AddressFields';
import { PayModal } from '@/components/Pay';
import { PushToggle } from '@/components/Push';
import {
  Icon, Modal, PhotoButton, PhotoList, Progress, Spinner, TabBar, api, fmtDate, logout, t, toast, useMe, usePoll,
} from '@/components/ui';
import { LangSwitch, useLang } from '@/components/i18n';
import { PAYMENT_LABEL, SERVICES, SIZE_LABEL, Settings, WEEKDAYS, money } from '@/lib/domain';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const ACTIVE = (s: string) => !['done', 'cancelled'].includes(s);

export default function ClientPage() {
  useLang();
  const { me, reload: reloadMe } = useMe();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [walletVersion, setWalletVersion] = useState(0);
  const [pay, setPay] = useState<{ order?: any; purpose: 'order' | 'tip' | 'topup'; amount: number } | null>(null);

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
        <button className="chip" onClick={() => setTab('wallet')} style={{ fontWeight: 700 }}>👛 {money(me.user.balance, cur)}</button>
      </div>
      {me.user.demo && <div className="banner">{t('Вы в демо-аккаунте клиента. Попробуйте оформить заказ и откройте демо исполнителя в другой вкладке.')}</div>}

      {tab === 'new' && (
        <NewOrder
          me={me}
          onCreated={(o) => {
            load();
            reloadMe();
            setTab('orders');
            if (o.payment === 'online' && o.price > 0) setPay({ order: o, purpose: 'order', amount: o.price });
            else toast(t('Заказ создан! Ищем исполнителя'));
          }}
        />
      )}

      {tab === 'orders' && (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h1 style={{ margin: 0 }}>{t('Мои заказы')}</h1>
            <button className="btn sm" onClick={() => setTab('new')}>+ {t('Новый')}</button>
          </div>
          {orders === null ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <div className="empty">
              <div className="big">🗑️</div>
              {t('Заказов пока нет')}
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setTab('new')}>{t('Вынести мусор')}</button>
              </div>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="card tap stack" onClick={() => setOpenId(o.id)}>
                <OrderHead o={o} />
                {ACTIVE(o.status) && <Progress value={orderProgress(o)} />}
                <div className="row between small">
                  <span className="muted">
                    {o.bags} {t(SERVICES[o.service || 'trash'].unit)} · {o.workerName ? t('исполнитель: {name}', { name: o.workerName }) : t('ищем исполнителя')}
                  </span>
                  <b>{money(o.price, o.currency)}</b>
                </div>
                {o.payment === 'online' && o.paymentStatus === 'pending' && o.status !== 'cancelled' && (
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); setPay({ order: o, purpose: 'order', amount: o.price }); }}>
                    {t('Оплатить {sum}', { sum: money(o.price, o.currency) })}
                  </button>
                )}
              </div>
            ))
          )}
        </>
      )}

      {tab === 'subs' && <Subscriptions me={me} />}

      {tab === 'wallet' && <Wallet key={walletVersion} me={me} onTopup={(amount) => setPay({ purpose: 'topup', amount })} />}

      {tab === 'profile' && (
        <div className="stack">
          <h1>{t('Профиль')}</h1>
          <div className="card">
            <dl className="kv">
              <dt>{t('Имя')}</dt><dd>{me.user.name}</dd>
              <dt>{t('Телефон')}</dt><dd>{me.user.phone}</dd>
              <dt>{t('Заказов')}</dt><dd>{orders?.length ?? '...'}</dd>
              <dt>{t('Баланс')}</dt><dd>{money(me.user.balance, cur)}</dd>
              <dt>{t('Бонусы')}</dt><dd>{money(me.user.bonus, cur)}</dd>
            </dl>
          </div>
          <div className="card row between"><span>{t('Язык')}</span><LangSwitch /></div>
          <Referral me={me} />
          <PushToggle vapidKey={me.vapidPublicKey} />
          {!!me.user.addresses?.length && (
            <div className="card">
              <h3>{t('Сохранённые адреса')}</h3>
              {me.user.addresses.map((a: any, i: number) => (
                <div key={i} className="small" style={{ padding: '6px 0' }}>📍 {a.street}, {a.house}, {t('этаж {n}', { n: a.floor })}, {t('кв. {n}', { n: a.apt })}</div>
              ))}
            </div>
          )}
          <div className="card">
            <h3>{t('Тарифы')}</h3>
            <dl className="kv">
              <dt>🗑️ {t('1 мешок')}</dt><dd>{money(me.settings.basePrice, cur)}</dd>
              <dt>{t('Каждый следующий')}</dt><dd>+{money(me.settings.extraBagPrice, cur)}</dd>
              <dt>{t('Большой мешок')}</dt><dd>+{money(me.settings.largeBagExtra, cur)} / {t('шт')}</dd>
              <dt>♻️ {t('Вторсырьё')}</dt><dd>{money(me.settings.recyclePrice, cur)} / {t('мешок')}</dd>
              <dt>🛋️ {t('Крупногабарит')}</dt><dd>{money(me.settings.bulkyItemPrice, cur)} / {t('предмет')}</dd>
              <dt>{t('Срочно')}</dt><dd>+{money(me.settings.expressPrice, cur)}</dd>
              <dt>{t('Подписка')}</dt><dd>{t('−{p}% на каждый вынос', { p: me.settings.subscriptionDiscountPercent })}</dd>
            </dl>
          </div>
          <a className="btn ghost block" href="/install">{t('Установить приложение на телефон')}</a>
          <button className="btn danger block" onClick={logout}>{t('Выйти')}</button>
        </div>
      )}

      {open && (
        <ClientOrderModal
          o={open}
          onClose={() => setOpenId(null)}
          onChange={load}
          onPay={(purpose, amount) => setPay({ order: open, purpose, amount })}
          balance={me.user.balance}
          tipOptions={String(me.settings.tipOptions || '').split(',').map(Number).filter(Boolean)}
        />
      )}
      {pay && (
        <PayModal
          order={pay.order}
          purpose={pay.purpose}
          amount={pay.amount}
          currency={cur}
          balance={pay.purpose === 'topup' ? undefined : me.user.balance}
          onClose={() => setPay(null)}
          onPaid={() => {
            load();
            reloadMe();
            setWalletVersion((v) => v + 1);
            toast(pay.purpose === 'tip' ? t('Спасибо за чаевые!') : pay.purpose === 'topup' ? t('Баланс пополнен') : t('Оплата прошла'));
          }}
        />
      )}

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'new', label: t('Заказать'), icon: Icon.plus },
          { key: 'orders', label: t('Заказы'), icon: Icon.list, dot: active.length },
          { key: 'wallet', label: t('Кошелёк'), icon: Icon.wallet },
          { key: 'subs', label: t('Подписка|tab'), icon: Icon.repeat },
          { key: 'profile', label: t('Профиль'), icon: Icon.user },
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
          <span>{t(v.title)}</span>
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
        <div key={i} className="row between small"><span className="muted">{t(l.label)}</span><span>{money(l.amount, cur)}</span></div>
      ))}
      {qt.discounts.map((l: any, i: number) => (
        <div key={i} className="row between small" style={{ color: 'var(--g600)' }}><span>{t(l.label)}</span><span>−{money(l.amount, cur)}</span></div>
      ))}
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="muted">{t('Итого')}</span>
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
  const balance = me.user.balance || 0;
  const [payment, setPayment] = useState(balance > 0 ? 'wallet' : 'online');
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
      <h1>{t('Вынести мусор')}</h1>
      {me.user.referralFirstOrder && <div className="note">🎁 {t('Скидка {sum} на первый заказ по приглашению', { sum: money(settings.referralNewClientDiscount, settings.currency) })}</div>}

      <div className="card stack">
        <h3>1. {t('Что выносим')}</h3>
        <ServicePicker value={service} onChange={setService} />
        <div className="small muted">{t(SERVICES[service].hint)}</div>
      </div>

      <div className="card stack">
        <h3>2. {t('Фото у двери')}</h3>
        <p className="muted small" style={{ margin: 0 }}>
          {t('Поставьте мусор у двери и сфотографируйте так, чтобы была видна дверь или номер квартиры. Исполнитель сверит фото на месте.')}
        </p>
        <div className="photos">
          <PhotoList urls={photos} onRemove={(i) => setPhotos(photos.filter((_, j) => j !== i))} />
          {photos.length < 4 && (
            <PhotoButton className="addphoto" onUploaded={(u) => setPhotos([...photos, u])}>
              {Icon.camera}
              <span>{t('Фото')}</span>
            </PhotoButton>
          )}
        </div>
      </div>

      <div className="card stack">
        <h3>3. {t('Адрес')}</h3>
        <AddressFields addr={addr} setAddr={setAddr} settings={settings} saved={addresses.length > 1 ? addresses : []} />
      </div>

      <div className="card stack">
        <h3>4. {t('Объём')}</h3>
        <div className="row between">
          <span>{service === 'bulky' ? t('Количество предметов') : t('Количество мешков')}</span>
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
                <button key={k} type="button" className={`chip ${size === k ? 'on' : ''}`} onClick={() => setSize(k)}>{t(v)}</button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={bulky} onChange={(e) => setBulky(e.target.checked)} />
              <span className="grow">{t('Плюс один крупный предмет')}<div className="small muted">+{money(settings.bulkyPrice, settings.currency)}</div></span>
            </label>
          </>
        )}
        {service !== 'trash' && <div className="small muted">{t('Цена: {sum} за {unit}', { sum: money(service === 'bulky' ? settings.bulkyItemPrice : settings.recyclePrice, settings.currency), unit: t(unit) })}</div>}
      </div>

      <div className="card stack">
        <h3>5. {t('Когда забрать')}</h3>
        <div className="seg">
          <button type="button" className={whenMode === 'asap' ? 'on' : ''} onClick={() => setWhenMode('asap')}>{t('Как можно скорее')}</button>
          <button type="button" className={whenMode === 'time' ? 'on' : ''} onClick={() => setWhenMode('time')}>{t('Ко времени')}</button>
        </div>
        {whenMode === 'time' ? (
          <input className="input" type="datetime-local" value={whenTime} onChange={(e) => setWhenTime(e.target.value)} />
        ) : (
          <label className="check">
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
            <span className="grow">{t('Срочно, в течение 30 минут')}<div className="small muted">+{money(settings.expressPrice, settings.currency)}</div></span>
          </label>
        )}
      </div>

      <div className="card stack">
        <h3>6. {t('Оплата')}</h3>
        {['wallet', 'online', 'cash', 'card'].map((p) => (
          <label key={p} className="check" style={{ borderColor: payment === p ? 'var(--g500)' : undefined }}>
            <input type="radio" name="pay" checked={payment === p} onChange={() => setPayment(p)} />
            <span className="grow">
              {p === 'wallet' ? `👛 ${t('С баланса')}` : t(PAYMENT_LABEL[p])}
              {p === 'wallet' && (
                <div className="small" style={{ color: qt && balance < qt.total ? 'var(--danger)' : 'var(--muted)' }}>
                  {t('На балансе {sum}', { sum: money(balance, settings.currency) })}
                  {qt && balance < qt.total ? ` · ${t('не хватает {sum}', { sum: money(qt.total - balance, settings.currency) })}` : ''}
                </div>
              )}
            </span>
          </label>
        ))}
        <div className="row">
          <input className="input grow" placeholder={t('Промокод')} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
        </div>
        {promo && qt?.promoValid === false && <div className="small" style={{ color: 'var(--danger)' }}>{t('Промокод не найден')}</div>}
        {promo && qt?.promoValid && <div className="small" style={{ color: 'var(--g600)' }}>{t('Промокод применён')} ✓</div>}
        {me.user.bonus > 0 && (
          <label className="check">
            <input type="checkbox" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />
            <span className="grow">{t('Списать бонусы ({sum})', { sum: money(me.user.bonus, settings.currency) })}</span>
          </label>
        )}
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('Комментарий: например, пакеты справа от двери')} />
      </div>

      <div className="card stack">
        <QuoteBox qt={qt} cur={settings.currency} />
        {error && <div className="error">{error}</div>}
        <button className="btn block lg" onClick={submit} disabled={busy}>
          {busy ? <span className="spin" /> : payment === 'online' || payment === 'wallet' ? t('Заказать и оплатить') : t('Заказать вынос')}
        </button>
      </div>
    </div>
  );
}

function ClientOrderModal({
  o, onClose, onChange, onPay, tipOptions, balance,
}: { o: any; onClose: () => void; onChange: () => void; onPay: (p: 'order' | 'tip', amount: number) => void; tipOptions: number[]; balance: number }) {
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
  if (o.address?.lat) markers.push({ lat: o.address.lat, lng: o.address.lng, kind: 'home', label: t('Вы') });
  if (o.workerLoc && ['accepted', 'on_way', 'arrived'].includes(o.status)) markers.push({ ...o.workerLoc, kind: 'worker', label: o.workerName?.split(' ')[0] });
  return (
    <Modal title={t('Заказ №{n}', { n: o.num })} onClose={onClose}>
      <div className="stack">
        {o.payment === 'online' && o.paymentStatus === 'pending' && o.status !== 'cancelled' && (
          <button className="btn block lg" onClick={() => onPay('order', o.price)}>{t('Оплатить {sum}', { sum: money(o.price, o.currency) })}</button>
        )}
        {showMap && (
          <div className="card stack">
            <h3>{o.workerLoc && ['accepted', 'on_way', 'arrived'].includes(o.status) ? t('Где исполнитель') : t('Адрес на карте')}</h3>
            <MapView markers={markers} height={200} />
            {o.workerLoc && <div className="small muted">{t('Обновлено {time}', { time: fmtDate(o.workerLoc.at) })}</div>}
          </div>
        )}
        <div className="card stack">
          <OrderHead o={o} />
          <OrderSummary o={o} />
        </div>
        <div className="card">
          <h3>{t('Ход выполнения')}</h3>
          <Timeline o={o} />
        </div>
        {o.status === 'done' && !o.rating && (
          <div className="card stack">
            <h3>{t('Оцените работу')}</h3>
            <div className="row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="btn plain" style={{ fontSize: 32, padding: 2, color: n <= rating ? '#f59e0b' : '#cbd5e1' }} onClick={() => setRating(n)}>★</button>
              ))}
            </div>
            <textarea className="input" placeholder={t('Отзыв (необязательно)')} value={review} onChange={(e) => setReview(e.target.value)} />
            <button className="btn block" disabled={busy} onClick={() => act({ action: 'rate', rating, review }, t('Спасибо за оценку!'))}>{t('Отправить')}</button>
          </div>
        )}
        {o.rating && <div className="note">{t('Ваша оценка:')} {'★'.repeat(o.rating)} {o.review}</div>}
        {o.status === 'done' && (
          <div className="card stack">
            <h3>{t('Чаевые исполнителю')} {o.tip ? `· ${t('уже {sum}', { sum: money(o.tip, o.currency) })}` : ''}</h3>
            <div className="chips">
              {tipOptions.map((t) => (
                <button key={t} className="chip" onClick={() => onPay('tip', t)}>+{money(t, o.currency)}</button>
              ))}
            </div>
          </div>
        )}
        {['new', 'accepted'].includes(o.status) && (
          <button className="btn danger block" disabled={busy} onClick={() => confirm(t('Отменить заказ?')) && act({ action: 'cancel' }, t('Заказ отменён'))}>
            {t('Отменить заказ')}
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
        <h1 style={{ margin: 0 }}>{t('Подписка')}</h1>
        {!creating && <button className="btn sm" onClick={() => setCreating(true)}>+ {t('Оформить')}</button>}
      </div>
      <div className="note">
        🔁 {t('Выносим мусор по расписанию, вам ничего не нужно заказывать. Скидка {p}% на каждый вынос. Заказ создаётся автоматически утром в выбранные дни.', { p: settings.subscriptionDiscountPercent })}
      </div>
      {creating && <NewSubscription me={me} onDone={() => { setCreating(false); load(); toast(t('Подписка оформлена')); }} onCancel={() => setCreating(false)} />}
      {subs === null ? (
        <Spinner />
      ) : subs.length === 0 && !creating ? (
        <div className="empty"><div className="big">📅</div>{t('Подписок пока нет')}</div>
      ) : (
        subs.map((s) => (
          <div key={s.id} className="card stack">
            <div className="row between">
              <b>{SERVICES[s.service]?.icon} {t(SERVICES[s.service]?.title)}</b>
              <span className={`badge ${s.active ? 'green' : 'gray'}`}>{s.active ? t('Активна') : t('На паузе')}</span>
            </div>
            <div className="chips">
              {WEEKDAYS.map((d, i) => (
                <span key={d} className={`chip ${s.days.includes(i) ? 'on' : ''}`} style={{ padding: '4px 10px' }}>{t(d)}</span>
              ))}
            </div>
            <div className="small">
              ⏰ {s.time} · {s.bags} {t(SERVICES[s.service]?.unit)} · 📍 {s.address?.street}, {s.address?.house}, {t('кв. {n}', { n: s.address?.apt })}
            </div>
            <div className="row between small">
              <span className="muted">{t(PAYMENT_LABEL[s.payment])}</span>
              <b>{t('{sum} за вынос', { sum: money(s.perVisit, settings.currency) })} · ~{t('{sum}/мес', { sum: money(s.perVisit * s.days.length * 4.3, settings.currency) })}</b>
            </div>
            <div className="row">
              <button className="btn ghost sm grow" onClick={() => act(s.id, 'toggle')}>{s.active ? `⏸ ${t('Пауза')}` : `▶ ${t('Возобновить')}`}</button>
              <button className="btn danger sm" onClick={() => confirm(t('Удалить подписку?')) && act(s.id, 'delete')}>{t('Удалить')}</button>
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
      <h3>{t('Новая подписка')}</h3>
      <ServicePicker value={service} onChange={setService} />
      <div>
        <div className="small muted" style={{ marginBottom: 6 }}>{t('Дни недели')}</div>
        <div className="chips">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" className={`chip ${days.includes(i) ? 'on' : ''}`} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{t(d)}</button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <label className="f"><span>{t('Время')}</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="f">
          <span>{service === 'bulky' ? t('Предметов') : t('Мешков')}</span>
          <div className="stepper" style={{ width: '100%' }}>
            <button type="button" onClick={() => setBags(Math.max(1, bags - 1))}>−</button>
            <b style={{ flex: 1 }}>{bags}</b>
            <button type="button" onClick={() => setBags(Math.min(settings.maxBags, bags + 1))}>+</button>
          </div>
        </label>
      </div>
      <AddressFields addr={addr} setAddr={setAddr} settings={settings} />
      <div className="seg">
        {['wallet', 'online', 'cash'].map((p) => (
          <button key={p} type="button" className={payment === p ? 'on' : ''} onClick={() => setPayment(p)}>{p === 'wallet' ? t('С баланса') : p === 'online' ? t('Онлайн') : t('Наличными')}</button>
        ))}
      </div>
      {qt && (
        <div className="row between">
          <span className="muted">{t('За вынос (−{p}%)', { p: settings.subscriptionDiscountPercent })}</span>
          <span className="price">{money(qt.total, settings.currency)}</span>
        </div>
      )}
      {qt && <div className="small muted">≈ {t('{sum} в месяц', { sum: money(qt.total * days.length * 4.3, settings.currency) })}</div>}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn grow" onClick={save}>{t('Оформить подписку')}</button>
        <button className="btn plain" onClick={onCancel}>{t('Отмена')}</button>
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
    const text = t('Выношу мусор через GreenDrop. Скидка {sum} на первый заказ: {link}', { sum: money(s.referralNewClientDiscount, s.currency), link });
    try {
      if (navigator.share) await navigator.share({ title: 'GreenDrop', text, url: link });
      else {
        await navigator.clipboard.writeText(text);
        toast(t('Ссылка скопирована'));
      }
    } catch {}
  }
  return (
    <div className="card stack">
      <h3>🎁 {t('Пригласите друзей')}</h3>
      <div className="small">
        {t('Друг получит {a} скидки на первый заказ, а вы {b} бонусов, когда его заказ будет выполнен.', { a: money(s.referralNewClientDiscount, s.currency), b: money(s.referralBonus, s.currency) })}
      </div>
      <div className="row">
        <code className="input grow" style={{ display: 'flex', alignItems: 'center', fontWeight: 700, letterSpacing: 1 }}>{code}</code>
        <button className="btn" onClick={share}>{t('Поделиться')}</button>
      </div>
    </div>
  );
}

const TX_ICON: Record<string, string> = { topup: '➕', order: '🗑️', refund: '↩️', tip: '💚', admin: '🛠️' };

function Wallet({ me, onTopup }: { me: any; onTopup: (amount: number) => void }) {
  const cur = me.settings.currency;
  const [data, setData] = useState<{ balance: number; tx: any[] } | null>(null);
  const [custom, setCustom] = useState('');
  useEffect(() => {
    api('/api/wallet').then(setData).catch(() => setData({ balance: me.user.balance || 0, tx: [] }));
  }, [me.user.balance]);
  const balance = data?.balance ?? me.user.balance ?? 0;
  return (
    <div className="stack">
      <h1>{t('Кошелёк')}</h1>
      <div className="wallet-card">
        <div className="l">{t('Баланс GreenDrop')}</div>
        <div className="v">{money(balance, cur)}</div>
        <div className="small" style={{ opacity: 0.9 }}>{t('Оплачивайте вынос, подписку и чаевые с баланса в одно касание.')}</div>
      </div>
      <div className="card stack">
        <h3>{t('Пополнить')}</h3>
        <div className="grid2">
          {[1000, 2000, 5000, 10000].map((a) => (
            <button key={a} className="btn ghost" onClick={() => onTopup(a)}>+{money(a, cur)}</button>
          ))}
        </div>
        <div className="row">
          <input className="input grow" inputMode="numeric" placeholder={t('Другая сумма')} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="btn" disabled={Number(custom) < 100} onClick={() => onTopup(Number(custom))}>{t('Пополнить')}</button>
        </div>
        <div className="small muted">{t('Демо-режим: пополнение без списания реальных денег.')}</div>
      </div>
      <div className="card">
        <h3>{t('История операций')}</h3>
        {data === null ? (
          <Spinner />
        ) : data.tx.length === 0 ? (
          <div className="muted small">{t('Операций пока нет')}</div>
        ) : (
          data.tx.map((x) => (
            <div key={x.id} className="tx">
              <div className="ic">{TX_ICON[x.kind] || '•'}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{t(x.note || x.kind)}</div>
                <div className="small muted">{fmtDate(x.at)}</div>
              </div>
              <div className={`amt ${x.amount > 0 ? 'plus' : ''}`}>{x.amount > 0 ? '+' : '−'}{money(Math.abs(x.amount), cur)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
