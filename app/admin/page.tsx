'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Brand, LogoMark } from '@/components/Logo';
import { OrderSummary, Timeline } from '@/components/OrderDetails';
import { Badge, Modal, Spinner, api, addrLine, fmtDate, logout, toast, useMe, usePoll } from '@/components/ui';
import { PAYMENT_LABEL, SERVICES, STATUS_LABEL, WEEKDAYS, money } from '@/lib/domain';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function AdminPage() {
  const { me, reload } = useMe();
  if (me === undefined) return <Spinner />;
  if (me.user?.role !== 'admin') return <AdminLogin onDone={reload} />;
  return <Admin me={me} reload={reload} />;
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="shell" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="center" style={{ marginBottom: 20 }}>
        <LogoMark size={64} />
        <h1 style={{ marginTop: 12 }}>Админ-панель</h1>
        <p className="muted">GreenDrop</p>
      </div>
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            await api('/api/auth/login', { body: { admin: true, password } });
            onDone();
          } catch (er: any) {
            setError(er.message);
          }
        }}
      >
        <label className="f">
          <span>Пароль администратора</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn block lg">Войти</button>
        <a className="btn plain block" href="/">← На главную</a>
      </form>
    </div>
  );
}

function Admin({ me, reload }: { me: any; reload: () => void }) {
  const [tab, setTab] = useState('overview');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [users, setUsers] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const loadOrders = () => api('/api/orders').then((d) => setOrders(d.orders)).catch(() => {});
  const loadUsers = () => api('/api/admin/users').then((d) => setUsers(d.users)).catch(() => {});
  usePoll(() => {
    loadOrders();
    loadUsers();
  }, 10000);

  const workers = (users || []).filter((u) => u.role === 'worker');
  const clients = (users || []).filter((u) => u.role === 'client');
  const pendingWorkers = workers.filter((w) => w.pending);
  const cur = me.settings.currency;
  const openOrder = orders?.find((o) => o.id === open);

  const tabs = [
    ['overview', 'Обзор'],
    ['orders', `Заказы${orders ? ` (${orders.length})` : ''}`],
    ['workers', `Исполнители${pendingWorkers.length ? ` · ${pendingWorkers.length} новых` : ''}`],
    ['map', 'Карта'],
    ['subs', 'Подписки'],
    ['clients', 'Клиенты'],
    ['settings', 'Настройки'],
  ];

  return (
    <div className="shell wide" style={{ paddingBottom: 40 }}>
      <div className="topbar">
        <a href="/admin" style={{ textDecoration: 'none' }}><Brand /></a>
        <div className="row">
          <span className="small muted">Админ</span>
          <button className="btn plain sm" onClick={logout}>Выйти</button>
        </div>
      </div>
      {me.demoDb && (
        <div className="banner">
          Демо-хранилище: данные сохраняются снимками в Vercel Blob. Для работы с реальными клиентами подключите Neon Postgres (Vercel → Storage).
        </div>
      )}
      <div className="seg" style={{ marginBottom: 16 }}>
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {!orders || !users ? (
        <Spinner />
      ) : (
        <>
          {tab === 'overview' && <Overview orders={orders} workers={workers} cur={cur} onOpen={setOpen} pending={pendingWorkers.length} goWorkers={() => setTab('workers')} />}
          {tab === 'orders' && <Orders orders={orders} onOpen={setOpen} />}
          {tab === 'workers' && <Workers workers={workers} cur={cur} reload={loadUsers} />}
          {tab === 'clients' && <Clients clients={clients} cur={cur} />}
          {tab === 'map' && <LiveMap orders={orders} workers={workers} onOpen={setOpen} />}
          {tab === 'subs' && <AdminSubs cur={cur} />}
          {tab === 'settings' && <SettingsForm onSaved={reload} />}
        </>
      )}

      {openOrder && (
        <AdminOrderModal o={openOrder} workers={workers.filter((w) => w.active)} onClose={() => setOpen(null)} onChange={loadOrders} />
      )}
    </div>
  );
}

function Overview({ orders, workers, cur, onOpen, pending, goWorkers }: any) {
  const today = new Date().toDateString();
  const todayOrders = orders.filter((o: any) => new Date(o.createdAt).toDateString() === today);
  const done = orders.filter((o: any) => o.status === 'done');
  const revenue = done.reduce((s: number, o: any) => s + (o.price || 0), 0);
  const payout = done.reduce((s: number, o: any) => s + (o.workerShare || 0), 0);
  const waiting = orders.filter((o: any) => o.status === 'new');
  const inWork = orders.filter((o: any) => !['new', 'done', 'cancelled'].includes(o.status));
  const rated = done.filter((o: any) => o.rating);
  const avg = rated.length ? (rated.reduce((s: number, o: any) => s + o.rating, 0) / rated.length).toFixed(1) : '—';

  return (
    <div className="stack">
      {pending > 0 && (
        <div className="note row between">
          <span>Новых заявок от исполнителей: <b>{pending}</b></span>
          <button className="btn sm" onClick={goWorkers}>Проверить</button>
        </div>
      )}
      <div className="stats">
        <div className="stat"><div className="l">Заказов сегодня</div><div className="v">{todayOrders.length}</div></div>
        <div className="stat"><div className="l">Ждут исполнителя</div><div className="v" style={{ color: waiting.length ? '#d97706' : undefined }}>{waiting.length}</div></div>
        <div className="stat"><div className="l">В работе</div><div className="v">{inWork.length}</div></div>
        <div className="stat"><div className="l">Выполнено всего</div><div className="v">{done.length}</div></div>
        <div className="stat"><div className="l">Выручка</div><div className="v">{money(revenue, cur)}</div></div>
        <div className="stat"><div className="l">Выплаты исполнителям</div><div className="v">{money(payout, cur)}</div></div>
        <div className="stat"><div className="l">Доход сервиса</div><div className="v">{money(revenue - payout, cur)}</div></div>
        <div className="stat"><div className="l">Оплачено онлайн</div><div className="v">{money(orders.filter((o: any) => o.payment === 'online' && o.paymentStatus === 'paid').reduce((a: number, o: any) => a + (o.price || 0), 0), cur)}</div></div>
        <div className="stat"><div className="l">Чаевые</div><div className="v">{money(orders.reduce((a: number, o: any) => a + (o.tip || 0), 0), cur)}</div></div>
        <div className="stat"><div className="l">Средняя оценка</div><div className="v">{avg} ★</div></div>
        <div className="stat"><div className="l">Активных исполнителей</div><div className="v">{workers.filter((w: any) => w.active).length}</div></div>
      </div>
      <h2 style={{ marginTop: 20 }}>Требуют внимания</h2>
      {[...waiting, ...inWork].length === 0 ? (
        <div className="card muted">Все заказы обработаны 🌿</div>
      ) : (
        <Orders orders={[...waiting, ...inWork]} onOpen={onOpen} compact />
      )}
    </div>
  );
}

function Orders({ orders, onOpen, compact }: { orders: any[]; onOpen: (id: string) => void; compact?: boolean }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === 'active' && ['done', 'cancelled', 'new'].includes(o.status)) return false;
      if (filter !== 'all' && filter !== 'active' && o.status !== filter) return false;
      if (s && !`${o.num} ${o.clientName} ${o.clientPhone} ${o.workerName} ${addrLine(o.address)}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [orders, filter, search]);
  return (
    <div className="card">
      {!compact && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <input className="input grow" style={{ minWidth: 200 }} placeholder="Поиск: №, имя, телефон, адрес" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Все статусы</option>
            <option value="new">Ждут исполнителя</option>
            <option value="active">В работе</option>
            <option value="done">Выполнены</option>
            <option value="cancelled">Отменены</option>
          </select>
        </div>
      )}
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>№</th><th>Создан</th><th>Услуга</th><th>Адрес</th><th>Клиент</th><th>Исполнитель</th><th>Мешки</th><th>Сумма</th><th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="tap" onClick={() => onOpen(o.id)}>
                <td><b>{o.num}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(o.createdAt)}</td>
                <td title={SERVICES[o.service || 'trash'].title}>{SERVICES[o.service || 'trash'].icon}{o.subscriptionId ? ' 🔁' : ''}</td>
                <td>{addrLine(o.address)}</td>
                <td>{o.clientName}<div className="small muted">{o.clientPhone}</div></td>
                <td>{o.workerName || <span className="muted">—</span>}</td>
                <td>{o.bags}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{money(o.price, o.currency)}{o.paymentStatus === 'paid' ? ' ✓' : ''}</td>
                <td><Badge status={o.status} /></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={9} className="center muted" style={{ padding: 30 }}>Нет заказов</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminOrderModal({ o, workers, onClose, onChange }: any) {
  const [wid, setWid] = useState(o.workerId || '');
  async function act(body: any, msg: string) {
    try {
      await api(`/api/orders/${o.id}`, { body });
      toast(msg);
      onChange();
    } catch (e: any) {
      toast(e.message);
    }
  }
  const closed = ['done', 'cancelled'].includes(o.status);
  return (
    <Modal title={<>Заказ №{o.num} <Badge status={o.status} /></>} onClose={onClose}>
      <div className="stack">
        <div className="card"><OrderSummary o={o} /></div>
        {!closed && (
          <div className="card stack">
            <h3>Управление</h3>
            <div className="row wrap">
              <select className="input grow" value={wid} onChange={(e) => setWid(e.target.value)}>
                <option value="">— без исполнителя —</option>
                {workers.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name} · {w.phone}</option>
                ))}
              </select>
              <button className="btn" onClick={() => act({ action: 'assign', workerId: wid || null }, 'Сохранено')}>Назначить</button>
            </div>
            <button className="btn danger" onClick={() => { const r = prompt('Причина отмены'); if (r !== null) act({ action: 'cancel', reason: r }, 'Заказ отменён'); }}>
              Отменить заказ
            </button>
          </div>
        )}
        <div className="card"><h3>Ход выполнения</h3><Timeline o={o} /></div>
        {o.rating && <div className="note">Оценка клиента: {'★'.repeat(o.rating)} {o.review}</div>}
        <div className="card">
          <h3>История</h3>
          {(o.history || []).slice().reverse().map((h: any, i: number) => (
            <div key={i} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="muted">{fmtDate(h.at)}</span> · {h.text} {h.by && <span className="muted">({h.by})</span>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Workers({ workers, cur, reload }: any) {
  const [form, setForm] = useState({ name: '', phone: '', pin: '' });
  const [adding, setAdding] = useState(false);
  async function act(body: any, msg: string) {
    try {
      await api('/api/admin/users', { body });
      toast(msg);
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  }
  return (
    <div className="stack">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Исполнители</h2>
        <button className="btn sm" onClick={() => setAdding(!adding)}>+ Добавить</button>
      </div>
      {adding && (
        <div className="card stack">
          <div className="grid3">
            <input className="input" placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="PIN (4-8 цифр)" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
          </div>
          <button className="btn" onClick={() => act({ action: 'create', ...form }, 'Исполнитель добавлен').then(() => { setForm({ name: '', phone: '', pin: '' }); setAdding(false); })}>
            Сохранить
          </button>
          <div className="small muted">Исполнители также могут подать заявку сами на главной странице («Я исполнитель»), вы одобрите её здесь.</div>
        </div>
      )}
      <div className="card table-wrap">
        <table className="t">
          <thead><tr><th>Имя</th><th>Телефон</th><th>Выполнено</th><th>Заработал</th><th>Рейтинг</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {workers.map((w: any) => (
              <tr key={w.id}>
                <td><b>{w.name}</b><div className="small muted">с {new Date(w.createdAt).toLocaleDateString('ru-RU')}</div></td>
                <td><a href={`tel:${w.phone}`}>{w.phone}</a></td>
                <td>{w.done}</td>
                <td>{money(w.earned, cur)}</td>
                <td>{w.rating ? `${w.rating.toFixed(1)} ★` : '—'}</td>
                <td>
                  {w.pending ? <span className="badge amber">Заявка</span> : w.active ? <span className="badge green">Активен</span> : <span className="badge gray">Заблокирован</span>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {w.pending && <button className="btn sm" onClick={() => act({ action: 'approve', id: w.id }, 'Одобрено')}>Одобрить</button>}{' '}
                  {w.active ? (
                    <button className="btn sm danger" onClick={() => confirm(`Заблокировать ${w.name}?`) && act({ action: 'block', id: w.id }, 'Заблокирован')}>Блок</button>
                  ) : !w.pending ? (
                    <button className="btn sm ghost" onClick={() => act({ action: 'unblock', id: w.id }, 'Разблокирован')}>Вернуть</button>
                  ) : (
                    <button className="btn sm danger" onClick={() => act({ action: 'block', id: w.id }, 'Отклонено')}>Отклонить</button>
                  )}{' '}
                  <button className="btn sm plain" onClick={() => { const p = prompt('Новый PIN (4-8 цифр)'); if (p) act({ action: 'resetPin', id: w.id, pin: p }, 'PIN изменён'); }}>PIN</button>
                </td>
              </tr>
            ))}
            {workers.length === 0 && <tr><td colSpan={7} className="center muted" style={{ padding: 30 }}>Пока нет исполнителей</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Clients({ clients, cur }: any) {
  return (
    <div className="card table-wrap">
      <table className="t">
        <thead><tr><th>Имя</th><th>Телефон</th><th>Заказов</th><th>Потратил</th><th>Бонусы</th><th>Реф. код</th><th>Регистрация</th></tr></thead>
        <tbody>
          {clients.map((c: any) => (
            <tr key={c.id}>
              <td><b>{c.name}</b></td>
              <td><a href={`tel:${c.phone}`}>{c.phone}</a></td>
              <td>{c.orders}</td>
              <td>{money(c.spent, cur)}</td>
              <td>{money(c.bonus, cur)}</td>
              <td>{c.referralCode}{c.referredBy ? <div className="small muted">приглашён</div> : null}</td>
              <td>{new Date(c.createdAt).toLocaleDateString('ru-RU')}</td>
            </tr>
          ))}
          {clients.length === 0 && <tr><td colSpan={7} className="center muted" style={{ padding: 30 }}>Пока нет клиентов</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const NUM_FIELDS: [string, string][] = [
  ['basePrice', 'Цена за первый мешок'],
  ['extraBagPrice', 'Каждый следующий мешок'],
  ['largeBagExtra', 'Доплата за большой мешок (за шт.)'],
  ['bulkyPrice', 'Крупный предмет к обычному заказу'],
  ['recyclePrice', 'Вторсырьё, за мешок'],
  ['bulkyItemPrice', 'Крупногабарит, за предмет'],
  ['expressPrice', 'Срочный вынос (30 мин)'],
  ['workerSharePercent', 'Доля исполнителя, %'],
  ['subscriptionDiscountPercent', 'Скидка по подписке, %'],
  ['referralNewClientDiscount', 'Скидка приглашённому на 1-й заказ'],
  ['referralBonus', 'Бонус пригласившему'],
  ['maxBags', 'Максимум мешков в заказе'],
];

function SettingsForm({ onSaved }: any) {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    api('/api/settings').then(setS);
  }, []);
  if (!s) return <Spinner />;
  const setZone = (i: number, k: string, v: any) => setS({ ...s, zones: s.zones.map((z: any, j: number) => (j === i ? { ...z, [k]: v } : z)) });
  const setPromo = (i: number, k: string, v: any) => setS({ ...s, promos: s.promos.map((p: any, j: number) => (j === i ? { ...p, [k]: v } : p)) });
  async function save() {
    try {
      const r = await api('/api/settings', { method: 'PUT', body: s });
      setS(r);
      toast('Настройки сохранены');
      onSaved();
    } catch (e: any) {
      toast(e.message);
    }
  }
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="card stack">
        <h2>Общее</h2>
        <div className="grid2">
          <label className="f"><span>Город / зона обслуживания</span><input className="input" value={s.serviceArea} onChange={(e) => setS({ ...s, serviceArea: e.target.value })} /></label>
          <label className="f"><span>Валюта</span><input className="input" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} /></label>
        </div>
        <label className="f"><span>Варианты чаевых (через запятую)</span><input className="input" value={s.tipOptions} onChange={(e) => setS({ ...s, tipOptions: e.target.value })} /></label>
      </div>
      <div className="card stack">
        <h2>Тарифы</h2>
        <div className="grid2">
          {NUM_FIELDS.map(([k, l]) => (
            <label className="f" key={k}><span>{l}</span><input className="input" inputMode="numeric" value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>
          ))}
        </div>
      </div>
      <div className="card stack">
        <div className="row between"><h2 style={{ margin: 0 }}>Районы и доплаты</h2><button className="btn sm ghost" onClick={() => setS({ ...s, zones: [...s.zones, { id: '', name: '', extra: 0 }] })}>+ Район</button></div>
        {s.zones.map((z: any, i: number) => (
          <div key={i} className="row">
            <input className="input grow" placeholder="Название" value={z.name} onChange={(e) => setZone(i, 'name', e.target.value)} />
            <input className="input" style={{ width: 110 }} inputMode="numeric" placeholder="Доплата" value={z.extra} onChange={(e) => setZone(i, 'extra', e.target.value)} />
            <button className="btn plain sm" onClick={() => setS({ ...s, zones: s.zones.filter((_: any, j: number) => j !== i) })}>✕</button>
          </div>
        ))}
      </div>
      <div className="card stack">
        <div className="row between"><h2 style={{ margin: 0 }}>Промокоды</h2><button className="btn sm ghost" onClick={() => setS({ ...s, promos: [...s.promos, { code: '', type: 'percent', value: 10, maxUses: 100, used: 0, active: true }] })}>+ Промокод</button></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Код</th><th>Тип</th><th>Размер</th><th>Лимит</th><th>Использован</th><th>Активен</th><th></th></tr></thead>
            <tbody>
              {s.promos.map((p: any, i: number) => (
                <tr key={i}>
                  <td><input className="input" style={{ minWidth: 110 }} value={p.code} onChange={(e) => setPromo(i, 'code', e.target.value.toUpperCase())} /></td>
                  <td>
                    <select className="input" value={p.type} onChange={(e) => setPromo(i, 'type', e.target.value)}>
                      <option value="percent">%</option>
                      <option value="fixed">{s.currency}</option>
                    </select>
                  </td>
                  <td><input className="input" style={{ width: 80 }} value={p.value} onChange={(e) => setPromo(i, 'value', e.target.value)} /></td>
                  <td><input className="input" style={{ width: 80 }} value={p.maxUses} onChange={(e) => setPromo(i, 'maxUses', e.target.value)} /></td>
                  <td>{p.used}</td>
                  <td><input type="checkbox" checked={p.active} onChange={(e) => setPromo(i, 'active', e.target.checked)} /></td>
                  <td><button className="btn plain sm" onClick={() => setS({ ...s, promos: s.promos.filter((_: any, j: number) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button className="btn lg" onClick={save}>Сохранить настройки</button>
      <div className="small muted">Статусы заказов: {Object.values(STATUS_LABEL).join(' → ')}</div>
    </div>
  );
}

function LiveMap({ orders, workers, onOpen }: any) {
  const active = orders.filter((o: any) => !['done', 'cancelled'].includes(o.status) && o.address?.lat);
  const markers = [
    ...active.map((o: any) => ({ lat: o.address.lat, lng: o.address.lng, kind: o.status === 'new' ? 'new' : 'order', label: `№${o.num}` })),
    ...workers.filter((w: any) => w.loc && w.active).map((w: any) => ({ lat: w.loc.lat, lng: w.loc.lng, kind: 'worker', label: w.name.split(' ')[0] })),
  ];
  return (
    <div className="stack">
      <MapView markers={markers} height={460} />
      <div className="small muted">🆕 ждут исполнителя · 🗑️ в работе · 🧤 исполнители (последнее известное место)</div>
      <Orders orders={active} onOpen={onOpen} compact />
    </div>
  );
}

function AdminSubs({ cur }: { cur: string }) {
  const [subs, setSubs] = useState<any[] | null>(null);
  const load = () => api('/api/subscriptions').then((d) => setSubs(d.subscriptions));
  useEffect(() => {
    load();
  }, []);
  if (!subs) return <Spinner />;
  const active = subs.filter((s) => s.active);
  const mrr = active.reduce((a, s) => a + (s.perVisit || 0) * s.days.length * 4.3, 0);
  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><div className="l">Активных подписок</div><div className="v">{active.length}</div></div>
        <div className="stat"><div className="l">Выносов в неделю</div><div className="v">{active.reduce((a, s) => a + s.days.length, 0)}</div></div>
        <div className="stat"><div className="l">Доход в месяц (оценка)</div><div className="v">{money(mrr, cur)}</div></div>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead><tr><th>Клиент</th><th>Услуга</th><th>Дни</th><th>Время</th><th>Адрес</th><th>За вынос</th><th>Оплата</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td><b>{s.clientName}</b><div className="small muted">{s.clientPhone}</div></td>
                <td>{SERVICES[s.service]?.icon} {s.bags}</td>
                <td>{s.days.map((d: number) => WEEKDAYS[d]).join(', ')}</td>
                <td>{s.time}</td>
                <td>{addrLine(s.address)}</td>
                <td>{money(s.perVisit, cur)}</td>
                <td className="small">{PAYMENT_LABEL[s.payment]}</td>
                <td>{s.active ? <span className="badge green">Активна</span> : <span className="badge gray">Пауза</span>}</td>
                <td><button className="btn sm ghost" onClick={() => api('/api/subscriptions', { body: { id: s.id, action: 'toggle' } }).then(load)}>{s.active ? 'Пауза' : 'Вкл.'}</button></td>
              </tr>
            ))}
            {subs.length === 0 && <tr><td colSpan={9} className="center muted" style={{ padding: 30 }}>Подписок пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
