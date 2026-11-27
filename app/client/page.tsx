'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/Logo';
import { OrderHead, OrderSummary, Timeline, orderProgress } from '@/components/OrderDetails';
import { AddressFields, emptyAddress } from '@/components/AddressFields';
import { PayModal } from '@/components/Pay';
import { PushToggle } from '@/components/Push';
import {
  Disclosure, Icon, MenuRow, Modal, PhotoButton, PhotoList, Progress, SectionTitle, Spinner, TabBar, api, fmtDate, logout, t, toast, useMe, usePoll,
} from '@/components/ui';
import { I, IconBox, PAY_ICON, SERVICE_ICON } from '@/components/Icons';
import { Onboarding } from '@/components/Onboarding';
import { LangSwitch, useLang } from '@/components/i18n';
import { PAYMENT_LABEL, SERVICES, SIZE_LABEL, Settings, WEEKDAYS, money } from '@/lib/domain';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const ACTIVE = (s: string) => !['done', 'cancelled'].includes(s);
// old tab names (links, bookmarks) → the merged screens
const TAB_ALIAS: Record<string, string> = { orders: 'home', subs: 'home', wallet: 'profile', new: 'new', home: 'home', profile: 'profile' };
const PAY_SHORT: Record<string, string> = { wallet: 'Баланс', online: 'Онлайн', cash: 'Наличные', card: 'Перевод' };

export default function ClientPage() {
  useLang();
  const { me, reload: reloadMe } = useMe();
  const [tab, setTabRaw] = useState('home');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [walletVersion, setWalletVersion] = useState(0);
  const [pay, setPay] = useState<{ order?: any; purpose: 'order' | 'tip' | 'topup'; amount: number } | null>(null);
  const [tour, setTour] = useState(false);
  const setTab = (k: string) => {
    setTabRaw(k);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (me && (!me.user || me.user.role !== 'client')) location.replace('/');
  }, [me]);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('tab');
    if (q && TAB_ALIAS[q]) setTabRaw(TAB_ALIAS[q]);
  }, []);

  const load = () => api('/api/orders').then((d) => setOrders(d.orders)).catch(() => {});
  usePoll(load, 8000);

  if (!me?.user) return <Spinner />;
  const active = (orders || []).filter((o) => ACTIVE(o.status));
  const open = orders?.find((o) => o.id === openId);
  const cur = me.settings.currency;

  return (
    <div className="shell">
      <Onboarding kind="client" force={tour} onClose={() => setTour(false)} />
      <div className="topbar">
        <Brand />
        <button className="chip" onClick={() => setTab('profile')} style={{ fontWeight: 700 }} aria-label={t('Баланс')}>
          <I n="wallet" size={16} style={{ color: 'var(--g600)' }} />{money(me.user.balance, cur)}
        </button>
      </div>
      {me.user.demo && <div className="banner row"><I n="info" size={18} />{t('Вы в демо-аккаунте клиента. Попробуйте оформить заказ и откройте демо исполнителя в другой вкладке.')}</div>}

      {tab === 'home' && (
        <Home
          me={me}
          orders={orders}
          onNew={() => setTab('new')}
          onOpen={setOpenId}
          onPay={(o) => setPay({ order: o, purpose: 'order', amount: o.price })}
        />
      )}

      {tab === 'new' && (
        <NewOrder
          me={me}
          onCreated={(o) => {
            load();
            reloadMe();
            setTab('home');
            if (o.payment === 'online' && o.price > 0) setPay({ order: o, purpose: 'order', amount: o.price });
            else toast(t('Заказ создан! Ищем исполнителя'));
          }}
        />
      )}

      {tab === 'profile' && (
        <div className="stack">
          <div className="row" style={{ gap: 12 }}>
            <IconBox n="user" size={52} />
            <div className="grow">
              <h2 style={{ margin: 0 }}>{me.user.name}</h2>
              <div className="muted small">{me.user.phone} · {t('Заказов')}: {orders?.length ?? '…'}</div>
            </div>
          </div>
          <Wallet key={walletVersion} me={me} onTopup={(amount) => setPay({ purpose: 'topup', amount })} />

          <div className="label">{t('Настройки')}</div>
          <div className="menu">
            <MenuRow icon="globe" title={t('Язык')} right={<LangSwitch compact />} />
            <PushToggle vapidKey={me.vapidPublicKey} />
            {!!me.user.addresses?.length && (
              <Disclosure icon="pin" title={t('Сохранённые адреса')} hint={`${me.user.addresses.length}`}>
                {me.user.addresses.map((a: any, i: number) => (
                  <div key={i} className="small row" style={{ padding: '6px 0' }}><I n="pin" size={16} style={{ color: 'var(--g600)' }} />{a.street}, {a.house}, {t('этаж {n}', { n: a.floor })}, {t('кв. {n}', { n: a.apt })}</div>
                ))}
              </Disclosure>
            )}
          </div>

          <div className="label">{t('Ещё')}</div>
          <div className="menu">
            <Referral me={me} />
            <Disclosure icon="tag" title={t('Тарифы')}>
              <dl className="kv">
                <dt>{t('1 мешок')}</dt><dd>{money(me.settings.basePrice, cur)}</dd>
                <dt>{t('Каждый следующий')}</dt><dd>+{money(me.settings.extraBagPrice, cur)}</dd>
                <dt>{t('Большой мешок')}</dt><dd>+{money(me.settings.largeBagExtra, cur)} / {t('шт')}</dd>
                <dt>{t('Вторсырьё')}</dt><dd>{money(me.settings.recyclePrice, cur)} / {t('мешок')}</dd>
                <dt>{t('Крупногабарит')}</dt><dd>{money(me.settings.bulkyItemPrice, cur)} / {t('предмет')}</dd>
                <dt>{t('Срочно')}</dt><dd>+{money(me.settings.expressPrice, cur)}</dd>
                <dt>{t('Подписка')}</dt><dd>{t('−{p}% на каждый вынос', { p: me.settings.subscriptionDiscountPercent })}</dd>
              </dl>
            </Disclosure>
            <MenuRow icon="help" tone="gray" title={t('Как пользоваться')} onClick={() => setTour(true)} />
            <MenuRow icon="download" tone="gray" title={t('Установить приложение на телефон')} href="/install" />
            <MenuRow icon="logout" danger title={t('Выйти')} onClick={logout} right={<span />} />
          </div>
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
          { key: 'home', label: t('Главная'), icon: Icon.home, dot: active.length },
          { key: 'new', label: t('Заказать'), icon: Icon.plus, primary: true },
          { key: 'profile', label: t('Профиль'), icon: Icon.user },
        ]}
      />
    </div>
  );
}

function OrderCard({ o, onOpen, onPay }: { o: any; onOpen: (id: string) => void; onPay: (o: any) => void }) {
  return (
    <div className="card tap stack" onClick={() => onOpen(o.id)}>
      <OrderHead o={o} />
      {ACTIVE(o.status) && <Progress value={orderProgress(o)} />}
      <div className="row between">
        <div className="meta">
          <span><I n="bag" size={14} />{o.bags} {t(SERVICES[o.service || 'trash'].unit)}</span>
          <span><I n="user" size={14} />{o.workerName || t('ищем исполнителя')}</span>
        </div>
        <b>{money(o.price, o.currency)}</b>
      </div>
      {o.payment === 'online' && o.paymentStatus === 'pending' && o.status !== 'cancelled' && (
        <button className="btn sm" onClick={(e) => { e.stopPropagation(); onPay(o); }}>
          <I n="card" size={18} />{t('Оплатить {sum}', { sum: money(o.price, o.currency) })}
        </button>
      )}
    </div>
  );
}

function Home({ me, orders, onNew, onOpen, onPay }: { me: any; orders: any[] | null; onNew: () => void; onOpen: (id: string) => void; onPay: (o: any) => void }) {
  const [all, setAll] = useState(false);
  const active = (orders || []).filter((o) => ACTIVE(o.status));
  const past = (orders || []).filter((o) => !ACTIVE(o.status));
  const first = me.user.name?.split(' ')[0];
  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>{t('Привет, {name}!', { name: first })}</h1>
        <div className="muted">{active.length ? t('Следим за вашим заказом') : t('Что вынесем сегодня?')}</div>
      </div>
      <button className="cta" onClick={onNew}>
        <span className="ibox"><I n="trash" size={26} /></span>
        <span className="grow"><b>{t('Вынести мусор')}</b><span className="s">{t('Заказ за минуту · от {sum}', { sum: money(me.settings.basePrice, me.settings.currency) })}</span></span>
        <I n="chevron" size={22} />
      </button>

      {orders === null ? (
        <Spinner />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="label">{t('Активные заказы')}</div>
              {active.map((o) => <OrderCard key={o.id} o={o} onOpen={onOpen} onPay={onPay} />)}
            </>
          )}
          <Subscriptions me={me} />
          {past.length > 0 && (
            <>
              <div className="label">{t('История')}</div>
              <div className="menu">
                {(all ? past : past.slice(0, 4)).map((o) => (
                  <MenuRow
                    key={o.id}
                    icon={SERVICE_ICON[o.service || 'trash']}
                    tone={o.status === 'cancelled' ? 'gray' : 'green'}
                    title={`${o.address?.street || ''}, ${o.address?.house || ''}`}
                    hint={`${fmtDate(o.completedAt || o.createdAt)} · ${o.status === 'cancelled' ? t('Отменён') : money(o.price, o.currency)}`}
                    onClick={() => onOpen(o.id)}
                  />
                ))}
              </div>
              {past.length > 4 && !all && <button className="btn plain block" onClick={() => setAll(true)}>{t('Показать все ({n})', { n: past.length })}</button>}
            </>
          )}
        </>
      )}
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
    <div className="tiles">
      {Object.entries(SERVICES).map(([k, v]) => (
        <button key={k} type="button" className={`tile ${value === k ? 'on' : ''}`} onClick={() => onChange(k)} aria-pressed={value === k}>
          <span className="ibox"><I n={SERVICE_ICON[k]} size={20} /></span>
          <span>{t(v.title)}</span>
        </button>
      ))}
    </div>
  );
}

function QuoteLines({ qt, cur }: { qt: any; cur: string }) {
  if (!qt) return null;
  return (
    <div className="stack" style={{ gap: 4 }}>
      {qt.lines.map((l: any, i: number) => (
        <div key={i} className="row between small"><span className="muted">{t(l.label)}</span><span>{money(l.amount, cur)}</span></div>
      ))}
      {qt.discounts.map((l: any, i: number) => (
        <div key={i} className="row between small" style={{ color: 'var(--g600)' }}><span>{t(l.label)}</span><span>−{money(l.amount, cur)}</span></div>
      ))}
    </div>
  );
}

function Stepper({ value, set, max }: { value: number; set: (n: number) => void; max: number }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => set(Math.max(1, value - 1))} aria-label="−">−</button>
      <b>{value}</b>
      <button type="button" onClick={() => set(Math.min(max, value + 1))} aria-label="+">+</button>
    </div>
  );
}

function NewOrder({ me, onCreated }: { me: any; onCreated: (o: any) => void }) {
  const settings: Settings = me.settings;
  const cur = settings.currency;
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

  const short = !(balance >= (qt?.total ?? 0));

  return (
    <div className="stack">
      <h1>{t('Новый заказ')}</h1>
      {me.user.referralFirstOrder && <div className="note row"><I n="gift" size={18} />{t('Скидка {sum} на первый заказ по приглашению', { sum: money(settings.referralNewClientDiscount, cur) })}</div>}

      <div className="card stack">
        <SectionTitle icon="trash">{t('Что выносим')}</SectionTitle>
        <ServicePicker value={service} onChange={setService} />
        <div className="small muted">{t(SERVICES[service].hint)}</div>
        <div className="row between">
          <span style={{ fontWeight: 600 }}>{service === 'bulky' ? t('Количество предметов') : t('Количество мешков')}</span>
          <Stepper value={bags} set={setBags} max={settings.maxBags} />
        </div>
        {service === 'trash' ? (
          <>
            <div className="chips">
              {Object.entries(SIZE_LABEL).map(([k, v]) => (
                <button key={k} type="button" className={`chip ${size === k ? 'on' : ''}`} onClick={() => setSize(k)}>{t(v)}</button>
              ))}
            </div>
            <label className="check">
              <I n="sofa" size={20} style={{ color: 'var(--g600)' }} />
              <span className="grow">{t('Плюс один крупный предмет')}<div className="small muted">+{money(settings.bulkyPrice, cur)}</div></span>
              <input type="checkbox" checked={bulky} onChange={(e) => setBulky(e.target.checked)} />
            </label>
          </>
        ) : (
          <div className="small muted">{t('Цена: {sum} за {unit}', { sum: money(service === 'bulky' ? settings.bulkyItemPrice : settings.recyclePrice, cur), unit: t(unit) })}</div>
        )}
      </div>

      <div className="card stack">
        <SectionTitle icon="camera">{t('Фото у двери')}</SectionTitle>
        <p className="muted small" style={{ margin: 0 }}>{t('Чтобы были видны пакеты и номер квартиры. Исполнитель сверит фото на месте.')}</p>
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
        <SectionTitle icon="pin">{t('Адрес')}</SectionTitle>
        <AddressFields addr={addr} setAddr={setAddr} settings={settings} saved={addresses.length > 1 ? addresses : []} />
      </div>

      <div className="card stack">
        <SectionTitle icon="clock">{t('Когда забрать')}</SectionTitle>
        <div className="seg">
          <button type="button" className={whenMode === 'asap' ? 'on' : ''} onClick={() => setWhenMode('asap')}>{t('Как можно скорее')}</button>
          <button type="button" className={whenMode === 'time' ? 'on' : ''} onClick={() => setWhenMode('time')}>{t('Ко времени')}</button>
        </div>
        {whenMode === 'time' ? (
          <input className="input" type="datetime-local" value={whenTime} onChange={(e) => setWhenTime(e.target.value)} />
        ) : (
          <label className="check">
            <I n="zap" size={20} style={{ color: 'var(--amber)' }} />
            <span className="grow">{t('Срочно, в течение 30 минут')}<div className="small muted">+{money(settings.expressPrice, cur)}</div></span>
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
          </label>
        )}
      </div>

      <div className="card stack">
        <SectionTitle icon="wallet">{t('Оплата')}</SectionTitle>
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {['wallet', 'online', 'cash', 'card'].map((p) => (
            <button key={p} type="button" className={`tile ${payment === p ? 'on' : ''}`} onClick={() => setPayment(p)} aria-pressed={payment === p} title={t(PAYMENT_LABEL[p])}>
              <span className="ibox"><I n={PAY_ICON[p]} size={20} /></span>
              <span>{t(PAY_SHORT[p])}</span>
            </button>
          ))}
        </div>
        <div className="small" style={{ color: payment === 'wallet' && qt && short ? 'var(--danger)' : 'var(--muted)' }}>
          {payment === 'wallet'
            ? `${t('На балансе {sum}', { sum: money(balance, cur) })}${qt && short ? ` · ${t('не хватает {sum}', { sum: money(qt.total - balance, cur) })}` : ''}`
            : t(PAYMENT_LABEL[payment])}
        </div>
        <div className="menu" style={{ boxShadow: 'none' }}>
          <Disclosure icon="tag" title={t('Промокод и комментарий')} defaultOpen={!!(promo || comment)}>
            <div className="stack">
              <input className="input" placeholder={t('Промокод')} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
              {promo && qt?.promoValid === false && <div className="small" style={{ color: 'var(--danger)' }}>{t('Промокод не найден')}</div>}
              {promo && qt?.promoValid && <div className="small" style={{ color: 'var(--g600)' }}>{t('Промокод применён')} ✓</div>}
              {me.user.bonus > 0 && (
                <label className="check">
                  <I n="gift" size={20} style={{ color: 'var(--g600)' }} />
                  <span className="grow">{t('Списать бонусы ({sum})', { sum: money(me.user.bonus, cur) })}</span>
                  <input type="checkbox" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />
                </label>
              )}
              <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('Комментарий: например, пакеты справа от двери')} />
            </div>
          </Disclosure>
        </div>
        <QuoteLines qt={qt} cur={cur} />
        {error && <div className="error">{error}</div>}
      </div>

      <div className="paybar">
        <div>
          <div className="small muted">{t('Итого')}</div>
          <div className="tot">{qt ? money(qt.total, cur) : '…'}</div>
        </div>
        <button className="btn lg" onClick={submit} disabled={busy}>
          {busy ? <span className="spin" /> : <><I n="check" size={20} stroke={2.6} />{payment === 'online' || payment === 'wallet' ? t('Заказать и оплатить') : t('Заказать вынос')}</>}
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
          <button className="btn block lg" onClick={() => onPay('order', o.price)}><I n="card" size={20} />{t('Оплатить {sum}', { sum: money(o.price, o.currency) })}</button>
        )}
        {showMap && (
          <div className="card stack">
            <SectionTitle icon="map">{o.workerLoc && ['accepted', 'on_way', 'arrived'].includes(o.status) ? t('Где исполнитель') : t('Адрес на карте')}</SectionTitle>
            <MapView markers={markers} height={200} />
            {o.workerLoc && <div className="small muted">{t('Обновлено {time}', { time: fmtDate(o.workerLoc.at) })}</div>}
          </div>
        )}
        <div className="card stack">
          <OrderHead o={o} />
          <OrderSummary o={o} />
        </div>
        <div className="card">
          <SectionTitle icon="route">{t('Ход выполнения')}</SectionTitle>
          <Timeline o={o} />
        </div>
        {o.status === 'done' && !o.rating && (
          <div className="card stack">
            <SectionTitle icon="star">{t('Оцените работу')}</SectionTitle>
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
            <SectionTitle icon="gift">{t('Чаевые исполнителю')} {o.tip ? `· ${t('уже {sum}', { sum: money(o.tip, o.currency) })}` : ''}</SectionTitle>
            <div className="chips">
              {tipOptions.map((t) => (
                <button key={t} className="chip" onClick={() => onPay('tip', t)}>+{money(t, o.currency)}</button>
              ))}
            </div>
          </div>
        )}
        {['new', 'accepted'].includes(o.status) && (
          <button className="btn danger block" disabled={busy} onClick={() => confirm(t('Отменить заказ?')) && act({ action: 'cancel' }, t('Заказ отменён'))}>
            <I n="x" size={18} />{t('Отменить заказ')}
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
    <>
      <div className="label">{t('Регулярный вынос')}</div>
      {creating && <NewSubscription me={me} onDone={() => { setCreating(false); load(); toast(t('Подписка оформлена')); }} onCancel={() => setCreating(false)} />}
      {subs === null ? null : subs.length === 0 && !creating ? (
        <div className="menu">
          <MenuRow
            icon="repeat"
            title={t('Вынос по расписанию')}
            hint={t('Выбираете дни, заказ создаётся сам. Скидка {p}%', { p: settings.subscriptionDiscountPercent })}
            onClick={() => setCreating(true)}
            right={<span className="btn sm" style={{ boxShadow: 'none' }}><I n="plus" size={16} />{t('Оформить')}</span>}
          />
        </div>
      ) : (
        subs.map((s) => (
          <div key={s.id} className="card stack">
            <div className="ohead">
              <IconBox n="repeat" tone={s.active ? 'green' : 'gray'} />
              <div className="grow">
                <b>{t(SERVICES[s.service]?.title)}</b>
                <div className="small muted">{s.address?.street}, {s.address?.house}, {t('кв. {n}', { n: s.address?.apt })}</div>
              </div>
              <span className={`badge ${s.active ? 'green' : 'gray'}`}>{s.active ? t('Активна') : t('На паузе')}</span>
            </div>
            <div className="chips">
              {WEEKDAYS.map((d, i) => (
                <span key={d} className={`chip ${s.days.includes(i) ? 'on' : ''}`} style={{ padding: '4px 10px' }}>{t(d)}</span>
              ))}
            </div>
            <div className="row between">
              <div className="meta">
                <span><I n="clock" size={14} />{s.time}</span>
                <span><I n="bag" size={14} />{s.bags} {t(SERVICES[s.service]?.unit)}</span>
                <span><I n={PAY_ICON[s.payment] || 'cash'} size={14} />{t(PAY_SHORT[s.payment] || s.payment)}</span>
              </div>
              <b className="small">{t('{sum} за вынос', { sum: money(s.perVisit, settings.currency) })}</b>
            </div>
            <div className="row">
              <button className="btn ghost sm grow" onClick={() => act(s.id, 'toggle')}><I n={s.active ? 'pause' : 'play'} size={16} />{s.active ? t('Пауза') : t('Возобновить')}</button>
              <button className="iconbtn" style={{ color: 'var(--danger)' }} aria-label={t('Удалить')} title={t('Удалить')} onClick={() => confirm(t('Удалить подписку?')) && act(s.id, 'delete')}><I n="trash" size={18} /></button>
            </div>
          </div>
        ))
      )}
      {!!subs?.length && !creating && <button className="btn ghost block sm" onClick={() => setCreating(true)}><I n="plus" size={16} />{t('Ещё одно расписание')}</button>}
    </>
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
      <SectionTitle icon="repeat">{t('Новая подписка')}</SectionTitle>
      <div className="small muted">{t('Выносим мусор по расписанию, вам ничего не нужно заказывать. Скидка {p}% на каждый вынос. Заказ создаётся автоматически утром в выбранные дни.', { p: settings.subscriptionDiscountPercent })}</div>
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
    <Disclosure icon="gift" title={t('Пригласите друзей')} hint={t('Бонус {sum} за каждого друга', { sum: money(s.referralBonus, s.currency) })}>
      <div className="stack">
        <div className="small">
          {t('Друг получит {a} скидки на первый заказ, а вы {b} бонусов, когда его заказ будет выполнен.', { a: money(s.referralNewClientDiscount, s.currency), b: money(s.referralBonus, s.currency) })}
        </div>
        <div className="row">
          <code className="input grow" style={{ display: 'flex', alignItems: 'center', fontWeight: 700, letterSpacing: 1 }}>{code}</code>
          <button className="btn" onClick={share}><I n="share" size={18} />{t('Поделиться')}</button>
        </div>
      </div>
    </Disclosure>
  );
}

const TX_ICON: Record<string, string> = { topup: 'plus', order: 'trash', refund: 'back', tip: 'gift', admin: 'settings' };

function Wallet({ me, onTopup }: { me: any; onTopup: (amount: number) => void }) {
  const cur = me.settings.currency;
  const [data, setData] = useState<{ balance: number; tx: any[] } | null>(null);
  const [custom, setCustom] = useState('');
  useEffect(() => {
    api('/api/wallet').then(setData).catch(() => setData({ balance: me.user.balance || 0, tx: [] }));
  }, [me.user.balance]);
  const balance = data?.balance ?? me.user.balance ?? 0;
  return (
    <>
      <div className="wallet-card">
        <div className="row between">
          <div className="l row" style={{ gap: 6 }}><I n="wallet" size={18} />{t('Баланс GreenDrop')}</div>
          {me.user.bonus > 0 && <span className="small" style={{ opacity: 0.9 }}>{t('Бонусы')}: {money(me.user.bonus, cur)}</span>}
        </div>
        <div className="v">{money(balance, cur)}</div>
        <div className="grid3" style={{ position: 'relative', zIndex: 1 }}>
          {[1000, 2000, 5000].map((a) => (
            <button key={a} className="btn sm" onClick={() => onTopup(a)}>+{money(a, cur)}</button>
          ))}
        </div>
      </div>
      <div className="menu">
        <Disclosure icon="plus" title={t('Другая сумма')}>
          <div className="row">
            <input className="input grow" inputMode="numeric" placeholder={t('Сумма')} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <button className="btn" disabled={Number(custom) < 100} onClick={() => onTopup(Number(custom))}>{t('Пополнить')}</button>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>{t('Демо-режим: пополнение без списания реальных денег.')}</div>
        </Disclosure>
        <Disclosure icon="list" title={t('История операций')} hint={data?.tx.length ? `${data.tx.length}` : undefined}>
          {data === null ? (
            <Spinner />
          ) : data.tx.length === 0 ? (
            <div className="muted small">{t('Операций пока нет')}</div>
          ) : (
            data.tx.map((x) => (
              <div key={x.id} className="tx">
                <div className="ic"><I n={TX_ICON[x.kind] || 'info'} size={18} style={{ color: 'var(--g600)' }} /></div>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{t(x.note || x.kind)}</div>
                  <div className="small muted">{fmtDate(x.at)}</div>
                </div>
                <div className={`amt ${x.amount > 0 ? 'plus' : ''}`}>{x.amount > 0 ? '+' : '−'}{money(Math.abs(x.amount), cur)}</div>
              </div>
            ))
          )}
        </Disclosure>
      </div>
    </>
  );
}
