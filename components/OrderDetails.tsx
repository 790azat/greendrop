'use client';
import { Badge, Photo, addrLine, fmtDate, fmtWhen, Icon, t } from './ui';
import { PAYMENT_LABEL, SERVICES, SIZE_LABEL, money, stepsFor } from '@/lib/domain';

export function OrderSummary({ o, showContacts = true }: { o: any; showContacts?: boolean }) {
  return (
    <dl className="kv">
      <dt>{t('Адрес')}</dt>
      <dd>
        {[t(o.address?.city), addrLine(o.address)].filter(Boolean).join(', ')}
        {o.address?.intercom ? `, ${t('домофон {n}', { n: o.address.intercom })}` : ''}
      </dd>
      <dt>{t('Когда')}</dt>
      <dd>{fmtWhen(o.when)}{o.express ? ` · ${t('срочно')}` : ''}</dd>
      <dt>{t('Услуга')}</dt>
      <dd>
        {SERVICES[o.service || 'trash']?.icon} {t(SERVICES[o.service || 'trash']?.title)}
        {o.subscriptionId ? ` · ${t('по подписке')}` : ''}
      </dd>
      <dt>{t('Объём')}</dt>
      <dd>
        {o.bags} {t(SERVICES[o.service || 'trash']?.unit)}
        {(o.service || 'trash') === 'trash' ? ` · ${t(SIZE_LABEL[o.size] || o.size)}` : ''}
        {o.bulky ? ` · ${t('+ крупный предмет')}` : ''}
      </dd>
      <dt>{t('Сумма')}</dt>
      <dd>
        {money(o.price, o.currency)}
        {o.subtotal > o.price && <span className="muted" style={{ textDecoration: 'line-through', marginLeft: 6, fontWeight: 400 }}>{money(o.subtotal, o.currency)}</span>}
        {o.discounts?.length ? <div className="small muted" style={{ fontWeight: 400 }}>{o.discounts.map((d: any) => `${t(d.label)}: −${money(d.amount, o.currency)}`).join(' · ')}</div> : null}
      </dd>
      <dt>{t('Оплата')}</dt>
      <dd>
        {t(PAYMENT_LABEL[o.payment] || o.payment)} ·{' '}
        {o.paymentStatus === 'paid' ? <span style={{ color: 'var(--g600)' }}>{t('оплачено')}</span> : o.paymentStatus === 'refunded' ? t(o.payment === 'wallet' ? 'возвращено на баланс' : 'возврат') : <span style={{ color: 'var(--amber)' }}>{t('не оплачено')}</span>}
      </dd>
      {o.tip ? (
        <>
          <dt>{t('Чаевые')}</dt>
          <dd>{money(o.tip, o.currency)}</dd>
        </>
      ) : null}
      {o.comment && (
        <>
          <dt>{t('Комментарий')}</dt>
          <dd style={{ fontWeight: 400 }}>{o.comment}</dd>
        </>
      )}
      {showContacts && o.clientName && (
        <>
          <dt>{t('Клиент')}</dt>
          <dd>
            {o.clientName}
            {o.clientPhone && (
              <>
                {' · '}
                <a href={`tel:${o.clientPhone}`}>{o.clientPhone}</a>
              </>
            )}
          </dd>
        </>
      )}
      {showContacts && o.workerName && (
        <>
          <dt>{t('Исполнитель')}</dt>
          <dd>
            {o.workerName}
            {o.workerPhone && (
              <>
                {' · '}
                <a href={`tel:${o.workerPhone}`}>{o.workerPhone}</a>
              </>
            )}
          </dd>
        </>
      )}
    </dl>
  );
}

/** Read-only timeline of steps with photos (for client and admin) */
export function Timeline({ o }: { o: any }) {
  const steps = stepsFor(o);
  return (
    <ul className="checklist">
      <li>
        <div className="cbox on">{Icon.check}</div>
        <div className="grow">
          <div className="t">{t('Заказ создан')}</div>
          <div className="muted small">{fmtDate(o.createdAt)}</div>
          {!!o.clientPhotos?.length && (
            <div className="photos" style={{ marginTop: 8 }}>
              {o.clientPhotos.map((u: string) => (
                <Photo key={u} src={u} />
              ))}
            </div>
          )}
        </div>
      </li>
      {steps.map((s) => {
        const d = o.steps?.[s.key];
        return (
          <li key={s.key} className={d ? '' : 'off'}>
            <div className={`cbox ${d ? 'on' : ''}`}>{d && Icon.check}</div>
            <div className="grow">
              <div className="t">{t(s.title)}</div>
              {d && <div className="muted small">{fmtDate(d.at)}</div>}
              {d?.photo && (
                <div className="photos" style={{ marginTop: 8 }}>
                  <Photo src={d.photo} />
                </div>
              )}
              {d?.note && <div className="small" style={{ marginTop: 4 }}>{d.note}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function orderProgress(o: any) {
  const steps = stepsFor(o);
  const done = steps.filter((s) => o.steps?.[s.key]).length;
  return o.status === 'done' ? 1 : done / (steps.length + 1) + 1 / (steps.length + 1);
}

export function OrderHead({ o }: { o: any }) {
  return (
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <div className="small muted">{t('Заказ №{n}', { n: o.num })} · {fmtDate(o.createdAt)}</div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{SERVICES[o.service || 'trash']?.icon} {addrLine(o.address)}</div>
      </div>
      <Badge status={o.status} />
    </div>
  );
}
