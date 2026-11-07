'use client';
import { useState } from 'react';
import { Modal, api, toast } from './ui';
import { money } from '@/lib/domain';

const PROVIDERS = [
  { id: 'idram', name: 'Idram', hint: 'Кошелёк Idram', color: '#e3262f' },
  { id: 'arca', name: 'Карта ArCa / Visa / Mastercard', hint: 'Банковская карта', color: '#1d4ed8' },
  { id: 'telcell', name: 'Telcell Wallet', hint: 'Кошелёк Telcell', color: '#f59e0b' },
];

/** Demo payment screen. Real payments require a merchant agreement with the provider. */
export function PayModal({
  order,
  purpose = 'order',
  amount,
  onClose,
  onPaid,
}: {
  order: any;
  purpose?: 'order' | 'tip';
  amount: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [provider, setProvider] = useState('arca');
  const [step, setStep] = useState<'choose' | 'processing' | 'done'>('choose');
  async function pay() {
    setStep('processing');
    await new Promise((r) => setTimeout(r, 1400));
    try {
      await api(`/api/orders/${order.id}`, { body: { action: 'pay', provider, purpose, amount } });
      setStep('done');
      onPaid();
    } catch (e: any) {
      toast(e.message);
      setStep('choose');
    }
  }
  return (
    <Modal title={purpose === 'tip' ? 'Чаевые исполнителю' : 'Оплата заказа'} onClose={onClose}>
      <div className="stack">
        <div className="card center">
          <div className="muted small">{purpose === 'tip' ? `Заказ №${order.num}` : `Заказ №${order.num} · GreenDrop`}</div>
          <div className="price" style={{ fontSize: 32 }}>{money(amount, order.currency)}</div>
        </div>
        {step === 'choose' && (
          <>
            {PROVIDERS.map((p) => (
              <label key={p.id} className="check" style={{ borderColor: provider === p.id ? 'var(--g500)' : undefined }}>
                <input type="radio" name="prov" checked={provider === p.id} onChange={() => setProvider(p.id)} />
                <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color }} />
                <span className="grow"><b>{p.name}</b><div className="small muted">{p.hint}</div></span>
              </label>
            ))}
            <button className="btn block lg" onClick={pay}>Оплатить {money(amount, order.currency)}</button>
            <div className="small muted center">Демо-оплата: деньги не списываются. Для реальных платежей нужен договор с Idram, банком-эквайером ArCa или Telcell.</div>
          </>
        )}
        {step === 'processing' && (
          <div className="center" style={{ padding: 30 }}>
            <span className="spin" /> <div className="muted" style={{ marginTop: 10 }}>Связываемся с платёжной системой…</div>
          </div>
        )}
        {step === 'done' && (
          <div className="center stack" style={{ padding: 20 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2>Оплачено</h2>
            <button className="btn block" onClick={onClose}>Готово</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
