'use client';
import { useState } from 'react';
import { Modal, api, t, toast } from './ui';
import { money } from '@/lib/domain';

const PROVIDERS = [
  { id: 'idram', name: 'Idram', hint: 'Кошелёк Idram', color: '#e3262f' },
  { id: 'arca', name: 'ArCa / Visa / Mastercard', hint: 'Банковская карта', color: '#1d4ed8' },
  { id: 'telcell', name: 'Telcell Wallet', hint: 'Кошелёк Telcell', color: '#f59e0b' },
];

/**
 * Demo payment screen. Real payments require a merchant agreement with the provider.
 * purpose: order payment, tip for the worker, or wallet top-up.
 */
export function PayModal({
  order,
  purpose = 'order',
  amount,
  currency,
  balance,
  onClose,
  onPaid,
}: {
  order?: any;
  purpose?: 'order' | 'tip' | 'topup';
  amount: number;
  currency?: string;
  /** wallet balance; when set (and not a top-up) the wallet is offered as a source */
  balance?: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const cur = currency || order?.currency || '֏';
  const canWallet = purpose !== 'topup' && balance != null;
  const enough = (balance || 0) >= amount;
  const [provider, setProvider] = useState(canWallet && enough ? 'wallet' : 'arca');
  const [step, setStep] = useState<'choose' | 'processing' | 'done'>('choose');

  async function pay() {
    setStep('processing');
    if (provider !== 'wallet') await new Promise((r) => setTimeout(r, 1400));
    try {
      if (purpose === 'topup') await api('/api/wallet', { body: { action: 'topup', provider, amount } });
      else await api(`/api/orders/${order.id}`, { body: { action: 'pay', provider, purpose, amount } });
      setStep('done');
      onPaid();
    } catch (e: any) {
      toast(e.message);
      setStep('choose');
    }
  }

  const title = purpose === 'tip' ? t('Чаевые исполнителю') : purpose === 'topup' ? t('Пополнение баланса') : t('Оплата заказа');
  const sub = purpose === 'topup' ? t('Кошелёк GreenDrop') : `${t('Заказ №{n}', { n: order?.num })} · GreenDrop`;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        <div className="card center">
          <div className="muted small">{sub}</div>
          <div className="price" style={{ fontSize: 32 }}>{money(amount, cur)}</div>
        </div>
        {step === 'choose' && (
          <>
            {canWallet && (
              <label className="check" style={{ borderColor: provider === 'wallet' ? 'var(--g500)' : undefined, opacity: enough ? 1 : 0.6 }}>
                <input type="radio" name="prov" checked={provider === 'wallet'} disabled={!enough} onChange={() => setProvider('wallet')} />
                <span style={{ fontSize: 18 }}>👛</span>
                <span className="grow">
                  <b>{t('Баланс GreenDrop')}</b>
                  <div className="small muted">
                    {t('Доступно {sum}', { sum: money(balance || 0, cur) })}
                    {!enough && ` · ${t('недостаточно средств')}`}
                  </div>
                </span>
              </label>
            )}
            {PROVIDERS.map((p) => (
              <label key={p.id} className="check" style={{ borderColor: provider === p.id ? 'var(--g500)' : undefined }}>
                <input type="radio" name="prov" checked={provider === p.id} onChange={() => setProvider(p.id)} />
                <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color }} />
                <span className="grow"><b>{p.name}</b><div className="small muted">{t(p.hint)}</div></span>
              </label>
            ))}
            <button className="btn block lg" onClick={pay}>
              {purpose === 'topup' ? t('Пополнить на {sum}', { sum: money(amount, cur) }) : t('Оплатить {sum}', { sum: money(amount, cur) })}
            </button>
            {provider !== 'wallet' && (
              <div className="small muted center">{t('Демо-оплата: деньги не списываются. Для реальных платежей нужен договор с Idram, банком-эквайером ArCa или Telcell.')}</div>
            )}
          </>
        )}
        {step === 'processing' && (
          <div className="center" style={{ padding: 30 }}>
            <span className="spin" /> <div className="muted" style={{ marginTop: 10 }}>{t('Связываемся с платёжной системой…')}</div>
          </div>
        )}
        {step === 'done' && (
          <div className="center stack" style={{ padding: 20 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2>{purpose === 'topup' ? t('Баланс пополнен') : t('Оплачено')}</h2>
            <button className="btn block" onClick={onClose}>{t('Готово')}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
